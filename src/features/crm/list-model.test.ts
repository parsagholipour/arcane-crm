import assert from "node:assert/strict";
import test from "node:test";
import {
  chartDataForRecords,
  compareRecordValues,
  normalizeColumnWidth,
  recordMatchesCountryFilter,
  recordMatchesListFilter,
  recordMatchesStandardListView
} from "./list-model";

test("list filters and standard views reject non-matching records", () => {
  assert.equal(
    recordMatchesListFilter({ status: "Working" }, { field: "status", operator: "equals", value: "working" }),
    true
  );
  assert.equal(
    recordMatchesListFilter({ name: "Acme Holdings" }, { field: "name", operator: "starts-with", value: "acme" }),
    true
  );
  assert.equal(recordMatchesStandardListView("Case", "All Open Cases", { status: "Closed" }, [], "user-1"), false);
  assert.equal(
    recordMatchesStandardListView(
      "Invoice",
      "Outstanding",
      { status: "Partially Paid", balanceDue: 120 },
      [],
      "user-1"
    ),
    true
  );
});

test("country filters match leads case-insensitively and allow the all-countries state", () => {
  assert.equal(recordMatchesCountryFilter({ country: "Canada" }, "canada"), true);
  assert.equal(recordMatchesCountryFilter({ country: "United States" }, "Canada"), false);
  assert.equal(recordMatchesCountryFilter({ country: "Canada" }, ""), true);
});

test("list sorting, chart grouping, and widths are deterministic", () => {
  assert.ok(compareRecordValues("$20.00", "$100.00") < 0);
  assert.ok(compareRecordValues("2026-01-01", "2026-02-01") < 0);
  assert.equal(normalizeColumnWidth(20), "110px");
  assert.equal(normalizeColumnWidth("900px"), "520px");
  assert.deepEqual(chartDataForRecords([{ status: "New" }, { status: "Working" }, { status: "New" }], "status"), [
    { label: "New", count: 2 },
    { label: "Working", count: 1 }
  ]);
});
