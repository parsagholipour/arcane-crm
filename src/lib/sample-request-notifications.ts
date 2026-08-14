import "server-only";

import { prisma } from "@/lib/prisma";
import { emailDeliveryConfigured, isValidEmail } from "@/lib/email/service";
import { sampleRequestReminderTemplate } from "@/lib/email/templates";
import { sendTrackedEmail } from "@/lib/email/tracking";
import type { EmailAdapter } from "@/lib/email/types";
import { resolvePublicAppUrl } from "@/lib/public-app-url";
import {
  sampleRequestNeedsShipping,
  sampleRequestReminderIsDue,
  SAMPLE_STATUS_NEED_SHIPPING,
  startOfUtcDay
} from "@/lib/sample-request-status";
import {
  resolveShipmentRecipient,
  SHIPPING_CATEGORY,
  type ShipmentRecipient
} from "@/lib/shipment-tracking-recipients";

export type SampleRequestNotificationDependencies = {
  adapter?: EmailAdapter;
  senderEmail?: string;
  publicAppUrl?: string;
};

export type SampleRequestReminderSummary = {
  processed: number;
  notified: number;
  skipped: number;
};

/** Stored on the Lead when nobody can be notified, so the sweep does not retry forever. */
const SAMPLE_REQUEST_NOTIFICATION_SKIPPED = "skipped";
const SAMPLE_REQUEST_NOTIFICATION_PENDING = "pending";
const DEFAULT_BATCH_LIMIT = 50;
const MAX_BATCH_LIMIT = 200;

type SampleRequestLead = {
  id: string;
  organizationId: string;
  sampleRequestedDate: Date | null;
  sampleStatus: string | null;
  convertedAt: Date | null;
  sampleRequestedNotificationId: string | null;
};

type PreviousSampleFields = {
  sampleRequestedDate: Date | null;
  sampleStatus: string | null;
};

function sameOptionalInstant(left: Date | null | undefined, right: Date | null | undefined) {
  if (left == null && right == null) return true;
  if (left == null || right == null) return false;
  return left.getTime() === right.getTime();
}

function sampleFieldsChanged(lead: SampleRequestLead, previous?: PreviousSampleFields) {
  if (!previous) return false;
  return (
    !sameOptionalInstant(previous.sampleRequestedDate, lead.sampleRequestedDate) ||
    (previous.sampleStatus ?? null) !== (lead.sampleStatus ?? null)
  );
}

function asSampleRequestLead(record: unknown): SampleRequestLead | null {
  const row = record as Partial<SampleRequestLead> | null;
  if (!row || typeof row.id !== "string" || typeof row.organizationId !== "string") return null;
  const requestedAt =
    row.sampleRequestedDate instanceof Date
      ? row.sampleRequestedDate
      : row.sampleRequestedDate
        ? new Date(String(row.sampleRequestedDate))
        : null;
  return {
    id: row.id,
    organizationId: row.organizationId,
    sampleRequestedDate: requestedAt && Number.isFinite(requestedAt.getTime()) ? requestedAt : null,
    sampleStatus: row.sampleStatus == null ? null : String(row.sampleStatus),
    convertedAt: row.convertedAt ? new Date(String(row.convertedAt)) : null,
    sampleRequestedNotificationId:
      typeof row.sampleRequestedNotificationId === "string" ? row.sampleRequestedNotificationId : null
  };
}

function statusLabel(sampleStatus: string | null) {
  return sampleRequestNeedsShipping(sampleStatus) && String(sampleStatus ?? "").trim()
    ? SAMPLE_STATUS_NEED_SHIPPING
    : "None";
}

async function emailRecipient(
  lead: SampleRequestLead,
  recipient: ShipmentRecipient,
  dependencies: SampleRequestNotificationDependencies
) {
  if (!isValidEmail(recipient.email)) return;
  if (!dependencies.adapter && !emailDeliveryConfigured()) return;
  const requestedDate = lead.sampleRequestedDate ?? new Date();
  const template = sampleRequestReminderTemplate({
    organizationName: recipient.organizationName,
    subjectLabel: recipient.subjectLabel,
    sampleStatus: statusLabel(lead.sampleStatus),
    requestedDate,
    recordUrl: new URL(recipient.href, resolvePublicAppUrl(dependencies.publicAppUrl)).toString()
  });
  await sendTrackedEmail(
    { fromName: recipient.organizationName, to: [{ email: recipient.email, name: recipient.name }], ...template },
    {
      organizationId: lead.organizationId,
      userId: recipient.userId,
      sourceType: "Lead",
      sourceId: lead.id
    },
    dependencies
  );
}

/**
 * Atomically create and stamp the overdue-sample reminder. The temporary claim, Notification
 * insert, and final id are one transaction, so a crash cannot leave a permanent `pending`
 * marker or duplicate the in-app notification on the next sweep.
 *
 * Email remains best-effort after the commit: the durable in-app notification is the primary
 * channel, and a provider failure must not make a later sweep duplicate it.
 */
export async function announceOverdueSampleRequest(
  lead: SampleRequestLead,
  now: Date,
  dependencies: SampleRequestNotificationDependencies = {}
): Promise<string | null> {
  const recipient = await resolveShipmentRecipient(lead.organizationId, "Lead", lead.id);

  const notification = await prisma.$transaction(async (tx) => {
    const claimed = await tx.lead.updateMany({
      where: {
        id: lead.id,
        convertedAt: null,
        sampleRequestedNotificationId: null,
        sampleRequestedDate: { lt: startOfUtcDay(now) },
        OR: [{ sampleStatus: null }, { sampleStatus: SAMPLE_STATUS_NEED_SHIPPING }]
      },
      data: { sampleRequestedNotificationId: SAMPLE_REQUEST_NOTIFICATION_PENDING }
    });
    if (!claimed.count) return null;

    const current = await tx.lead.findUnique({ where: { id: lead.id } });
    if (
      !current ||
      current.convertedAt ||
      !sampleRequestReminderIsDue(current.sampleRequestedDate, current.sampleStatus, now)
    ) {
      const retryLater = Boolean(current && !current.convertedAt && sampleRequestNeedsShipping(current.sampleStatus));
      await tx.lead.update({
        where: { id: lead.id },
        data: { sampleRequestedNotificationId: retryLater ? null : SAMPLE_REQUEST_NOTIFICATION_SKIPPED }
      });
      return retryLater ? null : SAMPLE_REQUEST_NOTIFICATION_SKIPPED;
    }

    if (!recipient || !recipient.notifyInApp) {
      await tx.lead.update({
        where: { id: lead.id },
        data: { sampleRequestedNotificationId: SAMPLE_REQUEST_NOTIFICATION_SKIPPED }
      });
      return SAMPLE_REQUEST_NOTIFICATION_SKIPPED;
    }

    const created = await tx.notification.create({
      data: {
        organizationId: current.organizationId,
        userId: recipient.userId,
        title: "Sample still needs shipping",
        body: `${recipient.subjectLabel} — the sample requested date has passed and Sample Status is ${statusLabel(current.sampleStatus)}.`,
        href: recipient.href,
        category: SHIPPING_CATEGORY,
        read: false
      }
    });
    await tx.lead.update({
      where: { id: current.id },
      data: { sampleRequestedNotificationId: created.id }
    });
    return created;
  });

  if (!notification) return null;
  if (notification === SAMPLE_REQUEST_NOTIFICATION_SKIPPED) return SAMPLE_REQUEST_NOTIFICATION_SKIPPED;
  if (!recipient) return null;
  try {
    await emailRecipient(lead, recipient, dependencies);
  } catch (error) {
    console.error("[leads] sample request reminder email was not accepted", error);
  }
  return notification.id;
}

export async function announceDueSampleRequestReminders(
  options: {
    now?: Date;
    organizationId?: string;
    limit?: number;
    dependencies?: SampleRequestNotificationDependencies;
  } = {}
): Promise<SampleRequestReminderSummary> {
  const now = options.now ?? new Date();
  const limit = Math.max(1, Math.min(options.limit ?? DEFAULT_BATCH_LIMIT, MAX_BATCH_LIMIT));
  const dueBefore = startOfUtcDay(now);
  const summary: SampleRequestReminderSummary = { processed: 0, notified: 0, skipped: 0 };
  const candidates = await prisma.lead.findMany({
    where: {
      convertedAt: null,
      sampleRequestedNotificationId: null,
      sampleRequestedDate: { lt: dueBefore },
      OR: [{ sampleStatus: null }, { sampleStatus: SAMPLE_STATUS_NEED_SHIPPING }],
      ...(options.organizationId ? { organizationId: options.organizationId } : {})
    },
    orderBy: [{ sampleRequestedDate: "asc" }, { createdAt: "asc" }],
    take: limit
  });

  for (const candidate of candidates) {
    if (!sampleRequestReminderIsDue(candidate.sampleRequestedDate, candidate.sampleStatus, now)) continue;
    summary.processed += 1;
    try {
      const notificationId = await announceOverdueSampleRequest(candidate, now, options.dependencies ?? {});
      if (notificationId === SAMPLE_REQUEST_NOTIFICATION_SKIPPED) summary.skipped += 1;
      else if (notificationId) summary.notified += 1;
    } catch (error) {
      console.error("[leads] sample request reminder failed", error);
    }
  }

  return summary;
}

/**
 * After a Lead save: if Sample Requested Date or Sample Status changed, drop the one-time
 * stamp so a new date can notify again; then fire immediately when the row is already overdue.
 */
export async function syncLeadSampleRequestReminder(
  record: unknown,
  previous?: PreviousSampleFields,
  dependencies: SampleRequestNotificationDependencies = {},
  now = new Date()
) {
  const lead = asSampleRequestLead(record);
  if (!lead || lead.convertedAt) return null;
  if (sampleFieldsChanged(lead, previous) && lead.sampleRequestedNotificationId) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { sampleRequestedNotificationId: null }
    });
    lead.sampleRequestedNotificationId = null;
  }
  if (!sampleRequestReminderIsDue(lead.sampleRequestedDate, lead.sampleStatus, now)) return null;
  try {
    return await announceOverdueSampleRequest(lead, now, dependencies);
  } catch (error) {
    console.error("[leads] sample request reminder failed", error);
    return null;
  }
}
