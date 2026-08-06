import { createHmac } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";
import { parsePoAppWebhookEnvelope, verifyPoAppSignature } from "@/lib/po-app-webhook";

const SECRET = "whsec_2f0a1c8b4d6e";
const NOW = Date.UTC(2026, 7, 1, 23, 7, 51);
const TIMESTAMP = Math.floor(NOW / 1000);

const rawBody = JSON.stringify({
  id: "fd4cfedc-a53b-491e-9456-9ccdf9c07749",
  event: "product.updated",
  createdAt: "2026-08-01T23:07:51.633Z",
  storeId: "4e5db5c0-0cc8-4e6a-8d40-cc5ce5131c13",
  data: { id: "c0000001", name: "Obsidian Dice Set" }
});

function sign(body: string, timestamp = TIMESTAMP, secret = SECRET) {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`, "utf8").digest("hex");
}

function header(body = rawBody, timestamp = TIMESTAMP, secret = SECRET) {
  return `t=${timestamp},v1=${sign(body, timestamp, secret)}`;
}

test("a correctly signed body is accepted", () => {
  assert.equal(verifyPoAppSignature(rawBody, header(), SECRET, { now: NOW }), true);
});

test("the v1 pair is matched by name, not by position", () => {
  const reordered = `v1=${sign(rawBody)},t=${TIMESTAMP}`;

  assert.equal(verifyPoAppSignature(rawBody, reordered, SECRET, { now: NOW }), true);
});

test("a future scheme that only supplies v2 is rejected", () => {
  const v2Only = `t=${TIMESTAMP},v2=${sign(rawBody)}`;

  assert.equal(verifyPoAppSignature(rawBody, v2Only, SECRET, { now: NOW }), false);
});

test("a signature from another secret is rejected", () => {
  assert.equal(verifyPoAppSignature(rawBody, header(rawBody, TIMESTAMP, "whsec_other"), SECRET, { now: NOW }), false);
});

test("a tampered body is rejected", () => {
  const tampered = rawBody.replace("Obsidian Dice Set", "Free Dice Set");

  assert.equal(verifyPoAppSignature(tampered, header(), SECRET, { now: NOW }), false);
});

test("a re-serialised body no longer matches, which is why raw bytes are required", () => {
  const reserialized = JSON.stringify(JSON.parse(rawBody), null, 2);

  assert.equal(verifyPoAppSignature(reserialized, header(), SECRET, { now: NOW }), false);
});

test("a replayed delivery outside the tolerance window is rejected", () => {
  const stale = TIMESTAMP - 301;
  const future = TIMESTAMP + 301;

  assert.equal(verifyPoAppSignature(rawBody, header(rawBody, stale), SECRET, { now: NOW }), false);
  assert.equal(verifyPoAppSignature(rawBody, header(rawBody, future), SECRET, { now: NOW }), false);
  assert.equal(verifyPoAppSignature(rawBody, header(rawBody, TIMESTAMP - 299), SECRET, { now: NOW }), true);
});

test("a missing, empty, or malformed header is rejected", () => {
  assert.equal(verifyPoAppSignature(rawBody, null, SECRET, { now: NOW }), false);
  assert.equal(verifyPoAppSignature(rawBody, "", SECRET, { now: NOW }), false);
  assert.equal(verifyPoAppSignature(rawBody, "garbage", SECRET, { now: NOW }), false);
  assert.equal(verifyPoAppSignature(rawBody, `t=abc,v1=${sign(rawBody)}`, SECRET, { now: NOW }), false);
  assert.equal(verifyPoAppSignature(rawBody, `t=${TIMESTAMP},v1=`, SECRET, { now: NOW }), false);
});

test("an unset secret never authorizes", () => {
  assert.equal(verifyPoAppSignature(rawBody, header(), "", { now: NOW }), false);
});

test("a truncated signature of the right prefix is rejected", () => {
  const truncated = `t=${TIMESTAMP},v1=${sign(rawBody).slice(0, 32)}`;

  assert.equal(verifyPoAppSignature(rawBody, truncated, SECRET, { now: NOW }), false);
});

test("the envelope parses by name and tolerates unknown keys", () => {
  const envelope = parsePoAppWebhookEnvelope(rawBody);

  assert.equal(envelope?.id, "fd4cfedc-a53b-491e-9456-9ccdf9c07749");
  assert.equal(envelope?.event, "product.updated");
  assert.equal(envelope?.storeId, "4e5db5c0-0cc8-4e6a-8d40-cc5ce5131c13");
  assert.ok(parsePoAppWebhookEnvelope(JSON.stringify({ ...JSON.parse(rawBody), future: 1 })));
});

test("a body that is not a delivery envelope parses to null", () => {
  assert.equal(parsePoAppWebhookEnvelope("not json"), null);
  assert.equal(parsePoAppWebhookEnvelope("{}"), null);
  assert.equal(parsePoAppWebhookEnvelope(JSON.stringify({ id: "x" })), null);
});
