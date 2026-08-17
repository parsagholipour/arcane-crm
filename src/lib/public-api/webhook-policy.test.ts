import assert from "node:assert/strict";
import test from "node:test";
import {
  nextWebhookAttemptAt,
  shouldDisableWebhook,
  webhookAttemptsExhausted,
  WEBHOOK_AUTO_DISABLE_FAILURES,
  WEBHOOK_MAX_ATTEMPTS
} from "./webhook-policy";

test("backoff grows after each failed attempt", () => {
  const now = new Date("2026-08-17T12:00:00.000Z");
  assert.equal(nextWebhookAttemptAt(1, now).toISOString(), "2026-08-17T12:01:00.000Z");
  assert.equal(nextWebhookAttemptAt(2, now).toISOString(), "2026-08-17T12:05:00.000Z");
  assert.equal(nextWebhookAttemptAt(5, now).toISOString(), "2026-08-17T18:00:00.000Z");
});

test("a delivery is exhausted after six attempts and an endpoint after 20 consecutive failures", () => {
  assert.equal(webhookAttemptsExhausted(WEBHOOK_MAX_ATTEMPTS - 1), false);
  assert.equal(webhookAttemptsExhausted(WEBHOOK_MAX_ATTEMPTS), true);
  assert.equal(shouldDisableWebhook(WEBHOOK_AUTO_DISABLE_FAILURES - 1), false);
  assert.equal(shouldDisableWebhook(WEBHOOK_AUTO_DISABLE_FAILURES), true);
});
