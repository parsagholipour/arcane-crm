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

export type ShipmentAnnouncementKind = "delivered" | "exception" | "postDeliveryFollowUp";

/** How long after delivery before Opportunity owners get a one-time follow-up nudge. */
export const OPPORTUNITY_POST_DELIVERY_FOLLOW_UP_DAYS = 7;

/** Stored on the tracking row when nobody can be notified, so the cron does not retry forever. */
export const SHIPMENT_NOTIFICATION_SKIPPED = "skipped";

export function opportunityPostDeliveryFollowUpIsDue(deliveredAt: Date | null, now: Date) {
  if (!deliveredAt) return false;
  const dueAt = new Date(
    deliveredAt.getTime() + OPPORTUNITY_POST_DELIVERY_FOLLOW_UP_DAYS * 24 * 60 * 60 * 1000
  );
  return dueAt <= now;
}

function notificationCopy(
  tracking: ShipmentTracking,
  recipient: ShipmentRecipient,
  kind: ShipmentAnnouncementKind
) {
  if (kind === "postDeliveryFollowUp") {
    return {
      title: "Follow up after delivery",
      body: `${recipient.subjectLabel} was delivered ${OPPORTUNITY_POST_DELIVERY_FOLLOW_UP_DAYS} days ago — a good time to follow up.`,
      delivered: true as const,
      followUp: true as const
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
    followUp: false as const
  };
}

async function emailRecipient(
  tracking: ShipmentTracking,
  recipient: ShipmentRecipient,
  kind: ShipmentAnnouncementKind,
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
    followUp: copy.followUp,
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
