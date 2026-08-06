import assert from "node:assert/strict";
import test from "node:test";
import { quarterlyGoalOrFallback } from "./home-model";

test("quarterly goal hydration treats zero as a configured value", () => {
  assert.equal(quarterlyGoalOrFallback(0, 100_000), 0);
  assert.equal(quarterlyGoalOrFallback("0", 100_000), 0);
  assert.equal(quarterlyGoalOrFallback("0.00", 100_000), 0);
});

test("quarterly goal hydration uses the suggestion only for absent or invalid values", () => {
  assert.equal(quarterlyGoalOrFallback(null, 100_000), 100_000);
  assert.equal(quarterlyGoalOrFallback(undefined, 100_000), 100_000);
  assert.equal(quarterlyGoalOrFallback("", 100_000), 100_000);
  assert.equal(quarterlyGoalOrFallback("not-a-number", 100_000), 100_000);
});
