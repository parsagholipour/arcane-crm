import assert from "node:assert/strict";
import test from "node:test";
import { configuredShipmentTrackingCronSecret, validBearerSecret } from "@/lib/cron-auth";
import { RecordPayloadValidationError, validateRecordPayload } from "@/lib/record-validation";
import { POST_DELIVERY_FOLLOW_UP_DAYS, postDeliveryFollowUpIsDue } from "@/lib/shipment-notifications";
import { syncShipmentTracking } from "@/lib/shipment-tracking-sync";

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
    fields(() =>
      validateRecordPayload("Opportunity", {
        ...base,
        courier: null,
        trackingNumber: null,
        deliveryDate: null
      })
    ),
    null
  );
  assert.equal(
    fields(() => validateRecordPayload("Opportunity", { ...base, courier: "USPS", trackingNumber: "  " })),
    null,
    "a courier without a number yet is a legitimate half-filled form"
  );
  assert.equal(
    fields(() => validateRecordPayload("Opportunity", { ...base, deliveryDate: "2026-08-01" })),
    null
  );
});

test("a malformed Opportunity delivery date is rejected", () => {
  assert.deepEqual(
    fields(() => validateRecordPayload("Opportunity", { ...base, deliveryDate: "not-a-date" })),
    ["deliveryDate"]
  );
});

test("post-delivery follow-ups become due exactly 7 days after delivery", () => {
  const deliveredAt = new Date("2026-08-01T12:00:00.000Z");
  assert.equal(postDeliveryFollowUpIsDue(null, deliveredAt), false);
  assert.equal(postDeliveryFollowUpIsDue(deliveredAt, deliveredAt), false);
  assert.equal(
    postDeliveryFollowUpIsDue(
      deliveredAt,
      new Date(deliveredAt.getTime() + (POST_DELIVERY_FOLLOW_UP_DAYS * 24 * 60 * 60 * 1000 - 1))
    ),
    false
  );
  assert.equal(
    postDeliveryFollowUpIsDue(
      deliveredAt,
      new Date(deliveredAt.getTime() + POST_DELIVERY_FOLLOW_UP_DAYS * 24 * 60 * 60 * 1000)
    ),
    true
  );
});

function mockTrackingClient(deletedCount: number) {
  const calls: { deleteMany: unknown; opportunityUpdateMany: unknown; leadUpdateMany: unknown } = {
    deleteMany: null,
    opportunityUpdateMany: null,
    leadUpdateMany: null
  };
  return {
    calls,
    client: {
      shipmentTracking: {
        deleteMany: async (args: unknown) => {
          calls.deleteMany = args;
          return { count: deletedCount };
        },
        findUnique: async () => null,
        create: async () => {
          throw new Error("create should not run");
        },
        update: async () => {
          throw new Error("update should not run");
        }
      },
      opportunity: {
        updateMany: async (args: unknown) => {
          calls.opportunityUpdateMany = args;
          return { count: 1 };
        }
      },
      lead: {
        updateMany: async (args: unknown) => {
          calls.leadUpdateMany = args;
          return { count: 1 };
        }
      }
    }
  };
}

test("clearing USPS tracking deletes the shipment row and clears Opportunity.deliveryDate", async () => {
  const { client, calls } = mockTrackingClient(1);
  const result = await syncShipmentTracking(client as never, {
    organizationId: "org",
    subjectType: "Opportunity",
    subjectId: "opp",
    carrier: "USPS",
    trackingNumber: null
  });

  assert.equal(result, null);
  assert.deepEqual(calls.deleteMany, {
    where: { organizationId: "org", subjectType: "Opportunity", subjectId: "opp" }
  });
  assert.deepEqual(calls.opportunityUpdateMany, {
    where: { id: "opp", organizationId: "org" },
    data: { deliveryDate: null }
  });
});

test("saving an Opportunity with no USPS tracking leaves a manual deliveryDate alone", async () => {
  const { client, calls } = mockTrackingClient(0);
  await syncShipmentTracking(client as never, {
    organizationId: "org",
    subjectType: "Opportunity",
    subjectId: "opp",
    carrier: null,
    trackingNumber: null
  });

  assert.equal(calls.opportunityUpdateMany, null);
});

test("clearing a Lead sample's USPS tracking clears Lead.deliveryDate, not an Opportunity's", async () => {
  const { client, calls } = mockTrackingClient(1);
  const result = await syncShipmentTracking(client as never, {
    organizationId: "org",
    subjectType: "Lead",
    subjectId: "lead",
    carrier: "USPS",
    trackingNumber: null
  });

  assert.equal(result, null);
  assert.deepEqual(calls.deleteMany, {
    where: { organizationId: "org", subjectType: "Lead", subjectId: "lead" }
  });
  assert.deepEqual(calls.leadUpdateMany, {
    where: { id: "lead", organizationId: "org" },
    data: { deliveryDate: null }
  });
  assert.equal(calls.opportunityUpdateMany, null);
});

test("a Lead sample accepts the same courier and USPS tracking rules as an Opportunity", () => {
  const lead = { firstName: "Dana", lastName: "Reed", status: "Sample requested" };
  assert.equal(
    fields(() => validateRecordPayload("Lead", { ...lead, courier: "USPS", trackingNumber: "LZ123456789US" })),
    null
  );
  assert.deepEqual(
    fields(() => validateRecordPayload("Lead", { ...lead, courier: "Pigeon" })),
    ["courier"]
  );
  assert.deepEqual(
    fields(() => validateRecordPayload("Lead", { ...lead, courier: "USPS", trackingNumber: "12345" })),
    ["trackingNumber"]
  );
  assert.deepEqual(
    fields(() => validateRecordPayload("Lead", { ...lead, deliveryDate: "not-a-date" })),
    ["deliveryDate"]
  );
});

test("Lead sample status and requested date are validated on save", () => {
  const lead = { firstName: "Dana", lastName: "Reed", status: "Sample requested" };
  assert.equal(
    fields(() =>
      validateRecordPayload("Lead", { ...lead, sampleStatus: "Follow ups due", sampleRequestedDate: "2026-08-01" })
    ),
    null
  );
  assert.deepEqual(
    fields(() => validateRecordPayload("Lead", { ...lead, sampleStatus: "Posted" })),
    ["sampleStatus"]
  );
  assert.deepEqual(
    fields(() => validateRecordPayload("Lead", { ...lead, sampleRequestedDate: "not-a-date" })),
    ["sampleRequestedDate"]
  );
  assert.deepEqual(
    fields(() => validateRecordPayload("Lead", { ...lead, status: "Sample posted" })),
    ["status"],
    "the new Lead Status options are an allowlist, not free text"
  );
  assert.equal(
    fields(() => validateRecordPayload("Lead", { ...lead, status: "Sample rejected" })),
    null
  );
});
