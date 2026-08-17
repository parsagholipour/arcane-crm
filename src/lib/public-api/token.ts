import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const API_TOKEN_PREFIX = "crm_";
export const WEBHOOK_SECRET_PREFIX = "whsec_";

const TOKEN_BYTES = 32;
const PREFIX_LENGTH = 12;

export function hashSecret(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function generatePrefixedSecret(prefix: string) {
  return `${prefix}${randomBytes(TOKEN_BYTES).toString("base64url")}`;
}

export function generateApiToken() {
  const token = generatePrefixedSecret(API_TOKEN_PREFIX);
  return { token, hash: hashSecret(token), prefix: token.slice(0, PREFIX_LENGTH) };
}

export function generateWebhookSecret() {
  return generatePrefixedSecret(WEBHOOK_SECRET_PREFIX);
}

export function tokenPreview(prefix: string | null | undefined) {
  if (!prefix) return null;
  return `${prefix}••••`;
}

export function parseBearerToken(authorization: string | null | undefined) {
  const prefix = "Bearer ";
  if (!authorization?.startsWith(prefix)) return null;
  const token = authorization.slice(prefix.length).trim();
  return token.startsWith(API_TOKEN_PREFIX) && token.length > API_TOKEN_PREFIX.length ? token : null;
}

/** Compare two hex hashes without leaking length via early return on mismatch. */
export function hashesMatch(left: string, right: string) {
  const expected = Buffer.from(left, "utf8");
  const received = Buffer.from(right, "utf8");
  return expected.length === received.length && timingSafeEqual(expected, received);
}
