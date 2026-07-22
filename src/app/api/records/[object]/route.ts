import { AppAuthorizationError, assertOrganizationRecord, assertOrganizationUser, assertRelatedOrganizationRecord, authorizationErrorResponse, requireOrganizationContext } from "@/lib/organization-context";
import { EmailValidationError } from "@/lib/email/errors";
import { emailErrorResponse } from "@/lib/email/http";
import { deliverCaseNotification, deliverListEmail } from "@/lib/email/workflows";
import { attachTrackedDeliveries } from "@/lib/email/tracking";
import { prisma } from "@/lib/prisma";
import { RecordPayloadValidationError, validateRecordPayload } from "@/lib/record-validation";
import type { CrmObject, RecordData } from "@/lib/crm-types";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

type Params = Promise<{ object: string }>;

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: { params: Params }) {
  try {
    const authContext = await requireOrganizationContext();
    const { object } = await context.params;
    if (!isCrmObject(object)) return NextResponse.json({ error: "Unknown object." }, { status: 404 });
    const payload = normalizePayload(await request.json());
    const missingFields = requiredFieldsForObject(object).filter((field) => isBlankRequiredValue(payload[field]));
    if (missingFields.length > 0) return NextResponse.json({ error: "Complete this field.", fields: missingFields }, { status: 400 });
    validateRecordPayload(object, payload);
    if (object === "Event") {
      const startAt = new Date(String(payload.startAt));
      const endAt = new Date(String(payload.endAt));
      if (!Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime())) return NextResponse.json({ error: "Choose valid event start and end times." }, { status: 400 });
      if (endAt <= startAt) return NextResponse.json({ error: "Event end time must be after its start time." }, { status: 400 });
    }
    await validateReferences(object, payload, authContext.organizationId, authContext.userId);
    let delivery = null;
    if (object === "Case") payload.caseNumber = await allocateCaseNumber(authContext.organizationId);
    if (object === "Case" && payload.sendNotificationEmailToContact === true) {
      const caseNumber = String(payload.caseNumber);
      delivery = await deliverCaseNotification({
        organizationId: authContext.organizationId,
        organizationName: authContext.organization.name,
        userId: authContext.userId,
        contactId: payload.contactId,
        caseNumber,
        status: String(payload.status ?? "New"),
        subject: payload.subject as string | null,
        description: payload.description as string | null
      });
    }
    if (object === "ListEmail") {
      const status = String(payload.status ?? "Draft");
      if (!["Draft", "Sent", "Scheduled"].includes(status)) throw new EmailValidationError("Invalid list email status.");
      if (status === "Sent" || status === "Scheduled") {
        if (status === "Scheduled" && !payload.scheduledAt) throw new EmailValidationError("Choose a schedule date and time.");
        delivery = await deliverListEmail({
          organizationId: authContext.organizationId,
          organizationName: authContext.organization.name,
          userId: authContext.userId,
          subject: payload.subject,
          body: payload.body,
          recipients: payload.recipients,
          scheduledAt: status === "Scheduled" ? payload.scheduledAt : undefined
        });
      }
    }
    const record = await createRecord(object, payload, authContext.organizationId, authContext.userId);
    if (delivery?.deliveryIds?.length && (object === "Case" || object === "ListEmail")) {
      await attachTrackedDeliveries(delivery.deliveryIds, { organizationId: authContext.organizationId, userId: authContext.userId, sourceType: object, sourceId: String(record.id) });
    }
    const recordStatus = "status" in record ? String(record.status) : "";
    const skipped = delivery && "skipped" in delivery && Array.isArray(delivery.skipped) ? delivery.skipped.length : 0;
    const message = object === "ListEmail" && recordStatus === "Sent"
      ? `List email accepted for ${delivery?.acceptedCount ?? 0} recipient${delivery?.acceptedCount === 1 ? "" : "s"}.`
      : object === "ListEmail" && recordStatus === "Scheduled"
        ? `List email scheduled for ${delivery?.acceptedCount ?? 0} recipient${delivery?.acceptedCount === 1 ? "" : "s"}.`
        : object === "Case" && delivery
          ? "Case saved and contact notification accepted."
          : undefined;
    return NextResponse.json({
      record: JSON.parse(JSON.stringify(record)),
      ...(delivery ? { delivery } : {}),
      ...(message ? { message } : {}),
      ...(skipped ? { warning: `${message ?? "Email accepted."} ${skipped} selected record${skipped === 1 ? " was" : "s were"} skipped because no deliverable address was available.` } : {})
    }, { status: 201 });
  } catch (error) {
    console.error(error);
    const response = authorizationErrorResponse(error);
    if (response) return response;
    const deliveryResponse = emailErrorResponse(error);
    if (deliveryResponse) return deliveryResponse;
    if (error instanceof RecordPayloadValidationError) return NextResponse.json({ error: error.message, fields: error.fields }, { status: 400 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "A record with that unique name or identifier already exists." }, { status: 409 });
    return NextResponse.json({ error: "Unable to create record." }, { status: 500 });
  }
}

function isCrmObject(value: string): value is CrmObject {
  return ["Account", "Contact", "Lead", "Opportunity", "Product2", "Pricebook2", "Event", "Case", "QuickText", "Knowledge__kav", "ListEmail"].includes(value);
}

function normalizePayload(payload: RecordData) {
  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => {
      if (value === "--None--" || value === "") return [key, null];
      return [key, value];
    })
  ) as RecordData;
}

function requiredFieldsForObject(object: CrmObject) {
  switch (object) {
    case "Account":
      return ["name"];
    case "Contact":
      return ["lastName", "accountId"];
    case "Lead":
      return ["status", "lastName", "company"];
    case "Opportunity":
      return ["name", "accountId", "closeDate", "stage", "forecastCategory"];
    case "Product2":
      return ["name"];
    case "Pricebook2":
      return ["name"];
    case "Event":
      return ["subject", "startAt", "endAt", "assignedToId"];
    case "QuickText":
      return ["name", "message"];
    case "Knowledge__kav":
      return ["title", "urlName"];
    default:
      return [];
  }
}

function isBlankRequiredValue(value: unknown) {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  return false;
}

async function validateReferences(object: CrmObject, payload: RecordData, organizationId: string, userId: string) {
  const ownerId = typeof payload.ownerId === "string" ? payload.ownerId : userId;
  if (["Account", "Contact", "Lead", "Opportunity", "Case"].includes(object)) await assertOrganizationUser(organizationId, ownerId);
  if (object === "Event") await assertOrganizationUser(organizationId, String(payload.assignedToId ?? userId));
  if (object === "Event") {
    await assertRelatedOrganizationRecord(organizationId, payload.nameObjectType, payload.nameRecordId);
    await assertRelatedOrganizationRecord(organizationId, payload.relatedObjectType, payload.relatedRecordId);
    if (payload.calendarSourceId) {
      const source = await prisma.calendarSource.findFirst({ where: { id: String(payload.calendarSourceId), organizationId, userId }, select: { id: true } });
      if (!source) throw new AppAuthorizationError("Calendar not found.", 404);
    }
  }
  if (payload.accountId) await assertOrganizationRecord(organizationId, "account", String(payload.accountId));
  if (payload.contactId) await assertOrganizationRecord(organizationId, "contact", String(payload.contactId));
  if (payload.parentAccountId) await assertOrganizationRecord(organizationId, "account", String(payload.parentAccountId));
  if (payload.reportsToContactId) await assertOrganizationRecord(organizationId, "contact", String(payload.reportsToContactId));
  if (object === "Product2" && payload.priceBookId) await assertOrganizationRecord(organizationId, "priceBook", String(payload.priceBookId));
  if (object === "QuickText" && payload.folderId) {
    const folder = await prisma.quickTextFolder.findFirst({ where: { id: String(payload.folderId), organizationId } });
    if (!folder) throw new AppAuthorizationError("Folder not found.", 404);
  }
}

async function createRecord(object: CrmObject, payload: RecordData, organizationId: string, userId: string) {
  switch (object) {
    case "Account":
      return prisma.account.create({
        data: {
          organizationId,
          name: String(payload.name),
          website: payload.website as string | null,
          type: payload.type as string | null,
          description: payload.description as string | null,
          parentAccountId: payload.parentAccountId as string | null,
          ownerId: String(payload.ownerId ?? userId),
          phone: payload.phone as string | null,
          billingCountry: payload.billingCountry as string | null,
          billingStreet: payload.billingStreet as string | null,
          billingPostalCode: payload.billingPostalCode as string | null,
          billingCity: payload.billingCity as string | null,
          billingState: payload.billingState as string | null,
          shippingCountry: payload.shippingCountry as string | null,
          shippingStreet: payload.shippingStreet as string | null,
          shippingPostalCode: payload.shippingPostalCode as string | null,
          shippingCity: payload.shippingCity as string | null,
          shippingState: payload.shippingState as string | null,
          createdById: userId,
          updatedById: userId
        }
      });
    case "Contact":
      return prisma.contact.create({
        data: {
          organizationId,
          salutation: payload.salutation as string | null,
          firstName: payload.firstName as string | null,
          lastName: String(payload.lastName),
          accountId: String(payload.accountId),
          title: payload.title as string | null,
          reportsToContactId: payload.reportsToContactId as string | null,
          description: payload.description as string | null,
          ownerId: String(payload.ownerId ?? userId),
          phone: payload.phone as string | null,
          email: payload.email as string | null,
          birthDate: payload.birthDate ? new Date(String(payload.birthDate)) : null,
          mailingCountry: payload.mailingCountry as string | null,
          mailingStreet: payload.mailingStreet as string | null,
          mailingPostalCode: payload.mailingPostalCode as string | null,
          mailingCity: payload.mailingCity as string | null,
          mailingState: payload.mailingState as string | null,
          createdById: userId,
          updatedById: userId
        }
      });
    case "Lead":
      return prisma.lead.create({
        data: {
          organizationId,
          status: String(payload.status ?? "New"),
          salutation: payload.salutation as string | null,
          firstName: payload.firstName as string | null,
          lastName: String(payload.lastName),
          company: String(payload.company),
          title: payload.title as string | null,
          website: payload.website as string | null,
          description: payload.description as string | null,
          ownerId: String(payload.ownerId ?? userId),
          rating: payload.rating as string | null,
          phone: payload.phone as string | null,
          email: payload.email as string | null,
          country: payload.country as string | null,
          street: payload.street as string | null,
          postalCode: payload.postalCode as string | null,
          city: payload.city as string | null,
          state: payload.state as string | null,
          numberOfEmployees: payload.numberOfEmployees ? Number(payload.numberOfEmployees) : null,
          annualRevenue: payload.annualRevenue ? String(payload.annualRevenue) : null,
          leadSource: payload.leadSource as string | null,
          industry: payload.industry as string | null,
          createdById: userId,
          updatedById: userId
        }
      });
    case "Opportunity":
      return prisma.opportunity.create({
        data: {
          organizationId,
          name: String(payload.name),
          accountId: String(payload.accountId),
          closeDate: new Date(String(payload.closeDate)),
          amount: payload.amount ? String(payload.amount) : null,
          description: payload.description as string | null,
          ownerId: String(payload.ownerId ?? userId),
          stage: String(payload.stage),
          probability: payload.probability ? Number(payload.probability) : null,
          forecastCategory: String(payload.forecastCategory),
          nextStep: payload.nextStep as string | null,
          createdById: userId,
          updatedById: userId
        }
      });
    case "Case":
      return prisma.caseRecord.create({
        data: {
          organizationId,
          caseNumber: String(payload.caseNumber),
          status: String(payload.status ?? "New"),
          origin: payload.origin as string | null,
          priority: String(payload.priority ?? "Medium"),
          ownerId: String(payload.ownerId ?? userId),
          contactId: payload.contactId as string | null,
          accountId: payload.accountId as string | null,
          subject: payload.subject as string | null,
          description: payload.description as string | null,
          sendNotificationEmailToContact: Boolean(payload.sendNotificationEmailToContact),
          createdById: userId,
          updatedById: userId
        }
      });
    case "Product2":
      return prisma.$transaction(async (tx) => {
        const product = await tx.product.create({
          data: {
            organizationId,
            name: String(payload.name),
            family: payload.family as string | null,
            productCode: payload.productCode as string | null,
            sku: payload.sku as string | null,
            category: payload.category as string | null,
            active: Boolean(payload.active),
            description: payload.description as string | null
          }
        });
        let priceBookEntry: RecordData | null = null;
        let priceBook: RecordData | null = null;

        if (payload.createPriceBookEntry !== false && (payload.listPrice || payload.entryActive || payload.priceBookId || payload.priceBookName)) {
          const requestedPriceBookId = payload.priceBookId ? String(payload.priceBookId) : `${organizationId}-standard-price-book`;
          const requestedPriceBookName = String(payload.priceBookName ?? "Standard Price Book");
          const existingPriceBook = await tx.priceBook.findFirst({ where: { id: requestedPriceBookId, organizationId } });
          priceBook =
            existingPriceBook ??
            (await tx.priceBook.upsert({
              where: { id: requestedPriceBookId },
              update: { active: true, isStandard: requestedPriceBookId === `${organizationId}-standard-price-book` },
              create: {
                id: requestedPriceBookId,
                organizationId,
                name: requestedPriceBookName,
                active: true,
                isStandard: requestedPriceBookId === `${organizationId}-standard-price-book`,
                description: "Default price book created by the product wizard."
              }
            }));

          priceBookEntry = await tx.priceBookEntry.create({
            data: {
              organizationId,
              productId: product.id,
              priceBookId: String(priceBook.id),
              listPrice: payload.listPrice ? String(payload.listPrice) : null,
              currency: String(payload.currency ?? "USD"),
              active: Boolean(payload.entryActive ?? payload.active)
            }
          });
        }

        return {
          ...product,
          priceBookEntryId: priceBookEntry?.id ?? "",
          priceBookName: priceBook?.name ?? "",
          listPrice: priceBookEntry?.listPrice ?? "",
          currency: priceBookEntry?.currency ?? "",
          priceBookEntryActive: priceBookEntry?.active ?? "",
          priceBookEntryCount: priceBookEntry ? 1 : 0,
          priceBook,
          priceBookEntry
        };
      });
    case "Pricebook2":
      return prisma.priceBook.create({
        data: {
          organizationId,
          name: String(payload.name),
          active: Boolean(payload.active),
          description: payload.description as string | null,
          isStandard: Boolean(payload.isStandard),
          validFrom: combineDateAndTime(payload.validFrom, payload.validFromTime),
          validTo: combineDateAndTime(payload.validTo, payload.validToTime)
        }
      });
    case "Event":
      return prisma.event.create({
        data: {
          organizationId,
          subject: String(payload.subject),
          description: payload.description as string | null,
          startAt: new Date(String(payload.startAt)),
          endAt: new Date(String(payload.endAt)),
          attendeeIds: Array.isArray(payload.attendeeIds) ? payload.attendeeIds.map(String) : [userId],
          nameObjectType: payload.nameObjectType as string | null,
          nameRecordId: payload.nameRecordId as string | null,
          relatedObjectType: payload.relatedObjectType as string | null,
          relatedRecordId: payload.relatedRecordId as string | null,
          assignedToId: String(payload.assignedToId ?? userId),
          calendarSourceId: payload.calendarSourceId as string | null,
          location: payload.location as string | null,
          showTimeAs: String(payload.showTimeAs ?? "Busy"),
          allDay: Boolean(payload.allDay),
          private: Boolean(payload.private)
        }
      });
    case "QuickText":
      return prisma.quickText.create({
        data: {
          organizationId,
          name: String(payload.name),
          message: String(payload.message),
          folderId: payload.folderId as string | null,
          category: String(payload.category ?? "Greetings"),
          channels: Array.isArray(payload.channels) ? payload.channels.map(String) : ["Email"],
          mergeFields: Array.isArray(payload.mergeFields) ? payload.mergeFields.map(String) : [],
          createdById: userId
        }
      });
    case "Knowledge__kav":
      return prisma.knowledgeArticle.create({
        data: {
          organizationId,
          title: String(payload.title),
          urlName: String(payload.urlName),
          summary: payload.summary as string | null,
          bodyRichText: payload.bodyRichText as string | null,
          visibleInInternalApp: payload.visibleInInternalApp !== false,
          visibleToCustomer: Boolean(payload.visibleToCustomer),
          articleNumber: await allocateKnowledgeArticleNumber(organizationId),
          publicationStatus: "Draft",
          validationStatus: "Not Validated",
          createdById: userId,
          updatedById: userId
        }
      });
    case "ListEmail": {
      const listEmailStatus = String(payload.status ?? "Draft");
      return prisma.listEmail.create({
        data: {
          organizationId,
          layoutType: String(payload.layoutType),
          subject: payload.subject as string | null,
          body: payload.body as string | null,
          recipientType: payload.recipientType as string | null,
          recipients: Array.isArray(payload.recipients) ? payload.recipients.map(String) : [],
          status: listEmailStatus,
          sentAt: listEmailStatus === "Sent" ? new Date() : null,
          scheduledAt: listEmailStatus === "Scheduled" && payload.scheduledAt ? new Date(String(payload.scheduledAt)) : null,
          createdById: userId
        }
      });
    }
    default:
      throw new Error(`Create is not supported for ${object}`);
  }
}

function combineDateAndTime(dateValue: unknown, timeValue: unknown) {
  if (!dateValue) return null;
  const date = String(dateValue);
  if (date.includes("T")) return new Date(date);
  const time = String(timeValue || "00:00").slice(0, 5);
  return new Date(`${date}T${time}:00.000Z`);
}

async function allocateCaseNumber(organizationId: string) {
  const rows = await prisma.$queryRaw<Array<{ allocatedNumber: number }>>(Prisma.sql`
    INSERT INTO "CaseNumberSequence" ("organizationId", "nextNumber", "updatedAt")
    VALUES (${organizationId}, 2, CURRENT_TIMESTAMP)
    ON CONFLICT ("organizationId") DO UPDATE
      SET "nextNumber" = "CaseNumberSequence"."nextNumber" + 1,
          "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "nextNumber" - 1 AS "allocatedNumber"
  `);
  const allocated = Number(rows[0]?.allocatedNumber);
  if (!Number.isInteger(allocated) || allocated < 1) throw new Error("Unable to allocate a Case number.");
  return String(allocated).padStart(8, "0");
}

async function allocateKnowledgeArticleNumber(organizationId: string) {
  const rows = await prisma.$queryRaw<Array<{ allocatedNumber: number }>>(Prisma.sql`
    INSERT INTO "KnowledgeArticleNumberSequence" ("organizationId", "nextNumber", "updatedAt")
    VALUES (${organizationId}, 2, CURRENT_TIMESTAMP)
    ON CONFLICT ("organizationId") DO UPDATE
      SET "nextNumber" = "KnowledgeArticleNumberSequence"."nextNumber" + 1,
          "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "nextNumber" - 1 AS "allocatedNumber"
  `);
  const allocated = Number(rows[0]?.allocatedNumber);
  if (!Number.isInteger(allocated) || allocated < 1) throw new Error("Unable to allocate a Knowledge article number.");
  return `KA-${String(allocated).padStart(6, "0")}`;
}
