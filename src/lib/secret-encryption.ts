import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Authenticated encryption for third-party credentials that have to be stored per
 * organization rather than in the environment. Everything else in this codebase keeps its
 * secrets in process.env; this exists so an admin can paste an integration token into the UI
 * without it landing in Postgres in the clear.
 */

const VERSION = "v1";
const IV_BYTES = 12;
const ALGORITHM = "aes-256-gcm";

type SecretEnvironment = Partial<NodeJS.ProcessEnv>;

function passphrase(environment: SecretEnvironment) {
  return environment.INTEGRATION_ENCRYPTION_KEY?.trim() || environment.AUTH_SECRET?.trim() || "";
}

export function secretEncryptionConfigured(environment: SecretEnvironment = process.env) {
  return passphrase(environment).length > 0;
}

function encryptionKey(environment: SecretEnvironment) {
  const secret = passphrase(environment);
  if (!secret) {
    throw new Error("INTEGRATION_ENCRYPTION_KEY or AUTH_SECRET must be set before storing integration secrets.");
  }
  return createHash("sha256").update(secret, "utf8").digest();
}

export function encryptSecret(plaintext: string, environment: SecretEnvironment = process.env) {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(environment), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  // Base64 never contains a dot, so the parts stay unambiguous.
  return [VERSION, iv.toString("base64"), cipher.getAuthTag().toString("base64"), ciphertext.toString("base64")].join(
    "."
  );
}

/**
 * Returns null rather than throwing when the value cannot be read. A rotated passphrase or a
 * tampered row is a "reconnect this integration" prompt, not a server error.
 */
export function decryptSecret(value: string | null | undefined, environment: SecretEnvironment = process.env) {
  if (!value) return null;
  const [version, iv, tag, ciphertext] = value.split(".");
  if (version !== VERSION || !iv || !tag || !ciphertext) return null;
  try {
    const decipher = createDecipheriv(ALGORITHM, encryptionKey(environment), Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** The only form of a secret that is ever allowed to reach a browser. */
export function maskSecret(value: string) {
  const trimmed = value.trim();
  if (trimmed.length <= 8) return "••••";
  return `${trimmed.slice(0, 4)}••••${trimmed.slice(-4)}`;
}
