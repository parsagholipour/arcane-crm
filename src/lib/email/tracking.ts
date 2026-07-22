import "server-only";

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import EventWebhookPackage from "@sendgrid/eventwebhook";
import { normalizeEmailAddress, sendConfiguredEmail, type ConfiguredOutboundEmail } from "@/lib/email/service";
import type { EmailAdapter, EmailSendResult } from "@/lib/email/types";
import { prisma } from "@/lib/prisma";

export const SENDGRID_TRACKING_ARGUMENT = "crm_email_batch_id";

export type EmailTrackingContext = {
  organizationId: string;
  userId: string;
  sourceType: string;
  sourceId?: string | null;
};

export type TrackedEmailResult = EmailSendResult & {
  trackingKey: string;
  deliveryIds: string[];
};

export async function sendTrackedEmail(
  message: ConfiguredOutboundEmail,
  tracking: EmailTrackingContext,
  dependencies: { adapter?: EmailAdapter; senderEmail?: string } = {}
): Promise<TrackedEmailResult> {
  const trackingKey = randomUUID();
  const delivery = await sendConfiguredEmail({
    ...message,
    customArgs: { ...message.customArgs, [SENDGRID_TRACKING_ARGUMENT]: trackingKey }
  }, dependencies);
  const sender = normalizeEmailAddress(dependencies.senderEmail ?? process.env.SENDGRID_EMAIL ?? "");
  const status = message.scheduledAt ? "Scheduled" : "Accepted";
  const rows = await prisma.$transaction(message.to.map((recipient) => prisma.emailDelivery.create({
    data: {
      organizationId: tracking.organizationId,
      trackingKey,
      provider: delivery.provider,
      providerMessageId: delivery.messageId ?? null,
      sourceType: tracking.sourceType,
      sourceId: tracking.sourceId ?? null,
      recipient: normalizeEmailAddress(recipient.email),
      sender,
      subject: message.subject.trim(),
      status,
      recordedById: tracking.userId,
      scheduledAt: message.scheduledAt ?? null,
      acceptedAt: delivery.acceptedAt
    }
  })));
  return { ...delivery, trackingKey, deliveryIds: rows.map((row) => row.id) };
}

export async function attachTrackedDeliveries(deliveryIds: string[] | undefined, tracking: EmailTrackingContext) {
  if (!deliveryIds?.length || !tracking.sourceId) return;
  await prisma.emailDelivery.updateMany({
    where: { id: { in: deliveryIds }, organizationId: tracking.organizationId, recordedById: tracking.userId },
    data: { sourceType: tracking.sourceType, sourceId: tracking.sourceId }
  });
}

const STATUS_RANK: Record<string, number> = {
  Scheduled: 10,
  Accepted: 10,
  Processing: 20,
  Deferred: 30,
  Delivered: 50,
  Bounced: 60,
  Dropped: 60,
  "Spam Report": 60,
  Unsubscribed: 60
};

export function sendGridDeliveryState(eventType: unknown) {
  const event = String(eventType ?? "").trim().toLowerCase();
  if (event === "processed") return { status: "Processing", failed: false };
  if (event === "deferred") return { status: "Deferred", failed: false };
  if (event === "delivered") return { status: "Delivered", failed: false };
  if (event === "bounce") return { status: "Bounced", failed: true };
  if (event === "dropped") return { status: "Dropped", failed: true };
  if (event === "spamreport") return { status: "Spam Report", failed: true };
  if (event === "unsubscribe" || event === "group_unsubscribe") return { status: "Unsubscribed", failed: true };
  return null;
}

function webhookString(event: Record<string, unknown>, key: string) {
  const value = event[key];
  return typeof value === "string" ? value.trim() : value === null || value === undefined ? "" : String(value).trim();
}

function eventDate(value: unknown) {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000) : new Date();
}

export async function ingestSendGridEvents(events: unknown[]) {
  const results = { accepted: 0, duplicate: 0, unmatched: 0, invalid: 0 };
  for (const value of events.slice(0, 1000)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) { results.invalid += 1; continue; }
    const event = value as Record<string, unknown>;
    const trackingKey = webhookString(event, SENDGRID_TRACKING_ARGUMENT);
    const recipient = normalizeEmailAddress(webhookString(event, "email"));
    const eventType = webhookString(event, "event").toLowerCase();
    if (!trackingKey || !recipient || !eventType) { results.invalid += 1; continue; }
    const delivery = await prisma.emailDelivery.findFirst({ where: { trackingKey, recipient } });
    if (!delivery) { results.unmatched += 1; continue; }
    const providerEventId = webhookString(event, "sg_event_id") || null;
    if (providerEventId && await prisma.emailDeliveryEvent.findUnique({ where: { providerEventId }, select: { id: true } })) { results.duplicate += 1; continue; }
    const occurredAt = eventDate(event.timestamp);
    const reason = webhookString(event, "reason") || webhookString(event, "type") || null;
    const response = webhookString(event, "response") || null;
    const providerMessageId = webhookString(event, "sg_message_id") || null;
    const state = sendGridDeliveryState(eventType);
    try {
      await prisma.$transaction(async (tx) => {
        await tx.emailDeliveryEvent.create({
          data: {
            organizationId: delivery.organizationId,
            deliveryId: delivery.id,
            providerEventId,
            providerMessageId,
            eventType,
            occurredAt,
            reason,
            response,
            raw: event as Prisma.InputJsonObject
          }
        });
        const shouldAdvance = state && (STATUS_RANK[state.status] ?? 0) >= (STATUS_RANK[delivery.status] ?? 0);
        await tx.emailDelivery.update({
          where: { id: delivery.id },
          data: {
            providerMessageId: providerMessageId ?? delivery.providerMessageId,
            lastEventAt: occurredAt,
            lastReason: reason,
            ...(shouldAdvance ? {
              status: state.status,
              deliveredAt: state.status === "Delivered" ? occurredAt : delivery.deliveredAt,
              failedAt: state.failed ? occurredAt : delivery.failedAt
            } : {})
          }
        });
        if (delivery.sourceType === "MessagingMessage" && delivery.sourceId && state) {
          await tx.messagingMessage.updateMany({ where: { id: delivery.sourceId, organizationId: delivery.organizationId }, data: { status: state.status } });
        }
        if (state?.failed) {
          await tx.notification.create({
            data: {
              organizationId: delivery.organizationId,
              userId: delivery.recordedById,
              title: `Email ${state.status.toLowerCase()}`,
              body: `${delivery.subject} to ${delivery.recipient}${reason ? `: ${reason}` : "."}`,
              href: delivery.sourceId ? emailSourceHref(delivery.sourceType, delivery.sourceId) : "/lightning/page/home",
              category: "Email Delivery"
            }
          });
        }
      });
      results.accepted += 1;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") results.duplicate += 1;
      else throw error;
    }
  }
  return results;
}

function emailSourceHref(sourceType: string, sourceId: string) {
  const object = sourceType === "ListEmail" ? "ListEmail" : sourceType === "Invoice" ? "Invoice" : sourceType === "VideoCall" ? "VideoCall" : "";
  return object ? `/lightning/r/${object}/${sourceId}/view` : "/lightning/page/home";
}

export function verifySendGridWebhook(rawBody: string, signature: string, timestamp: string, publicKey: string) {
  try {
    const verifier = new EventWebhookPackage.EventWebhook();
    return verifier.verifySignature(verifier.convertPublicKeyToECDSA(publicKey), rawBody, signature, timestamp);
  } catch {
    return false;
  }
}
