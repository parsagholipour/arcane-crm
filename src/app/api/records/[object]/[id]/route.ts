import {
  AppAuthorizationError,
  authorizationErrorResponse,
  requireOrganizationContext
} from "@/lib/organization-context";
import { EmailValidationError } from "@/lib/email/errors";
import { emailErrorResponse } from "@/lib/email/http";
import { deliverCaseNotification, deliverListEmail } from "@/lib/email/workflows";
import { prisma } from "@/lib/prisma";
import { RecordPayloadValidationError, validateRecordPayload } from "@/lib/record-validation";
import { deleteShipmentTracking, syncOpportunityShipment } from "@/lib/shipment-tracking-sync";
import {
  calendarErrorResponse,
  detachOccurrence,
  eventUpdateData,
  excludeOccurrence,
  parseRecurrenceScope,
  validateEventReminderMinutes
} from "@/lib/calendar-events";
import type { CrmObject, RecordData } from "@/lib/crm-types";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { apiErrorResponse, apiFailure, apiSuccess } from "@/lib/api/response";
import { isCrmObject as isRouteCrmObject } from "@/features/routing/lightning-route";
import { getRecordDetail } from "@/server/records/get-record-detail";
import {
  assertScopedRecord,
  deleteRecord,
  updateRecord,
  validateRecordReferences
} from "@/server/records/mutate-record";

type Params = Promise<{ object: string; id: string }>;

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: { params: Params }) {
  try {
    const authContext = await requireOrganizationContext();
    const { object, id } = await context.params;
    if (!isRouteCrmObject(object)) {
      return apiFailure({ code: "NOT_FOUND", message: "Unknown object." }, 404);
    }
    return apiSuccess(await getRecordDetail(authContext.organizationId, object, id));
  } catch (error) {
    return apiErrorResponse(error, "Unable to load the record.");
  }
}

export async function PATCH(request: NextRequest, context: { params: Params }) {
  try {
    const authContext = await requireOrganizationContext();
    const { object, id } = await context.params;
    if (!isCrmObject(object)) return NextResponse.json({ error: "Unknown object." }, { status: 404 });
    await assertScopedRecord(object, id, authContext.organizationId);
    if (object === "Lead") {
      const lead = await prisma.lead.findFirst({
        where: { id, organizationId: authContext.organizationId },
        select: { convertedAt: true }
      });
      if (lead?.convertedAt)
        return NextResponse.json(
          { error: "Converted Leads are read-only. Open the converted Account, Contact, or Opportunity instead." },
          { status: 409 }
        );
    }
    const payload = normalizePayload(await request.json());
    validateRecordPayload(object, payload);
    await validateRecordReferences(payload, authContext.organizationId, authContext.userId);
    if (object === "Event") {
      if (payload.reminderMinutes !== undefined)
        payload.reminderMinutes = validateEventReminderMinutes(payload.reminderMinutes);
      const existingEvent = await prisma.event.findFirst({
        where: { id, organizationId: authContext.organizationId },
        select: { startAt: true, endAt: true }
      });
      if (!existingEvent) return NextResponse.json({ error: "Record not found." }, { status: 404 });
      const startAt = payload.startAt ? new Date(String(payload.startAt)) : existingEvent.startAt;
      const endAt = payload.endAt ? new Date(String(payload.endAt)) : existingEvent.endAt;
      if (!Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime()))
        return NextResponse.json({ error: "Choose valid event start and end times." }, { status: 400 });
      if (endAt <= startAt)
        return NextResponse.json({ error: "Event end time must be after its start time." }, { status: 400 });

      // "This occurrence only" carves the slot out of the series into its own row.
      if (parseRecurrenceScope(payload.recurrenceScope) === "single") {
        const detached = await detachOccurrence(
          authContext.organizationId,
          id,
          payload.occurrenceStart,
          eventUpdateData(payload)
        );
        if (detached)
          return NextResponse.json({
            record: JSON.parse(JSON.stringify(detached)),
            message: "This occurrence was updated."
          });
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
          subject: payload.subject === undefined ? existing.subject : (payload.subject as string | null),
          description: payload.description === undefined ? existing.description : (payload.description as string | null)
        });
      }
    }
    if (object === "ListEmail") {
      const existing = await prisma.listEmail.findFirst({ where: { id, organizationId: authContext.organizationId } });
      if (!existing) throw new AppAuthorizationError("Record not found.", 404);
      if (existing.status !== "Draft")
        return NextResponse.json({ error: "Sent or scheduled list emails cannot be changed." }, { status: 409 });
      if (payload.status) {
        const status = String(payload.status);
        if (!["Draft", "Sent", "Scheduled"].includes(status))
          throw new EmailValidationError("Invalid list email status.");
        if (status === "Sent" || status === "Scheduled") {
          if (status === "Scheduled" && !(payload.scheduledAt ?? existing.scheduledAt))
            throw new EmailValidationError("Choose a schedule date and time.");
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
      const article = await prisma.knowledgeArticle.findFirst({
        where: { id, organizationId: authContext.organizationId },
        select: { publicationStatus: true }
      });
      if (article?.publicationStatus !== "Draft")
        return NextResponse.json(
          { error: "Only Draft Knowledge articles can be edited. Restore an archived article to Draft first." },
          { status: 409 }
        );
    }
    const record = await updateRecord(object, id, payload, authContext.userId);
    if (object === "Opportunity") await syncOpportunityShipment(authContext.organizationId, record);
    const recordStatus = "status" in record ? String(record.status) : "";
    const skipped = delivery && "skipped" in delivery && Array.isArray(delivery.skipped) ? delivery.skipped.length : 0;
    const message =
      object === "ListEmail" && recordStatus === "Sent"
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
      ...(skipped
        ? {
            warning: `${message ?? "Email accepted."} ${skipped} selected record${skipped === 1 ? " was" : "s were"} skipped because no deliverable address was available.`
          }
        : {})
    });
  } catch (error) {
    console.error(error);
    const response = authorizationErrorResponse(error);
    if (response) return response;
    const deliveryResponse = emailErrorResponse(error);
    if (deliveryResponse) return deliveryResponse;
    if (error instanceof RecordPayloadValidationError)
      return NextResponse.json({ error: error.message, fields: error.fields }, { status: 400 });
    const calendarError = calendarErrorResponse(error);
    if (calendarError)
      return NextResponse.json(
        { error: calendarError.error, field: calendarError.field },
        { status: calendarError.status }
      );
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      return NextResponse.json(
        { error: "A record with that unique name or identifier already exists." },
        { status: 409 }
      );
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
      const excluded = await excludeOccurrence(
        authContext.organizationId,
        id,
        request.nextUrl.searchParams.get("occurrenceStart")
      );
      if (excluded) return NextResponse.json({ ok: true, message: "This occurrence was removed." });
    }
    if (object === "ListEmail") {
      const listEmail = await prisma.listEmail.findFirst({
        where: { id, organizationId: authContext.organizationId },
        select: { status: true }
      });
      if (listEmail?.status !== "Draft")
        return NextResponse.json({ error: "Sent or scheduled list emails cannot be deleted." }, { status: 409 });
    }
    if (object === "Lead") {
      const lead = await prisma.lead.findFirst({
        where: { id, organizationId: authContext.organizationId },
        select: { convertedAt: true }
      });
      if (lead?.convertedAt) return NextResponse.json({ error: "Converted Leads cannot be deleted." }, { status: 409 });
    }
    if (object === "Knowledge__kav") {
      const article = await prisma.knowledgeArticle.findFirst({
        where: { id, organizationId: authContext.organizationId },
        select: { publicationStatus: true }
      });
      if (article?.publicationStatus !== "Draft")
        return NextResponse.json(
          {
            error:
              "Only Draft Knowledge articles can be deleted from the record page. Archive published articles instead."
          },
          { status: 409 }
        );
    }
    if (object === "Product2") {
      const usage = await prisma.product.findFirst({
        where: { id, organizationId: authContext.organizationId },
        select: {
          poAppProductId: true,
          _count: {
            select: {
              invoiceLineItems: true,
              commerceOrderLines: true,
              inventoryItems: true,
              opportunityProducts: true
            }
          }
        }
      });
      // Deleting a synced product only makes it reappear on the next sync.
      if (usage?.poAppProductId)
        return NextResponse.json(
          {
            error:
              "A Product synced from PO App cannot be deleted here. Deactivate it, or remove it in PO App and run a full resync."
          },
          { status: 409 }
        );
      if (
        usage &&
        (usage._count.invoiceLineItems ||
          usage._count.commerceOrderLines ||
          usage._count.inventoryItems ||
          usage._count.opportunityProducts)
      )
        return NextResponse.json(
          {
            error:
              "A Product used by an invoice, order, inventory, or opportunity record cannot be deleted. Deactivate it instead."
          },
          { status: 409 }
        );
    }
    if (object === "Pricebook2") {
      const connectedStores = await prisma.marketingStore.count({
        where: { organizationId: authContext.organizationId, priceBookId: id }
      });
      if (connectedStores)
        return NextResponse.json(
          { error: "A Price Book connected to a Store cannot be deleted. Disconnect or archive the Store first." },
          { status: 409 }
        );
    }
    await deleteRecord(object, id);
    if (object === "Opportunity") await deleteShipmentTracking(authContext.organizationId, "Opportunity", id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    const response = authorizationErrorResponse(error);
    if (response) return response;
    const calendarError = calendarErrorResponse(error);
    if (calendarError)
      return NextResponse.json(
        { error: calendarError.error, field: calendarError.field },
        { status: calendarError.status }
      );
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2003", "P2014"].includes(error.code)) {
      return NextResponse.json(
        { error: "This record cannot be deleted because related CRM records still reference it." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Unable to delete record." }, { status: 500 });
  }
}

function isCrmObject(value: string): value is CrmObject {
  return [
    "Account",
    "Contact",
    "Lead",
    "Opportunity",
    "Product2",
    "Pricebook2",
    "Event",
    "Case",
    "QuickText",
    "Knowledge__kav",
    "ListEmail"
  ].includes(value);
}

function normalizePayload(payload: RecordData) {
  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => {
      if (value === "--None--" || value === "") return [key, null];
      return [key, value];
    })
  ) as RecordData;
}
