import test from "node:test";
import assert from "node:assert/strict";
import { dateInputValue } from "./form-model";

test("dateInputValue adapts persisted dates without changing empty or invalid values", () => {
  assert.equal(dateInputValue("2026-09-30T00:00:00.000Z"), "2026-09-30");
  assert.equal(dateInputValue("2026-09-30"), "2026-09-30");
  assert.equal(dateInputValue(new Date("2026-09-30T14:20:00.000Z")), "2026-09-30");
  assert.equal(dateInputValue(null), null);
  assert.equal(dateInputValue("not-a-date"), "not-a-date");
});
