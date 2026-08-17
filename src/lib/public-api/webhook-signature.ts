import { createHmac, timingSafeEqual } from "node:crypto";

export const WEBHOOK_SIGNATURE_TOLERANCE_SECONDS = 300;

export function signWebhookBody(rawBody: string, secret: string, timestampSeconds = Math.floor(Date.now() / 1000)) {
  const signature = createHmac("sha256", secret).update(`${timestampSeconds}.${rawBody}`, "utf8").digest("hex");
  return {
    timestampSeconds,
    signature,
    header: `t=${timestampSeconds},v1=${signature}`
  };
}

export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  { now = Date.now(), toleranceSeconds = WEBHOOK_SIGNATURE_TOLERANCE_SECONDS } = {}
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
