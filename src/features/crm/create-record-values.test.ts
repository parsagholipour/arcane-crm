import assert from "node:assert/strict";
import test from "node:test";
import {
  optionalNumberValue,
  optionalStringValue,
  updateOptionalDateValue,
  updateOptionalNumberValue,
  updateOptionalStringValue
} from "@/server/records/form-values";

test("Account and Lead optional numeric fields preserve numeric and string zero", () => {
  assert.equal(optionalNumberValue(0), 0);
  assert.equal(optionalNumberValue("0"), 0);
  assert.equal(optionalStringValue(0), "0");
  assert.equal(optionalStringValue("0"), "0");
});

test("Account and Lead optional numeric fields still map blank values to null", () => {
  assert.equal(optionalNumberValue(null), null);
  assert.equal(optionalNumberValue(undefined), null);
  assert.equal(optionalNumberValue(""), null);
  assert.equal(optionalNumberValue("  "), null);
  assert.equal(optionalStringValue(null), null);
  assert.equal(optionalStringValue(undefined), null);
  assert.equal(optionalStringValue(""), null);
  assert.equal(optionalStringValue("  "), null);
});

test("edit payload adapters distinguish omitted fields, blanks, and zero", () => {
  assert.equal(updateOptionalNumberValue(undefined), undefined);
  assert.equal(updateOptionalNumberValue(""), null);
  assert.equal(updateOptionalNumberValue(0), 0);
  assert.equal(updateOptionalStringValue(undefined), undefined);
  assert.equal(updateOptionalStringValue(""), null);
  assert.equal(updateOptionalStringValue(0), "0");
  assert.equal(updateOptionalDateValue(undefined), undefined);
  assert.equal(updateOptionalDateValue(""), null);
  assert.equal(updateOptionalDateValue("2026-09-30")?.toISOString(), "2026-09-30T00:00:00.000Z");
});
