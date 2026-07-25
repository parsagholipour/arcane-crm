import { AppAuthorizationError, assertOrganizationRecord, assertOrganizationUser, assertRelatedOrganizationRecord, authorizationErrorResponse, requireOrganizationContext } from "@/lib/organization-context";
import { EmailValidationError } from "@/lib/email/errors";
import { emailErrorResponse } from "@/lib/email/http";
import { deliverCaseNotification, deliverListEmail } from "@/lib/email/workflows";
import { prisma } from "@/lib/prisma";
import { RecordPayloadValidationError, validateRecordPayload } from "@/lib/record-validation";
import { calendarErrorResponse, detachOccurrence, eventUpdateData, excludeOccurrence, parseRecurrenceScope, validateEventReminderMinutes } from "@/lib/calendar-events";
import type { CrmObject, RecordData } from "@/lib/crm-types";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

type Params = Promise<{ object: string; id: string }>;

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, context: { params: Params }) {
  try {
    const authContext = await requireOrganizationContext();
    const { object, id } = await context.params;
    if (!isCrmObject(object)) return NextResponse.json({ error: "Unknown object." }, { status: 404 });
    await assertScopedRecord(object, id, authContext.organizationId);
    if (object === "Lead") {
      const lead = await prisma.lead.findFirst({ where: { id, organizationId: authContext.organizationId }, select: { convertedAt: true } });
      if (lead?.convertedAt) return NextResponse.json({ error: "Converted Leads are read-only. Open the converted Account, Contact, or Opportunity instead." }, { status: 409 });
    }
    const payload = normalizePayload(await request.json());
    validateRecordPayload(object, payload);
    await validateReferences(payload, authContext.organizationId, authContext.userId);
    if (object === "Event") {
      if (payload.reminderMinutes !== undefined) payload.reminderMinutes = validateEventReminderMinutes(payload.reminderMinutes);
      const existingEvent = await prisma.event.findFirst({ where: { id, organizationId: authContext.organizationId }, select: { startAt: true, endAt: true } });
      if (!existingEvent) return NextResponse.json({ error: "Record not found." }, { status: 404 });
      const startAt = payload.startAt ? new Date(String(payload.startAt)) : existingEvent.startAt;
      const endAt = payload.endAt ? new Date(String(payload.endAt)) : existingEvent.endAt;
      if (!Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime())) return NextResponse.json({ error: "Choose valid event start and end times." }, { status: 400 });
      if (endAt <= startAt) return NextResponse.json({ error: "Event end time must be after its start time." }, { status: 400 });

      // "This occurrence only" carves the slot out of the series into its own row.
      if (parseRecurrenceScope(payload.recurrenceScope) === "single") {
        const detached = await detachOccurrence(authContext.organizationId, id, payload.occurrenceStart, eventUpdateData(payload));
        if (detached) return NextResponse.json({ record: JSON.parse(JSON.stringify(detached)), message: "This occurrence was updated." });
      }
    }
    let delivery = null;
    if (object === "Case" && payload.sendNotificationEmailToContact === true) {
      const existing = await prisma.caseRecord.findFirst({ where: { id, organizationId: authContext.organizationId } });
      if (!existing) throw new AppAuthorizationError("Record not found.", 404);
      if (!existing.sendNotificationEmailToContact) {
        delivery = await deliverCaseNotification({
          organizationId: authContext.organizationId,
          organizationName: authContext.organization.name,
          userId: authContext.userId,
          sourceId: id,
          contactId: payload.contactId === undefined ? existing.contactId : payload.contactId,
          caseNumber: existing.caseNumber,
          status: String(payload.status ?? existing.status),
          subject: payload.subject === undefined ? existing.subject : payload.subject as string | null,
          description: payload.description === undefined ? existing.description : payload.description as string | null
        });
      }
    }
    if (object === "ListEmail") {
      const existing = await prisma.listEmail.findFirst({ where: { id, organizationId: authContext.organizationId } });
      if (!existing) throw new AppAuthorizationError("Record not found.", 404);
      if (existing.status !== "Draft") return NextResponse.json({ error: "Sent or scheduled list emails cannot be changed." }, { status: 409 });
      if (payload.status) {
        const status = String(payload.status);
        if (!["Draft", "Sent", "Scheduled"].includes(status)) throw new EmailValidationError("Invalid list email status.");
        if (status === "Sent" || status === "Scheduled") {
          if (status === "Scheduled" && !(payload.scheduledAt ?? existing.scheduledAt)) throw new EmailValidationError("Choose a schedule date and time.");
          delivery = await deliverListEmail({
            organizationId: authContext.organizationId,
            organizationName: authContext.organization.name,
            userId: authContext.userId,
            sourceId: id,
            subject: payload.subject === undefined ? existing.subject : payload.subject,
            body: payload.body === undefined ? existing.body : payload.body,
            recipients: payload.recipients === undefined ? existing.recipients : payload.recipients,
            scheduledAt: status === "Scheduled" ? (payload.scheduledAt ?? existing.scheduledAt) : undefined
          });
        }
      }
    }
    if (object === "Knowledge__kav") {
      const article = await prisma.knowledgeArticle.findFirst({ where: { id, organizationId: authContext.organizationId }, select: { publicationStatus: true } });
      if (article?.publicationStatus !== "Draft") return NextResponse.json({ error: "Only Draft Knowledge articles can be edited. Restore an archived article to Draft first." }, { status: 409 });
    }
    const record = await updateRecord(object, id, payload, authContext.userId);
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
    });
  } catch (error) {
    console.error(error);
    const response = authorizationErrorResponse(error);
    if (response) return response;
    const deliveryResponse = emailErrorResponse(error);
    if (deliveryResponse) return deliveryResponse;
    if (error instanceof RecordPayloadValidationError) return NextResponse.json({ error: error.message, fields: error.fields }, { status: 400 });
    const calendarError = calendarErrorResponse(error);
    if (calendarError) return NextResponse.json({ error: calendarError.error, field: calendarError.field }, { status: calendarError.status });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "A record with that unique name or identifier already exists." }, { status: 409 });
    return NextResponse.json({ error: "Unable to update record." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Params }) {
  try {
    const authContext = await requireOrganizationContext();
    const { object, id } = await context.params;
    if (!isCrmObject(object)) return NextResponse.json({ error: "Unknown object." }, { status: 404 });
    await assertScopedRecord(object, id, authContext.organizationId);
    if (object === "Event" && parseRecurrenceScope(request.nextUrl.searchParams.get("scope")) === "single") {
      const excluded = await excludeOccurrence(authContext.organizationId, id, request.nextUrl.searchParams.get("occurrenceStart"));
      if (excluded) return NextResponse.json({ ok: true, message: "This occurrence was removed." });
    }
    if (object === "ListEmail") {
      const listEmail = await prisma.listEmail.findFirst({ where: { id, organizationId: authContext.organizationId }, select: { status: true } });
      if (listEmail?.status !== "Draft") return NextResponse.json({ error: "Sent or scheduled list emails cannot be deleted." }, { status: 409 });
    }
    if (object === "Lead") {
      const lead = await prisma.lead.findFirst({ where: { id, organizationId: authContext.organizationId }, select: { convertedAt: true } });
      if (lead?.convertedAt) return NextResponse.json({ error: "Converted Leads cannot be deleted." }, { status: 409 });
    }
    if (object === "Knowledge__kav") {
      const article = await prisma.knowledgeArticle.findFirst({ where: { id, organizationId: authContext.organizationId }, select: { publicationStatus: true } });
      if (article?.publicationStatus !== "Draft") return NextResponse.json({ error: "Only Draft Knowledge articles can be deleted from the record page. Archive published articles instead." }, { status: 409 });
    }
    if (object === "Product2") {
      const usage = await prisma.product.findFirst({ where: { id, organizationId: authContext.organizationId }, select: { _count: { select: { invoiceLineItems: true, commerceOrderLines: true, inventoryItems: true } } } });
      if (usage && (usage._count.invoiceLineItems || usage._count.commerceOrderLines || usage._count.inventoryItems)) return NextResponse.json({ error: "A Product used by an invoice, order, or inventory record cannot be deleted. Deactivate it instead." }, { status: 409 });
    }
    if (object === "Pricebook2") {
      const connectedStores = await prisma.marketingStore.count({ where: { organizationId: authContext.organizationId, priceBookId: id } });
      if (connectedStores) return NextResponse.json({ error: "A Price Book connected to a Store cannot be deleted. Disconnect or archive the Store first." }, { status: 409 });
    }
    await deleteRecord(object, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    const response = authorizationErrorResponse(error);
    if (response) return response;
    const calendarError = calendarErrorResponse(error);
    if (calendarError) return NextResponse.json({ error: calendarError.error, field: calendarError.field }, { status: calendarError.status });
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2003", "P2014"].includes(error.code)) {
      return NextResponse.json({ error: "This record cannot be deleted because related CRM records still reference it." }, { status: 409 });
    }
    return NextResponse.json({ error: "Unable to delete record." }, { status: 500 });
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

async function validateReferences(payload: RecordData, organizationId: string, userId: string) {
  if (payload.ownerId) await assertOrganizationUser(organizationId, String(payload.ownerId));
  if (payload.assignedToId) await assertOrganizationUser(organizationId, String(payload.assignedToId));
  if (payload.accountId) await assertOrganizationRecord(organizationId, "account", String(payload.accountId));
  if (payload.contactId) await assertOrganizationRecord(organizationId, "contact", String(payload.contactId));
  if (payload.parentAccountId) await assertOrganizationRecord(organizationId, "account", String(payload.parentAccountId));
  if (payload.reportsToContactId) await assertOrganizationRecord(organizationId, "contact", String(payload.reportsToContactId));
  await assertRelatedOrganizationRecord(organizationId, payload.nameObjectType, payload.nameRecordId);
  await assertRelatedOrganizationRecord(organizationId, payload.relatedObjectType, payload.relatedRecordId);
  if (payload.calendarSourceId) {
    const source = await prisma.calendarSource.findFirst({ where: { id: String(payload.calendarSourceId), organizationId, userId }, select: { id: true } });
    if (!source) throw new AppAuthorizationError("Calendar not found.", 404);
  }
}

async function assertScopedRecord(object: CrmObject, id: string, organizationId: string) {
  const row =
    object === "Account" ? await prisma.account.findFirst({ where: { id, organizationId }, select: { id: true } }) :
    object === "Contact" ? await prisma.contact.findFirst({ where: { id, organizationId }, select: { id: true } }) :
    object === "Lead" ? await prisma.lead.findFirst({ where: { id, organizationId }, select: { id: true } }) :
    object === "Opportunity" ? await prisma.opportunity.findFirst({ where: { id, organizationId }, select: { id: true } }) :
    object === "Case" ? await prisma.caseRecord.findFirst({ where: { id, organizationId }, select: { id: true } }) :
    object === "Product2" ? await prisma.product.findFirst({ where: { id, organizationId }, select: { id: true } }) :
    object === "Pricebook2" ? await prisma.priceBook.findFirst({ where: { id, organizationId }, select: { id: true } }) :
    object === "Event" ? await prisma.event.findFirst({ where: { id, organizationId }, select: { id: true } }) :
    object === "QuickText" ? await prisma.quickText.findFirst({ where: { id, organizationId }, select: { id: true } }) :
    object === "Knowledge__kav" ? await prisma.knowledgeArticle.findFirst({ where: { id, organizationId }, select: { id: true } }) :
    object === "ListEmail" ? await prisma.listEmail.findFirst({ where: { id, organizationId }, select: { id: true } }) : null;
  if (!row) throw new AppAuthorizationError("Record not found.", 404);
}

async function updateRecord(object: CrmObject, id: string, payload: RecordData, userId: string) {
  switch (object) {
    case "Account":
      return prisma.account.update({
        where: { id },
        data: {
          name: payload.name ? String(payload.name) : undefined,
          website: payload.website as string | null | undefined,
          type: payload.type as string | null | undefined,
          description: payload.description as string | null | undefined,
          parentAccountId: payload.parentAccountId as string | null | undefined,
          phone: payload.phone as string | null | undefined,
          rating: payload.rating as string | null | undefined,
          numberOfEmployees: payload.numberOfEmployees === undefined ? undefined : payload.numberOfEmployees === null ? null : Number(payload.numberOfEmployees),
          annualRevenue: payload.annualRevenue === undefined ? undefined : payload.annualRevenue === null ? null : String(payload.annualRevenue),
          industry: payload.industry as string | null | undefined,
          billingCountry: payload.billingCountry as string | null | undefined,
          billingStreet: payload.billingStreet as string | null | undefined,
          billingPostalCode: payload.billingPostalCode as string | null | undefined,
          billingCity: payload.billingCity as string | null | undefined,
          billingState: payload.billingState as string | null | undefined,
          shippingCountry: payload.shippingCountry as string | null | undefined,
          shippingStreet: payload.shippingStreet as string | null | undefined,
          shippingPostalCode: payload.shippingPostalCode as string | null | undefined,
          shippingCity: payload.shippingCity as string | null | undefined,
          shippingState: payload.shippingState as string | null | undefined,
          updatedById: userId
        }
      });
    case "Contact":
      return prisma.contact.update({
        where: { id },
        data: {
          salutation: payload.salutation as string | null | undefined,
          firstName: payload.firstName as string | null | undefined,
          lastName: payload.lastName ? String(payload.lastName) : undefined,
          accountId: payload.accountId ? String(payload.accountId) : undefined,
          title: payload.title as string | null | undefined,
          reportsToContactId: payload.reportsToContactId as string | null | undefined,
          description: payload.description as string | null | undefined,
          phone: payload.phone as string | null | undefined,
          email: payload.email as string | null | undefined,
          birthDate: payload.birthDate === undefined ? undefined : payload.birthDate === null ? null : new Date(String(payload.birthDate)),
          leadSource: payload.leadSource as string | null | undefined,
          mailingCountry: payload.mailingCountry as string | null | undefined,
          mailingStreet: payload.mailingStreet as string | null | undefined,
          mailingPostalCode: payload.mailingPostalCode as string | null | undefined,
          mailingCity: payload.mailingCity as string | null | undefined,
          mailingState: payload.mailingState as string | null | undefined,
          updatedById: userId
        }
      });
    case "Lead":
      return prisma.lead.update({
        where: { id },
        data: {
          status: payload.status ? String(payload.status) : undefined,
          salutation: payload.salutation as string | null | undefined,
          firstName: payload.firstName as string | null | undefined,
          lastName: payload.lastName ? String(payload.lastName) : undefined,
          company: payload.company ? String(payload.company) : undefined,
          title: payload.title as string | null | undefined,
          website: payload.website as string | null | undefined,
          description: payload.description as string | null | undefined,
          ownerId: payload.ownerId ? String(payload.ownerId) : undefined,
          rating: payload.rating as string | null | undefined,
          phone: payload.phone as string | null | undefined,
          email: payload.email as string | null | undefined,
          country: payload.country as string | null | undefined,
          street: payload.street as string | null | undefined,
          postalCode: payload.postalCode as string | null | undefined,
          city: payload.city as string | null | undefined,
          state: payload.state as string | null | undefined,
          numberOfEmployees: payload.numberOfEmployees === undefined ? undefined : payload.numberOfEmployees === null ? null : Number(payload.numberOfEmployees),
          annualRevenue: payload.annualRevenue === undefined ? undefined : payload.annualRevenue === null ? null : String(payload.annualRevenue),
          leadSource: payload.leadSource as string | null | undefined,
          industry: payload.industry as string | null | undefined,
          updatedById: userId
        }
      });
    case "Opportunity":
      return prisma.opportunity.update({
        where: { id },
        data: {
          name: payload.name ? String(payload.name) : undefined,
          accountId: payload.accountId ? String(payload.accountId) : undefined,
          contactId: payload.contactId as string | null | undefined,
          closeDate: payload.closeDate ? new Date(String(payload.closeDate)) : undefined,
          amount: payload.amount === undefined ? undefined : payload.amount === null ? null : String(payload.amount),
          description: payload.description as string | null | undefined,
          ownerId: payload.ownerId ? String(payload.ownerId) : undefined,
          stage: payload.stage ? String(payload.stage) : undefined,
          probability: payload.probability === undefined ? undefined : payload.probability === null ? null : Number(payload.probability),
          forecastCategory: payload.forecastCategory ? String(payload.forecastCategory) : undefined,
          nextStep: payload.nextStep as string | null | undefined,
          leadSource: payload.leadSource as string | null | undefined,
          updatedById: userId
        }
      });
    case "Case":
      return prisma.caseRecord.update({
        where: { id },
        data: {
          status: payload.status ? String(payload.status) : undefined,
          origin: payload.origin as string | null | undefined,
          priority: payload.priority ? String(payload.priority) : undefined,
          ownerId: payload.ownerId ? String(payload.ownerId) : undefined,
          contactId: payload.contactId as string | null | undefined,
          accountId: payload.accountId as string | null | undefined,
          subject: payload.subject as string | null | undefined,
          description: payload.description as string | null | undefined,
          sendNotificationEmailToContact: payload.sendNotificationEmailToContact === undefined ? undefined : Boolean(payload.sendNotificationEmailToContact),
          closedAt: payload.status === undefined ? undefined : payload.status === "Closed" ? new Date() : null,
          updatedById: userId
        }
      });
    case "Product2":
      return prisma.product.update({
        where: { id },
        data: {
          name: payload.name ? String(payload.name) : undefined,
          family: payload.family as string | null | undefined,
          productCode: payload.productCode as string | null | undefined,
          sku: payload.sku as string | null | undefined,
          category: payload.category as string | null | undefined,
          active: payload.active === undefined ? undefined : Boolean(payload.active),
          description: payload.description as string | null | undefined
        }
      });
    case "Pricebook2":
      return prisma.priceBook.update({
        where: { id },
        data: {
          name: payload.name ? String(payload.name) : undefined,
          active: payload.active === undefined ? undefined : Boolean(payload.active),
          description: payload.description as string | null | undefined,
          isStandard: payload.isStandard === undefined ? undefined : Boolean(payload.isStandard),
          validFrom:
            payload.validFrom !== undefined || payload.validFromTime !== undefined
              ? combineDateAndTime(payload.validFrom, payload.validFromTime)
              : undefined,
          validTo:
            payload.validTo !== undefined || payload.validToTime !== undefined
              ? combineDateAndTime(payload.validTo, payload.validToTime)
              : undefined
        }
      });
    case "Event":
      return prisma.event.update({ where: { id }, data: eventUpdateData(payload) });
    case "QuickText":
      return prisma.quickText.update({
        where: { id },
        data: {
          name: payload.name ? String(payload.name) : undefined,
          message: payload.message ? String(payload.message) : undefined,
          folderId: payload.folderId as string | null | undefined,
          category: payload.category ? String(payload.category) : undefined,
          channels: Array.isArray(payload.channels) ? payload.channels.map(String) : undefined,
          mergeFields: Array.isArray(payload.mergeFields) ? payload.mergeFields.map(String) : undefined
        }
      });
    case "ListEmail": {
      const listEmailStatus = payload.status ? String(payload.status) : undefined;
      return prisma.listEmail.update({
        where: { id },
        data: {
          layoutType: payload.layoutType ? String(payload.layoutType) : undefined,
          subject: payload.subject as string | null | undefined,
          body: payload.body as string | null | undefined,
          recipientType: payload.recipientType as string | null | undefined,
          recipients: Array.isArray(payload.recipients) ? payload.recipients.map(String) : undefined,
          status: listEmailStatus,
          sentAt: listEmailStatus === "Sent" ? new Date() : undefined,
          scheduledAt: listEmailStatus === "Sent" ? null : payload.scheduledAt ? new Date(String(payload.scheduledAt)) : payload.scheduledAt === null ? null : undefined
        }
      });
    }
    case "Knowledge__kav":
      return prisma.knowledgeArticle.update({
        where: { id },
        data: {
          title: payload.title ? String(payload.title) : undefined,
          urlName: payload.urlName ? String(payload.urlName) : undefined,
          summary: payload.summary as string | null | undefined,
          bodyRichText: payload.bodyRichText as string | null | undefined,
          visibleInInternalApp: payload.visibleInInternalApp === undefined ? undefined : Boolean(payload.visibleInInternalApp),
          visibleToCustomer: payload.visibleToCustomer === undefined ? undefined : Boolean(payload.visibleToCustomer),
          updatedById: userId
        }
      });
    default:
      throw new Error(`Update is not supported for ${object}`);
  }
}

async function deleteRecord(object: CrmObject, id: string) {
  switch (object) {
    case "Account":
      return prisma.account.delete({ where: { id } });
    case "Contact":
      return prisma.contact.delete({ where: { id } });
    case "Lead":
      return prisma.lead.delete({ where: { id } });
    case "Opportunity":
      return prisma.opportunity.delete({ where: { id } });
    case "Case":
      return prisma.caseRecord.delete({ where: { id } });
    case "Product2":
      return prisma.product.delete({ where: { id } });
    case "Pricebook2":
      return prisma.priceBook.delete({ where: { id } });
    case "Event":
      return prisma.event.delete({ where: { id } });
    case "QuickText":
      return prisma.quickText.delete({ where: { id } });
    case "Knowledge__kav":
      return prisma.knowledgeArticle.delete({ where: { id } });
    case "ListEmail":
      return prisma.listEmail.delete({ where: { id } });
    default:
      throw new Error(`Delete is not supported for ${object}`);
  }
}

function combineDateAndTime(dateValue: unknown, timeValue: unknown) {
  if (dateValue === null) return null;
  if (!dateValue) return null;
  const date = String(dateValue);
  if (date.includes("T")) return new Date(date);
  const time = String(timeValue || "00:00").slice(0, 5);
  return new Date(`${date}T${time}:00.000Z`);
}
