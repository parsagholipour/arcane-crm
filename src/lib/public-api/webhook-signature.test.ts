import assert from "node:assert/strict";
import test from "node:test";
import { signWebhookBody, verifyWebhookSignature } from "./webhook-signature";

const SECRET = "whsec_test_secret";
const NOW = Date.UTC(2026, 7, 17, 12, 0, 0);
const TIMESTAMP = Math.floor(NOW / 1000);
const BODY = JSON.stringify({ id: "del_1", event: "lead.updated", data: { id: "lead-1" } });

test("a correctly signed body is accepted", () => {
  const signed = signWebhookBody(BODY, SECRET, TIMESTAMP);
  assert.equal(verifyWebhookSignature(BODY, signed.header, SECRET, { now: NOW }), true);
});

test("the v1 pair is matched by name, not by position", () => {
  const signed = signWebhookBody(BODY, SECRET, TIMESTAMP);
  const reordered = `v1=${signed.signature},t=${TIMESTAMP}`;
  assert.equal(verifyWebhookSignature(BODY, reordered, SECRET, { now: NOW }), true);
});

test("a tampered body or other secret is rejected", () => {
  const signed = signWebhookBody(BODY, SECRET, TIMESTAMP);
  assert.equal(verifyWebhookSignature(BODY.replace("lead-1", "lead-2"), signed.header, SECRET, { now: NOW }), false);
  assert.equal(verifyWebhookSignature(BODY, signed.header, "whsec_other", { now: NOW }), false);
});

test("a replay outside the tolerance window is rejected", () => {
  const signed = signWebhookBody(BODY, SECRET, TIMESTAMP);
  assert.equal(verifyWebhookSignature(BODY, signed.header, SECRET, { now: NOW + 301_000 }), false);
  assert.equal(verifyWebhookSignature(BODY, signed.header, SECRET, { now: NOW + 299_000 }), true);
});
