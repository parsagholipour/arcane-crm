import assert from "node:assert/strict";
import test from "node:test";
import { sampleRequestNeedsShipping, sampleRequestReminderIsDue } from "@/lib/sample-request-status";

const requested = new Date("2026-08-13T00:00:00.000Z");
const duringRequestedDay = new Date("2026-08-13T23:59:59.999Z");
const nextUtcDay = new Date("2026-08-14T00:00:00.000Z");

test("Need shipping and empty Sample Status still need a shipment", () => {
  assert.equal(sampleRequestNeedsShipping("Need shipping"), true);
  assert.equal(sampleRequestNeedsShipping("need shipping"), true);
  assert.equal(sampleRequestNeedsShipping(null), true);
  assert.equal(sampleRequestNeedsShipping(undefined), true);
  assert.equal(sampleRequestNeedsShipping(""), true);
  assert.equal(sampleRequestNeedsShipping("--None--"), true);
  assert.equal(sampleRequestNeedsShipping("Shipped"), false);
  assert.equal(sampleRequestNeedsShipping("Follow ups due"), false);
  assert.equal(sampleRequestNeedsShipping("Converted"), false);
  assert.equal(sampleRequestNeedsShipping("No interest"), false);
});

test("an unshipped sample is due only after the requested calendar day", () => {
  assert.equal(sampleRequestReminderIsDue(requested, "Need shipping", duringRequestedDay), false);
  assert.equal(sampleRequestReminderIsDue(requested, "Need shipping", nextUtcDay), true);
  assert.equal(sampleRequestReminderIsDue(requested, null, nextUtcDay), true);
  assert.equal(sampleRequestReminderIsDue(requested, "--None--", nextUtcDay), true);
});

test("a shipped sample does not notify even after the requested date", () => {
  assert.equal(sampleRequestReminderIsDue(requested, "Shipped", nextUtcDay), false);
  assert.equal(sampleRequestReminderIsDue(requested, "Follow ups due", nextUtcDay), false);
  assert.equal(sampleRequestReminderIsDue(null, "Need shipping", nextUtcDay), false);
});
