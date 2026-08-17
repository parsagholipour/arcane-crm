import assert from "node:assert/strict";
import test from "node:test";
import {
  API_TOKEN_PREFIX,
  generateApiToken,
  generateWebhookSecret,
  hashSecret,
  hashesMatch,
  parseBearerToken,
  tokenPreview,
  WEBHOOK_SECRET_PREFIX
} from "./token";

test("generated API tokens use the crm_ prefix and hash stably", () => {
  const first = generateApiToken();
  assert.equal(first.token.startsWith(API_TOKEN_PREFIX), true);
  assert.equal(hashSecret(first.token), first.hash);
  assert.equal(first.prefix, first.token.slice(0, 12));
  assert.notEqual(generateApiToken().token, first.token);
});

test("webhook secrets use the whsec_ prefix", () => {
  assert.equal(generateWebhookSecret().startsWith(WEBHOOK_SECRET_PREFIX), true);
});

test("parseBearerToken accepts only crm_ bearer values", () => {
  const { token } = generateApiToken();
  assert.equal(parseBearerToken(`Bearer ${token}`), token);
  assert.equal(parseBearerToken(`Bearer ${token}  `), token);
  assert.equal(parseBearerToken(null), null);
  assert.equal(parseBearerToken("Bearer poa_not_this"), null);
  assert.equal(parseBearerToken("Bearer crm_"), null);
  assert.equal(parseBearerToken(token), null);
});

test("token preview never contains the full secret", () => {
  const { token, prefix } = generateApiToken();
  const preview = tokenPreview(prefix);
  assert.equal(preview?.endsWith("••••"), true);
  assert.equal(preview?.includes(token.slice(12)), false);
});

test("hash comparison rejects a truncated value of the same prefix", () => {
  const hash = hashSecret("crm_example-token");
  assert.equal(hashesMatch(hash, hash), true);
  assert.equal(hashesMatch(hash, hash.slice(0, 32)), false);
});
