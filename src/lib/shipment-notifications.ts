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

function notificationBody(tracking: ShipmentTracking, recipient: ShipmentRecipient, delivered: boolean) {
  const summary = tracking.statusSummary?.trim();
  if (summary) return `${recipient.subjectLabel} — ${summary}`;
  const state = delivered ? "was delivered" : `is ${shipmentStatusLabel(tracking.status).toLowerCase()}`;
  return `${tracking.carrier} ${tracking.trackingNumber} ${state} (${recipient.subjectLabel}).`;
}

async function emailRecipient(
  tracking: ShipmentTracking,
  recipient: ShipmentRecipient,
  delivered: boolean,
  dependencies: ShipmentNotificationDependencies
) {
  if (!isValidEmail(recipient.email)) return;
  if (!dependencies.adapter && !emailDeliveryConfigured()) return;
  const template = shipmentStatusTemplate({
    organizationName: recipient.organizationName,
    carrier: tracking.carrier,
    trackingNumber: tracking.trackingNumber,
    subjectLabel: recipient.subjectLabel,
    statusLabel: shipmentStatusLabel(tracking.status),
    statusSummary: tracking.statusSummary,
    delivered,
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
 * Announce a shipment milestone once. The caller stamps the returned notification id onto
 * the tracking row, so a repeat poll of the same terminal state stays silent.
 *
 * Email is best-effort on purpose: the in-app notification is the primary channel here, and
 * a SendGrid outage must not stall the status update or trigger a poll retry.
 */
export async function announceShipmentStatus(
  tracking: ShipmentTracking,
  delivered: boolean,
  dependencies: ShipmentNotificationDependencies = {}
): Promise<string | null> {
  const recipient = await resolveShipmentRecipient(
    tracking.organizationId,
    tracking.subjectType as ShipmentSubjectType,
    tracking.subjectId
  );
  if (!recipient || !recipient.notifyInApp) return null;

  const notification = await prisma.notification.create({
    data: {
      organizationId: tracking.organizationId,
      userId: recipient.userId,
      title: delivered ? "Package delivered" : "Shipment needs attention",
      body: notificationBody(tracking, recipient, delivered),
      href: recipient.href,
      category: SHIPPING_CATEGORY,
      read: false
    }
  });

  try {
    await emailRecipient(tracking, recipient, delivered, dependencies);
  } catch (error) {
    console.error("[shipments] status email was not accepted", error);
  }

  return notification.id;
}
