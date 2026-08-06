import "server-only";

import { Prisma } from "@prisma/client";
import { DEFAULT_EVENT_REMINDER_MINUTES } from "@/lib/calendar-reminder-values";
import { validateEventReminderMinutes } from "@/lib/calendar-events";
import type { CrmObject, RecordData } from "@/lib/crm-types";
import { prisma } from "@/lib/prisma";
import { optionalNumberValue, optionalStringValue } from "@/server/records/form-values";

export async function createRecord(object: CrmObject, payload: RecordData, organizationId: string, userId: string) {
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
          rating: payload.rating as string | null,
          numberOfEmployees: optionalNumberValue(payload.numberOfEmployees),
          annualRevenue: optionalStringValue(payload.annualRevenue),
          industry: payload.industry as string | null,
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
          leadSource: payload.leadSource as string | null,
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
          lastName: payload.lastName == null ? null : String(payload.lastName),
          company: payload.company == null ? null : String(payload.company),
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
          numberOfEmployees: optionalNumberValue(payload.numberOfEmployees),
          annualRevenue: optionalStringValue(payload.annualRevenue),
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
          contactId: payload.contactId ? String(payload.contactId) : null,
          closeDate: new Date(String(payload.closeDate)),
          amount: optionalStringValue(payload.amount),
          description: payload.description as string | null,
          ownerId: String(payload.ownerId ?? userId),
          stage: String(payload.stage),
          probability: optionalNumberValue(payload.probability),
          forecastCategory: String(payload.forecastCategory),
          nextStep: payload.nextStep as string | null,
          leadSource: payload.leadSource as string | null,
          courier: payload.courier as string | null,
          trackingNumber: payload.trackingNumber as string | null,
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

        if (
          payload.createPriceBookEntry !== false &&
          (payload.listPrice || payload.entryActive || payload.priceBookId || payload.priceBookName)
        ) {
          const requestedPriceBookId = payload.priceBookId
            ? String(payload.priceBookId)
            : `${organizationId}-standard-price-book`;
          const requestedPriceBookName = String(payload.priceBookName ?? "Standard Price Book");
          const existingPriceBook = await tx.priceBook.findFirst({
            where: { id: requestedPriceBookId, organizationId }
          });
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
          isStandard: parseBooleanFlag(payload.isStandard),
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
          private: Boolean(payload.private),
          recurrenceRule: (payload.recurrenceRule as string | null) ?? null,
          recurrenceEndAt: payload.recurrenceEndAt ? new Date(String(payload.recurrenceEndAt)) : null,
          reminderMinutes:
            payload.reminderMinutes === undefined
              ? DEFAULT_EVENT_REMINDER_MINUTES
              : validateEventReminderMinutes(payload.reminderMinutes)
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
          scheduledAt:
            listEmailStatus === "Scheduled" && payload.scheduledAt ? new Date(String(payload.scheduledAt)) : null,
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

/** True only for boolean true or the strings "true"/"1" (case-insensitive). Avoids Boolean("False") === true. */
function parseBooleanFlag(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  const text = String(value ?? "")
    .trim()
    .toLowerCase();
  return text === "true" || text === "1";
}

export async function allocateCaseNumber(organizationId: string) {
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
