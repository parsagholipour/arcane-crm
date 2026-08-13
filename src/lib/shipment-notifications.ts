import "server-only";

import type { ShipmentTracking } from "@prisma/client";
import { emailDeliveryConfigured, isValidEmail } from "@/lib/email/service";
import { shipmentStatusTemplate } from "@/lib/email/templates";
import { sendTrackedEmail } from "@/lib/email/tracking";
import type { EmailAdapter } from "@/lib/email/types";
import { prisma } from "@/lib/prisma";
import { resolvePublicAppUrl } from "@/lib/public-app-url";
import {
  resolveShipmentRecipient,
  SHIPPING_CATEGORY,
  type ShipmentRecipient
} from "@/lib/shipment-tracking-recipients";
import type { ShipmentSubjectType } from "@/lib/shipment-tracking-sync";
import { carrierTrackingUrl, shipmentStatusLabel } from "@/lib/usps-status";

export type ShipmentNotificationDependencies = {
  adapter?: EmailAdapter;
  senderEmail?: string;
  publicAppUrl?: string;
};

/** Milestones that can use the generic, non-follow-up announcement path. */
export type ShipmentAnnouncementKind = "delivered" | "exception";
type ShipmentNotificationKind = ShipmentAnnouncementKind | "postDeliveryFollowUp";

/** How long after delivery before the record owner gets a one-time follow-up nudge. */
export const POST_DELIVERY_FOLLOW_UP_DAYS = 7;

/** Subjects whose owners get the week-later nudge: sales shipments and Lead samples. */
export const POST_DELIVERY_FOLLOW_UP_SUBJECTS: ShipmentSubjectType[] = ["Opportunity", "Lead"];

/** Stored on the tracking row when nobody can be notified, so the cron does not retry forever. */
export const SHIPMENT_NOTIFICATION_SKIPPED = "skipped";
const SHIPMENT_NOTIFICATION_PENDING = "pending";

export function postDeliveryFollowUpIsDue(deliveredAt: Date | null, now: Date) {
  if (!deliveredAt) return false;
  const dueAt = new Date(deliveredAt.getTime() + POST_DELIVERY_FOLLOW_UP_DAYS * 24 * 60 * 60 * 1000);
  return dueAt <= now;
}

function notificationCopy(tracking: ShipmentTracking, recipient: ShipmentRecipient, kind: ShipmentNotificationKind) {
  if (kind === "postDeliveryFollowUp") {
    return {
      title: "Follow up after delivery",
      body: `At least ${POST_DELIVERY_FOLLOW_UP_DAYS} days have passed since ${recipient.subjectLabel} was delivered — a good time to follow up.`,
      delivered: true as const,
      followUpDays: POST_DELIVERY_FOLLOW_UP_DAYS
    };
  }
  const delivered = kind === "delivered";
  const summary = tracking.statusSummary?.trim();
  const state = delivered ? "was delivered" : `is ${shipmentStatusLabel(tracking.status).toLowerCase()}`;
  return {
    title: delivered ? "Package delivered" : "Shipment needs attention",
    body: summary
      ? `${recipient.subjectLabel} — ${summary}`
      : `${tracking.carrier} ${tracking.trackingNumber} ${state} (${recipient.subjectLabel}).`,
    delivered,
    followUpDays: undefined
  };
}

async function emailRecipient(
  tracking: ShipmentTracking,
  recipient: ShipmentRecipient,
  kind: ShipmentNotificationKind,
  dependencies: ShipmentNotificationDependencies
) {
  if (!isValidEmail(recipient.email)) return;
  if (!dependencies.adapter && !emailDeliveryConfigured()) return;
  const copy = notificationCopy(tracking, recipient, kind);
  const template = shipmentStatusTemplate({
    organizationName: recipient.organizationName,
    carrier: tracking.carrier,
    trackingNumber: tracking.trackingNumber,
    subjectLabel: recipient.subjectLabel,
    statusLabel: shipmentStatusLabel(tracking.status),
    statusSummary: tracking.statusSummary,
    delivered: copy.delivered,
    followUpDays: copy.followUpDays,
    recordUrl: new URL(recipient.href, resolvePublicAppUrl(dependencies.publicAppUrl)).toString(),
    carrierUrl: carrierTrackingUrl(tracking.carrier, tracking.trackingNumber)
  });
  await sendTrackedEmail(
    { fromName: recipient.organizationName, to: [{ email: recipient.email, name: recipient.name }], ...template },
    {
      organizationId: tracking.organizationId,
      userId: recipient.userId,
      sourceType: "ShipmentTracking",
      sourceId: tracking.id
    },
    dependencies
  );
}

/**
 * Announce a shipment milestone once. The caller stamps the returned id onto the tracking
 * row, so a repeat poll of the same terminal state stays silent. Returns
 * {@link SHIPMENT_NOTIFICATION_SKIPPED} when nobody should hear about it, so callers can still
 * mark the milestone handled.
 *
 * Email is best-effort on purpose: the in-app notification is the primary channel here, and
 * a SendGrid outage must not stall the status update or trigger a poll retry.
 */
export async function announceShipmentStatus(
  tracking: ShipmentTracking,
  kind: ShipmentAnnouncementKind,
  dependencies: ShipmentNotificationDependencies = {}
): Promise<string | null> {
  const recipient = await resolveShipmentRecipient(
    tracking.organizationId,
    tracking.subjectType as ShipmentSubjectType,
    tracking.subjectId
  );
  if (!recipient || !recipient.notifyInApp) return SHIPMENT_NOTIFICATION_SKIPPED;

  const copy = notificationCopy(tracking, recipient, kind);
  const notification = await prisma.notification.create({
    data: {
      organizationId: tracking.organizationId,
      userId: recipient.userId,
      title: copy.title,
      body: copy.body,
      href: recipient.href,
      category: SHIPPING_CATEGORY,
      read: false
    }
  });

  try {
    await emailRecipient(tracking, recipient, kind, dependencies);
  } catch (error) {
    console.error("[shipments] status email was not accepted", error);
  }

  return notification.id;
}

/**
 * Atomically create and stamp a subject's week-later notification. The temporary claim,
 * Notification insert, and final id are one transaction, so a crash cannot leave a permanent
 * `pending` marker or create a duplicate in-app notification on the next sweep.
 *
 * Email remains best-effort after the commit: the durable in-app notification is the primary
 * channel, and a provider failure must not make a later sweep duplicate it.
 */
export async function announcePostDeliveryFollowUp(
  tracking: ShipmentTracking,
  dependencies: ShipmentNotificationDependencies = {}
): Promise<string | null> {
  const recipient = await resolveShipmentRecipient(
    tracking.organizationId,
    tracking.subjectType as ShipmentSubjectType,
    tracking.subjectId
  );
  const copy = recipient ? notificationCopy(tracking, recipient, "postDeliveryFollowUp") : null;

  const notification = await prisma.$transaction(async (tx) => {
    const claimed = await tx.shipmentTracking.updateMany({
      where: {
        id: tracking.id,
        subjectType: { in: POST_DELIVERY_FOLLOW_UP_SUBJECTS },
        status: "Delivered",
        postDeliveryNotificationId: null
      },
      data: { postDeliveryNotificationId: SHIPMENT_NOTIFICATION_PENDING }
    });
    if (!claimed.count) return null;

    if (!recipient || !recipient.notifyInApp || !copy) {
      await tx.shipmentTracking.update({
        where: { id: tracking.id },
        data: { postDeliveryNotificationId: SHIPMENT_NOTIFICATION_SKIPPED }
      });
      return SHIPMENT_NOTIFICATION_SKIPPED;
    }

    const created = await tx.notification.create({
      data: {
        organizationId: tracking.organizationId,
        userId: recipient.userId,
        title: copy.title,
        body: copy.body,
        href: recipient.href,
        category: SHIPPING_CATEGORY,
        read: false
      }
    });
    await tx.shipmentTracking.update({
      where: { id: tracking.id },
      data: { postDeliveryNotificationId: created.id }
    });
    return created;
  });

  if (!notification) return null;
  if (notification === SHIPMENT_NOTIFICATION_SKIPPED) return SHIPMENT_NOTIFICATION_SKIPPED;
  if (!recipient) return null;
  try {
    await emailRecipient(tracking, recipient, "postDeliveryFollowUp", dependencies);
  } catch (error) {
    console.error("[shipments] post-delivery follow-up email was not accepted", error);
  }
  return notification.id;
}
