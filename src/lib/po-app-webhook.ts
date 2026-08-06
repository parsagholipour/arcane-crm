import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { poAppProductSchema, parseTimestamp } from "@/lib/po-app-product";
import { deactivatePoAppProduct, ensureStandardPriceBook, upsertPoAppProduct } from "@/lib/po-app-upsert";
import { prisma } from "@/lib/prisma";

/**
 * Receiver for PO App product webhooks. Signature verification is mandatory: without it anyone
 * who learns the endpoint URL can post fake catalogue changes.
 */

/** Recommended replay window from docs/PO-API.md §10. */
export const PO_APP_SIGNATURE_TOLERANCE_SECONDS = 300;

const envelopeSchema = z
  .object({
    id: z.string().min(1),
    event: z.string().min(1),
    createdAt: z.string().nullish(),
    storeId: z.string().nullish(),
    data: z.unknown()
  })
  .passthrough();

const deletedSchema = z
  .object({
    id: z.string().min(1),
    sku: z.string().nullish(),
    name: z.string().nullish(),
    deletedAt: z.string().nullish()
  })
  .passthrough();

export type PoAppWebhookEnvelope = z.infer<typeof envelopeSchema>;

export function parsePoAppWebhookEnvelope(rawBody: string): PoAppWebhookEnvelope | null {
  try {
    const parsed = envelopeSchema.safeParse(JSON.parse(rawBody));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Verifies `t=<unix>,v1=<hex>` against HMAC-SHA256 of `<t>.<raw body>`.
 *
 * The header is matched by key name rather than position because a future scheme would add a
 * `v2` pair, and the body must be the raw bytes — re-serialising the JSON changes key order and
 * whitespace, and the signature would never match.
 */
export function verifyPoAppSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  { now = Date.now(), toleranceSeconds = PO_APP_SIGNATURE_TOLERANCE_SECONDS } = {}
) {
  if (!signatureHeader || !secret) return false;

  const parts = new Map(
    signatureHeader.split(",").map((part) => {
      const [key, ...rest] = part.trim().split("=");
      return [key, rest.join("=")] as const;
    })
  );

  const timestamp = Number(parts.get("t"));
  const provided = parts.get("v1");
  if (!Number.isFinite(timestamp) || !provided) return false;
  if (Math.abs(now / 1000 - timestamp) > toleranceSeconds) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
  const expectedBytes = Buffer.from(expected, "utf8");
  const providedBytes = Buffer.from(provided, "utf8");
  return expectedBytes.length === providedBytes.length && timingSafeEqual(expectedBytes, providedBytes);
}

export type PoAppDeliveryClaim = "claimed" | "duplicate";

/**
 * Delivery is at-least-once and the delivery id is stable across retries, so an insert conflict
 * is how a duplicate is detected. processedAt stays null until the handler finishes, which lets
 * a retry of an interrupted delivery run again instead of being swallowed.
 */
export async function claimPoAppDelivery(
  organizationId: string,
  envelope: PoAppWebhookEnvelope
): Promise<PoAppDeliveryClaim> {
  const existing = await prisma.poAppWebhookDelivery.findUnique({
    where: { id: envelope.id },
    select: { processedAt: true }
  });
  if (existing) return existing.processedAt ? "duplicate" : "claimed";
  try {
    await prisma.poAppWebhookDelivery.create({
      data: { id: envelope.id, organizationId, event: envelope.event }
    });
    return "claimed";
  } catch {
    // Lost a race with a concurrent retry of the same delivery; the other request owns it.
    return "duplicate";
  }
}

export async function markPoAppDeliveryProcessed(deliveryId: string) {
  await prisma.poAppWebhookDelivery.update({ where: { id: deliveryId }, data: { processedAt: new Date() } });
}

export type PoAppWebhookOutcome = "applied" | "deactivated" | "ignored";

export async function applyPoAppWebhookEvent(
  organizationId: string,
  envelope: PoAppWebhookEnvelope,
  storeId: string | null
): Promise<PoAppWebhookOutcome> {
  const now = new Date();

  if (envelope.event === "product.created" || envelope.event === "product.updated") {
    const product = poAppProductSchema.safeParse(envelope.data);
    if (!product.success) {
      // The scheduled sync will pick this product up; failing here would only trigger retries.
      console.warn("[po-app] webhook product payload could not be read", envelope.id);
      return "ignored";
    }
    const store = storeId
      ? await prisma.marketingStore.findFirst({
          where: { id: storeId, organizationId },
          select: { id: true, currency: true }
        })
      : null;
    await upsertPoAppProduct(
      product.data,
      {
        organizationId,
        priceBookId: await ensureStandardPriceBook(organizationId),
        storeId: store?.id ?? null,
        currency: store?.currency?.trim() || "USD"
      },
      now
    );
    return "applied";
  }

  if (envelope.event === "product.deleted") {
    const deleted = deletedSchema.safeParse(envelope.data);
    if (!deleted.success) return "ignored";
    await deactivatePoAppProduct(organizationId, deleted.data.id, parseTimestamp(deleted.data.deletedAt) ?? now);
    return "deactivated";
  }

  if (envelope.event === "webhook.test") {
    console.info("[po-app] webhook test event received", organizationId);
    return "ignored";
  }

  // New event types are a backwards-compatible change, so an unknown one is acknowledged.
  console.warn("[po-app] unknown webhook event", envelope.event);
  return "ignored";
}
