import { AppAuthorizationError, assertOrganizationRecord, assertOrganizationUser, assertRelatedOrganizationRecord, authorizationErrorResponse, requireOrganizationContext } from "@/lib/organization-context";
import { prisma } from "@/lib/prisma";
import type { CrmObject, RecordData } from "@/lib/crm-types";
import { NextRequest, NextResponse } from "next/server";

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
    await validateReferences(object, payload, authContext.organizationId, authContext.userId);
    const record = await createRecord(object, payload, authContext.organizationId, authContext.userId);
    return NextResponse.json({ record: JSON.parse(JSON.stringify(record)) }, { status: 201 });
  } catch (error) {
    console.error(error);
    const response = authorizationErrorResponse(error);
    if (response) return response;
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
          caseNumber: `0000${Math.floor(Math.random() * 9000) + 1000}`,
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
          articleNumber: `KA-${Math.floor(Math.random() * 900000) + 100000}`,
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
          scheduledAt: payload.scheduledAt ? new Date(String(payload.scheduledAt)) : null,
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
