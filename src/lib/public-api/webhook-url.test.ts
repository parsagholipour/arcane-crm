import assert from "node:assert/strict";
import test from "node:test";
import { isPrivateWebhookHostname, validateWebhookUrl, WebhookUrlError } from "./webhook-url";

test("private and loopback hosts are rejected", () => {
  for (const host of ["localhost", "127.0.0.1", "10.0.0.4", "192.168.1.8", "172.16.0.2", "169.254.1.1", "0.0.0.0"]) {
    assert.equal(isPrivateWebhookHostname(host), true);
  }
  assert.equal(isPrivateWebhookHostname("hooks.example.com"), false);
});

test("production requires HTTPS and a public host", () => {
  const production = { NODE_ENV: "production" as const };
  assert.equal(validateWebhookUrl("https://hooks.example.com/crm", production), "https://hooks.example.com/crm");
  assert.throws(() => validateWebhookUrl("http://hooks.example.com/crm", production), WebhookUrlError);
  assert.throws(() => validateWebhookUrl("https://127.0.0.1/crm", production), WebhookUrlError);
  assert.throws(() => validateWebhookUrl("https://user:pass@hooks.example.com/crm", production), WebhookUrlError);
});

test("development still allows HTTP to a public host", () => {
  const development = { NODE_ENV: "development" as const };
  assert.equal(validateWebhookUrl("http://hooks.example.com/crm", development), "http://hooks.example.com/crm");
});
