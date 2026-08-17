import assert from "node:assert/strict";
import test from "node:test";
import { serializeDeletedLead, serializePublicLead } from "./lead-serialize";

const lead = {
  id: "lead-1",
  organizationId: "org-1",
  status: "New",
  firstName: "Ada",
  lastName: "Lovelace",
  company: "Analytical Engines",
  ownerId: "user-1",
  email: "ada@example.com",
  annualRevenue: { toJSON: () => "120000" },
  sampleRequestedNotificationId: "notif-secret",
  createdById: "user-1",
  updatedById: "user-1",
  createdAt: new Date("2026-08-01T00:00:00.000Z"),
  updatedAt: new Date("2026-08-02T00:00:00.000Z"),
  sampleProducts: [
    {
      id: "line-1",
      productId: "prod-1",
      quantity: "2",
      unitPrice: "10.00",
      totalPrice: "20.00",
      description: null,
      displayOrder: 0,
      product: {
        id: "prod-1",
        name: "Obsidian Dice",
        sku: "OD-1",
        organizationId: "org-1",
        poAppProductId: "po-1",
        active: true,
        price: "12.00"
      }
    }
  ]
};

test("the public lead omits internal notification ids and trims nested products", () => {
  const serialized = serializePublicLead(
    lead,
    { id: "user-1", name: "Casey", alias: "casey", email: "casey@example.com" },
    {
      id: "ship-1",
      carrier: "USPS",
      trackingNumber: "LZ123456789US",
      status: "In Transit",
      statusSummary: "Moving",
      expectedDeliveryAt: new Date("2026-08-10T00:00:00.000Z"),
      lastEventAt: null,
      lastEventDescription: null,
      deliveredAt: null,
      deliveredNotificationId: "hidden"
    }
  );

  assert.equal("sampleRequestedNotificationId" in serialized, false);
  assert.equal(serialized.owner.name, "Casey");
  assert.equal(serialized.sampleProducts[0]?.product?.name, "Obsidian Dice");
  assert.equal(
    serialized.sampleProducts[0]?.product && "poAppProductId" in serialized.sampleProducts[0].product,
    false
  );
  assert.equal(serialized.shipment?.status, "In Transit");
  assert.equal(serialized.shipment && "deliveredNotificationId" in serialized.shipment, false);
  assert.equal(serialized.createdAt, "2026-08-01T00:00:00.000Z");
  assert.equal(serialized.annualRevenue, "120000");
});

test("a deleted lead keeps identifiers only", () => {
  const deleted = serializeDeletedLead(lead, new Date("2026-08-17T12:00:00.000Z"));
  assert.deepEqual(deleted, {
    id: "lead-1",
    firstName: "Ada",
    lastName: "Lovelace",
    company: "Analytical Engines",
    email: "ada@example.com",
    deletedAt: "2026-08-17T12:00:00.000Z"
  });
});
