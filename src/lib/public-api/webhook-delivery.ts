import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { loadPublicLead, type PublicLead } from "@/lib/public-api/lead";
import type { PublicLeadDeleted } from "@/lib/public-api/lead-serialize";
import { decryptSecret } from "@/lib/secret-encryption";
import { signWebhookBody } from "@/lib/public-api/webhook-signature";
import {
  nextWebhookAttemptAt,
  shouldDisableWebhook,
  webhookAttemptsExhausted,
  WEBHOOK_CLAIM_MS,
  WEBHOOK_TIMEOUT_MS,
  type LeadWebhookEvent
} from "@/lib/public-api/webhook-policy";

export type LeadWebhookPayloadData = PublicLead | PublicLeadDeleted | { message: string; sentAt: string };

type WebhookEnvelope = {
  id: string;
  event: LeadWebhookEvent;
  createdAt: string;
  organizationId: string;
  data: LeadWebhookPayloadData;
};

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function webhookCredentials(organizationId: string, requireEnabled: boolean) {
  const access = await prisma.organizationApiAccess.findUnique({ where: { organizationId } });
  if (!access?.webhookUrl || !access.webhookSecretCipher) return null;
  if (requireEnabled && !access.webhookEnabled) return null;
  const secret = decryptSecret(access.webhookSecretCipher);
  if (!secret) return null;
  return { ...access, secret };
}

export async function enqueueLeadWebhookEvent(input: {
  organizationId: string;
  event: LeadWebhookEvent;
  leadId: string | null;
  data: LeadWebhookPayloadData;
  requireEnabled?: boolean;
}) {
  const access = await webhookCredentials(input.organizationId, input.requireEnabled !== false);
  if (!access) return null;

  const createdAt = new Date();
  const delivery = await prisma.organizationWebhookDelivery.create({
    data: {
      organizationId: input.organizationId,
      event: input.event,
      leadId: input.leadId,
      payload: jsonClone({
        event: input.event,
        createdAt: createdAt.toISOString(),
        organizationId: input.organizationId,
        data: input.data
      }) as Prisma.InputJsonValue,
      status: "pending",
      nextAttemptAt: createdAt
    }
  });
  return delivery.id;
}

function envelopeFor(delivery: {
  id: string;
  event: string;
  organizationId: string;
  createdAt: Date;
  payload: Prisma.JsonValue;
}): WebhookEnvelope {
  const stored =
    delivery.payload && typeof delivery.payload === "object" ? (delivery.payload as WebhookEnvelope) : null;
  return {
    id: delivery.id,
    event: delivery.event as LeadWebhookEvent,
    createdAt: stored?.createdAt ?? delivery.createdAt.toISOString(),
    organizationId: delivery.organizationId,
    data: stored?.data ?? ({} as LeadWebhookPayloadData)
  };
}

async function markAttemptFailure(
  deliveryId: string,
  organizationId: string,
  attempts: number,
  lastError: string,
  responseStatus: number | null,
  now: Date
) {
  const exhausted = webhookAttemptsExhausted(attempts);
  await prisma.organizationWebhookDelivery.update({
    where: { id: deliveryId },
    data: {
      attempts,
      lastError,
      responseStatus,
      status: exhausted ? "failed" : "pending",
      nextAttemptAt: exhausted ? now : nextWebhookAttemptAt(attempts, now)
    }
  });

  const access = await prisma.organizationApiAccess.update({
    where: { organizationId },
    data: {
      webhookLastError: lastError,
      webhookFailureCount: { increment: 1 }
    },
    select: { webhookFailureCount: true }
  });
  if (shouldDisableWebhook(access.webhookFailureCount)) {
    await prisma.organizationApiAccess.update({
      where: { organizationId },
      data: { webhookEnabled: false, webhookLastError: lastError }
    });
  }
}

async function markAttemptSuccess(deliveryId: string, organizationId: string, responseStatus: number, now: Date) {
  await prisma.$transaction([
    prisma.organizationWebhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: "delivered",
        responseStatus,
        lastError: null,
        deliveredAt: now
      }
    }),
    prisma.organizationApiAccess.update({
      where: { organizationId },
      data: {
        webhookFailureCount: 0,
        webhookLastError: null,
        webhookLastDeliveredAt: now
      }
    })
  ]);
}

export async function attemptLeadWebhookDelivery(deliveryId: string, now = new Date()) {
  const delivery = await prisma.organizationWebhookDelivery.findUnique({ where: { id: deliveryId } });
  if (!delivery || delivery.status !== "pending" || delivery.nextAttemptAt > now) {
    return { skipped: true as const };
  }

  const claimed = await prisma.organizationWebhookDelivery.updateMany({
    where: { id: deliveryId, status: "pending", nextAttemptAt: { lte: now } },
    data: { nextAttemptAt: new Date(now.getTime() + WEBHOOK_CLAIM_MS), attempts: { increment: 1 } }
  });
  if (claimed.count === 0) return { skipped: true as const };

  const claimedDelivery = await prisma.organizationWebhookDelivery.findUnique({ where: { id: deliveryId } });
  if (!claimedDelivery) return { skipped: true as const };

  const access = await webhookCredentials(claimedDelivery.organizationId, claimedDelivery.event !== "webhook.test");
  if (!access) {
    await prisma.organizationWebhookDelivery.update({
      where: { id: deliveryId },
      data: { nextAttemptAt: nextWebhookAttemptAt(claimedDelivery.attempts, now) }
    });
    return { skipped: true as const };
  }

  const envelope = envelopeFor(claimedDelivery);
  envelope.id = claimedDelivery.id;
  const rawBody = JSON.stringify(envelope);
  const signed = signWebhookBody(rawBody, access.secret, Math.floor(now.getTime() / 1000));

  try {
    const response = await fetch(access.webhookUrl!, {
      method: "POST",
      redirect: "manual",
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "CRM-Webhooks/1.0",
        "X-CRM-Event": envelope.event,
        "X-CRM-Delivery": envelope.id,
        "X-CRM-Timestamp": String(signed.timestampSeconds),
        "X-CRM-Signature": signed.header
      },
      body: rawBody
    });
    if (response.status >= 200 && response.status < 300) {
      await markAttemptSuccess(deliveryId, claimedDelivery.organizationId, response.status, now);
      return { delivered: true as const, status: response.status };
    }
    const lastError = `Receiver returned HTTP ${response.status}.`;
    await markAttemptFailure(
      deliveryId,
      claimedDelivery.organizationId,
      claimedDelivery.attempts,
      lastError,
      response.status,
      now
    );
    return { delivered: false as const, status: response.status, error: lastError };
  } catch (error) {
    const lastError = error instanceof Error ? error.message : "Webhook delivery failed.";
    await markAttemptFailure(
      deliveryId,
      claimedDelivery.organizationId,
      claimedDelivery.attempts,
      lastError,
      null,
      now
    );
    return { delivered: false as const, status: null, error: lastError };
  }
}

export async function dispatchDueLeadWebhooks(now = new Date(), limit = 50) {
  const due = await prisma.organizationWebhookDelivery.findMany({
    where: {
      status: "pending",
      nextAttemptAt: { lte: now },
      organization: { status: "ACTIVE", apiAccess: { webhookEnabled: true } }
    },
    orderBy: { nextAttemptAt: "asc" },
    take: limit,
    select: { id: true }
  });

  let delivered = 0;
  let failed = 0;
  let skipped = 0;
  for (const row of due) {
    const result = await attemptLeadWebhookDelivery(row.id, now);
    if ("skipped" in result && result.skipped) skipped += 1;
    else if ("delivered" in result && result.delivered) delivered += 1;
    else failed += 1;
  }
  return { considered: due.length, delivered, failed, skipped };
}

export async function enqueueAndLoadLeadEvent(
  organizationId: string,
  event: Exclude<LeadWebhookEvent, "webhook.test" | "lead.deleted">,
  leadId: string
) {
  const data = await loadPublicLead(organizationId, leadId);
  return enqueueLeadWebhookEvent({ organizationId, event, leadId, data });
}

export async function sendLeadWebhookTest(organizationId: string, now = new Date()) {
  const sentAt = now.toISOString();
  const deliveryId = await enqueueLeadWebhookEvent({
    organizationId,
    event: "webhook.test",
    leadId: null,
    data: { message: "Webhook test from CRM", sentAt },
    requireEnabled: false
  });
  if (!deliveryId) {
    return {
      queued: false as const,
      delivered: false,
      status: null as number | null,
      error: "Save a webhook URL before sending a test."
    };
  }
  const result = await attemptLeadWebhookDelivery(deliveryId, now);
  if ("skipped" in result && result.skipped) {
    return {
      queued: true as const,
      delivered: false,
      status: null as number | null,
      error: "The test delivery could not be sent."
    };
  }
  return {
    queued: true as const,
    delivered: Boolean(result.delivered),
    status: result.status,
    error: "error" in result ? result.error : null
  };
}
