import assert from "node:assert/strict";
import test from "node:test";
import { decryptSecret, encryptSecret, maskSecret, secretEncryptionConfigured } from "@/lib/secret-encryption";

const environment = { INTEGRATION_ENCRYPTION_KEY: "a-long-integration-passphrase" };

test("an encrypted secret round-trips with the same passphrase", () => {
  const token = "poa_l0_rwGVqLAFQD9ga7neS9xbzAJcSCUWIEz85bHO37h0";
  const ciphertext = encryptSecret(token, environment);

  assert.notEqual(ciphertext, token);
  assert.ok(!ciphertext.includes(token), "the plaintext must not survive in the stored value");
  assert.equal(decryptSecret(ciphertext, environment), token);
});

test("the same secret encrypts differently each time", () => {
  assert.notEqual(encryptSecret("poa_same", environment), encryptSecret("poa_same", environment));
});

test("a rotated passphrase makes the value unreadable instead of throwing", () => {
  const ciphertext = encryptSecret("poa_token", environment);

  assert.equal(decryptSecret(ciphertext, { INTEGRATION_ENCRYPTION_KEY: "a-different-passphrase" }), null);
});

test("a tampered ciphertext fails authentication", () => {
  const [version, iv, tag, body] = encryptSecret("poa_token", environment).split(".");
  const flipped = Buffer.from(body, "base64");
  flipped[0] ^= 0xff;

  assert.equal(decryptSecret([version, iv, tag, flipped.toString("base64")].join("."), environment), null);
});

test("malformed and empty values decrypt to null", () => {
  assert.equal(decryptSecret("", environment), null);
  assert.equal(decryptSecret(null, environment), null);
  assert.equal(decryptSecret("not-a-ciphertext", environment), null);
  assert.equal(decryptSecret("v2.a.b.c", environment), null);
});

test("AUTH_SECRET is the fallback passphrase", () => {
  const ciphertext = encryptSecret("poa_token", { AUTH_SECRET: "auth-secret-value" });

  assert.equal(decryptSecret(ciphertext, { AUTH_SECRET: "auth-secret-value" }), "poa_token");
  assert.equal(secretEncryptionConfigured({ AUTH_SECRET: "auth-secret-value" }), true);
  assert.equal(secretEncryptionConfigured({ AUTH_SECRET: "   " }), false);
  assert.equal(secretEncryptionConfigured({}), false);
});

test("masking keeps only the prefix and suffix of a token", () => {
  const masked = maskSecret("poa_l0_rwGVqLAFQD9ga7neS9xbzAJcSCUWIEz85bHO37h0");

  assert.equal(masked, "poa_••••37h0");
  assert.equal(maskSecret("short"), "••••");
});
