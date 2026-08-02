import assert from "node:assert/strict";
import test from "node:test";
import { configuredShipmentTrackingCronSecret, validBearerSecret } from "@/lib/cron-auth";
import { RecordPayloadValidationError, validateRecordPayload } from "@/lib/record-validation";

test("shipment tracking cron authorization requires an exact bearer secret", () => {
  assert.equal(validBearerSecret("Bearer correct", "correct"), true);
  assert.equal(validBearerSecret("Bearer wrong", "correct"), false);
  assert.equal(validBearerSecret("Bearer correct-but-longer", "correct"), false);
  assert.equal(validBearerSecret("Basic correct", "correct"), false);
  assert.equal(validBearerSecret("correct", "correct"), false);
  assert.equal(validBearerSecret(null, "correct"), false);
  assert.equal(validBearerSecret("Bearer correct", ""), false, "an unset secret must never authorize");
});

test("the shipment cron secret is read and trimmed independently of the calendar one", () => {
  assert.equal(configuredShipmentTrackingCronSecret({ SHIPMENT_TRACKING_CRON_SECRET: "  s3cret  " }), "s3cret");
  assert.equal(configuredShipmentTrackingCronSecret({ CALENDAR_REMINDER_CRON_SECRET: "other" }), "");
  assert.equal(configuredShipmentTrackingCronSecret({}), "");
});

function fields(run: () => void) {
  try {
    run();
  } catch (error) {
    if (error instanceof RecordPayloadValidationError) return error.fields;
    throw error;
  }
  return null;
}

const base = {
  name: "Renewal",
  accountId: "acc",
  closeDate: "2026-09-01",
  stage: "Propose",
  forecastCategory: "Commit"
};

test("an Opportunity accepts a valid courier and USPS tracking number", () => {
  assert.equal(
    fields(() =>
      validateRecordPayload("Opportunity", { ...base, courier: "USPS", trackingNumber: "9400 1000 0000 0000 0000 00" })
    ),
    null
  );
  assert.equal(
    fields(() => validateRecordPayload("Opportunity", { ...base, courier: "USPS", trackingNumber: "LZ123456789US" })),
    null
  );
});

test("an unknown courier is rejected", () => {
  assert.deepEqual(
    fields(() => validateRecordPayload("Opportunity", { ...base, courier: "Pigeon" })),
    ["courier"]
  );
});

test("a malformed USPS tracking number is caught at save time", () => {
  assert.deepEqual(
    fields(() => validateRecordPayload("Opportunity", { ...base, courier: "USPS", trackingNumber: "12345" })),
    ["trackingNumber"]
  );
  assert.deepEqual(
    fields(() =>
      validateRecordPayload("Opportunity", { ...base, courier: "USPS", trackingNumber: "1Z999AA10123456784" })
    ),
    ["trackingNumber"],
    "a UPS number under the USPS courier is a mistake worth blocking"
  );
});

test("non-USPS couriers accept any tracking number because nothing polls them", () => {
  assert.equal(
    fields(() =>
      validateRecordPayload("Opportunity", { ...base, courier: "UPS", trackingNumber: "1Z999AA10123456784" })
    ),
    null
  );
  assert.equal(
    fields(() => validateRecordPayload("Opportunity", { ...base, courier: "Other", trackingNumber: "abc" })),
    null
  );
});

test("shipping fields stay optional", () => {
  assert.equal(
    fields(() => validateRecordPayload("Opportunity", base)),
    null
  );
  assert.equal(
    fields(() => validateRecordPayload("Opportunity", { ...base, courier: null, trackingNumber: null })),
    null
  );
  assert.equal(
    fields(() => validateRecordPayload("Opportunity", { ...base, courier: "USPS", trackingNumber: "  " })),
    null,
    "a courier without a number yet is a legitimate half-filled form"
  );
});
