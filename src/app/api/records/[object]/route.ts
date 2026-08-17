import {
  AppAuthorizationError,
  assertOrganizationRecord,
  assertOrganizationUser,
  assertRelatedOrganizationRecord,
  authorizationErrorResponse,
  requireOrganizationContext
} from "@/lib/organization-context";
import { EmailValidationError } from "@/lib/email/errors";
import { emailErrorResponse } from "@/lib/email/http";
import { deliverCaseNotification, deliverListEmail } from "@/lib/email/workflows";
import { attachTrackedDeliveries } from "@/lib/email/tracking";
import { DEFAULT_EVENT_REMINDER_MINUTES } from "@/lib/calendar-reminder-values";
import { calendarErrorResponse, validateEventReminderMinutes } from "@/lib/calendar-events";
import { prisma } from "@/lib/prisma";
import { emitLeadCreated } from "@/lib/public-api/emit";
import { assertLeadIdentityFields, RecordPayloadValidationError, validateRecordPayload } from "@/lib/record-validation";
import { syncLeadSampleRequestReminder } from "@/lib/sample-request-notifications";
import { syncRecordShipment } from "@/lib/shipment-tracking-sync";
import type { CrmObject, RecordData } from "@/lib/crm-types";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { listQuerySchema } from "@/lib/api/contracts";
import { apiErrorResponse, apiFailure, apiSuccess } from "@/lib/api/response";
import { listRecords, RecordListQueryError } from "@/server/records/list-records";
import { allocateCaseNumber, createRecord } from "@/server/records/create-record";
import { isCrmObject as isRouteCrmObject } from "@/features/routing/lightning-route";

type Params = Promise<{ object: string }>;

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Params }) {
  try {
    const authContext = await requireOrganizationContext();
    const { object } = await context.params;
    if (!isRouteCrmObject(object)) {
      return apiFailure({ code: "NOT_FOUND", message: "Unknown object." }, 404);
    }
    const query = listQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    return apiSuccess(await listRecords(authContext.organizationId, authContext.userId, object, query));
  } catch (error) {
    if (error instanceof RecordListQueryError) {
      return apiFailure({ code: "INVALID_LIST_QUERY", message: error.message }, 400);
    }
    return apiErrorResponse(error, "Unable to load records.");
  }
}

export async function POST(request: NextRequest, context: { params: Params }) {
  try {
    const authContext = await requireOrganizationContext();
    const { object } = await context.params;
    if (!isCrmObject(object)) return NextResponse.json({ error: "Unknown object." }, { status: 404 });
    const payload = normalizePayload(await request.json());
    const missingFields = requiredFieldsForObject(object).filter((field) => isBlankRequiredValue(payload[field]));
    if (missingFields.length > 0)
      return NextResponse.json({ error: "Complete this field.", fields: missingFields }, { status: 400 });
    validateRecordPayload(object, payload);
    if (object === "Lead") assertLeadIdentityFields(payload);
    if (object === "Event") {
      const startAt = new Date(String(payload.startAt));
      const endAt = new Date(String(payload.endAt));
      if (!Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime()))
        return NextResponse.json({ error: "Choose valid event start and end times." }, { status: 400 });
      if (endAt <= startAt)
        return NextResponse.json({ error: "Event end time must be after its start time." }, { status: 400 });
      payload.reminderMinutes =
        payload.reminderMinutes === undefined
          ? DEFAULT_EVENT_REMINDER_MINUTES
          : validateEventReminderMinutes(payload.reminderMinutes);
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
      if (!["Draft", "Sent", "Scheduled"].includes(status))
        throw new EmailValidationError("Invalid list email status.");
      if (status === "Sent" || status === "Scheduled") {
        if (status === "Scheduled" && !payload.scheduledAt)
          throw new EmailValidationError("Choose a schedule date and time.");
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
    if (object === "Opportunity" || object === "Lead")
      await syncRecordShipment(authContext.organizationId, object, record);
    if (object === "Lead") await syncLeadSampleRequestReminder(record);
    if (object === "Lead") await emitLeadCreated(authContext.organizationId, String(record.id));
    if (delivery?.deliveryIds?.length && (object === "Case" || object === "ListEmail")) {
      await attachTrackedDeliveries(delivery.deliveryIds, {
        organizationId: authContext.organizationId,
        userId: authContext.userId,
        sourceType: object,
        sourceId: String(record.id)
      });
    }
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
    return NextResponse.json(
      {
        record: JSON.parse(JSON.stringify(record)),
        ...(delivery ? { delivery } : {}),
        ...(message ? { message } : {}),
        ...(skipped
          ? {
              warning: `${message ?? "Email accepted."} ${skipped} selected record${skipped === 1 ? " was" : "s were"} skipped because no deliverable address was available.`
            }
          : {})
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);
    const response = authorizationErrorResponse(error);
    if (response) return response;
    const deliveryResponse = emailErrorResponse(error);
    if (deliveryResponse) return deliveryResponse;
    const calendarResponse = calendarErrorResponse(error);
    if (calendarResponse)
      return NextResponse.json(
        { error: calendarResponse.error, field: calendarResponse.field },
        { status: calendarResponse.status }
      );
    if (error instanceof RecordPayloadValidationError)
      return NextResponse.json({ error: error.message, fields: error.fields }, { status: 400 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      return NextResponse.json(
        { error: "A record with that unique name or identifier already exists." },
        { status: 409 }
      );
    return NextResponse.json({ error: "Unable to create record." }, { status: 500 });
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

function requiredFieldsForObject(object: CrmObject) {
  switch (object) {
    case "Account":
      return ["name"];
    case "Contact":
      return ["lastName", "accountId"];
    case "Lead":
      return ["status"];
    case "Opportunity":
      return ["name", "accountId", "closeDate", "stage", "forecastCategory"];
    case "Product2":
      return ["name"];
    case "Pricebook2":
      return ["name"];
    case "Case":
      return ["status"];
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
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" || trimmed === "--None--";
  }
  return false;
}

async function validateReferences(object: CrmObject, payload: RecordData, organizationId: string, userId: string) {
  const ownerId = typeof payload.ownerId === "string" ? payload.ownerId : userId;
  if (["Account", "Contact", "Lead", "Opportunity", "Case"].includes(object))
    await assertOrganizationUser(organizationId, ownerId);
  if (object === "Event") await assertOrganizationUser(organizationId, String(payload.assignedToId ?? userId));
  if (object === "Event") {
    await assertRelatedOrganizationRecord(organizationId, payload.nameObjectType, payload.nameRecordId);
    await assertRelatedOrganizationRecord(organizationId, payload.relatedObjectType, payload.relatedRecordId);
    if (payload.calendarSourceId) {
      const source = await prisma.calendarSource.findFirst({
        where: { id: String(payload.calendarSourceId), organizationId, userId },
        select: { id: true }
      });
      if (!source) throw new AppAuthorizationError("Calendar not found.", 404);
    }
  }
  if (payload.accountId) await assertOrganizationRecord(organizationId, "account", String(payload.accountId));
  if (payload.contactId) await assertOrganizationRecord(organizationId, "contact", String(payload.contactId));
  if (payload.parentAccountId)
    await assertOrganizationRecord(organizationId, "account", String(payload.parentAccountId));
  if (payload.reportsToContactId)
    await assertOrganizationRecord(organizationId, "contact", String(payload.reportsToContactId));
  if (object === "Product2" && payload.priceBookId)
    await assertOrganizationRecord(organizationId, "priceBook", String(payload.priceBookId));
  if (object === "QuickText" && payload.folderId) {
    const folder = await prisma.quickTextFolder.findFirst({ where: { id: String(payload.folderId), organizationId } });
    if (!folder) throw new AppAuthorizationError("Folder not found.", 404);
  }
}
