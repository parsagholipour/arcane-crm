import test from "node:test";
import assert from "node:assert/strict";
import { FORM_DEFINITIONS } from "@/lib/crm-metadata";
import { buildInitialValues, dateInputValue, formatListCell } from "./form-model";

test("dateInputValue adapts persisted dates without changing empty or invalid values", () => {
  assert.equal(dateInputValue("2026-09-30T00:00:00.000Z"), "2026-09-30");
  assert.equal(dateInputValue("2026-09-30"), "2026-09-30");
  assert.equal(dateInputValue(new Date("2026-09-30T14:20:00.000Z")), "2026-09-30");
  assert.equal(dateInputValue(null), null);
  assert.equal(dateInputValue("not-a-date"), "not-a-date");
});

test("formatListCell labels opportunity tracking statuses", () => {
  assert.equal(formatListCell("Opportunity", { trackingStatus: "InTransit" }, "trackingStatus"), "In Transit");
  assert.equal(
    formatListCell("Opportunity", { trackingStatus: "OutForDelivery" }, "trackingStatus"),
    "Out for Delivery"
  );
  assert.equal(formatListCell("Opportunity", { trackingStatus: "" }, "trackingStatus"), "");
});

test("every metadata date field hydrates serialized API timestamps for its form control", () => {
  const hydratedFields: string[] = [];

  for (const [object, definition] of Object.entries(FORM_DEFINITIONS)) {
    const dateFields = definition.fields.filter((field) => field.type === "date");
    if (!dateFields.length) continue;

    const record = Object.fromEntries(dateFields.map((field) => [field.name, "2026-09-30T00:00:00.000Z"]));
    const values = buildInitialValues(definition, record, "user-1");
    for (const field of dateFields) {
      assert.equal(values[field.name], "2026-09-30", `${object}.${field.name}`);
      hydratedFields.push(`${object}.${field.name}`);
    }
  }

  assert.deepEqual(hydratedFields, [
    "Contact.birthDate",
    "Opportunity.closeDate",
    "Pricebook2.validFrom",
    "Pricebook2.validTo"
  ]);
});
