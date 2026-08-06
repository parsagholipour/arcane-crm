import assert from "node:assert/strict";
import test from "node:test";
import {
  mapPoAppProduct,
  normalizeEditingStatus,
  normalizeSyncIntervalMinutes,
  poAppProductSchema,
  poAppRetryDelayMinutes,
  shouldApplyPoAppUpdate
} from "@/lib/po-app-product";

// The example payload from docs/PO-API.md §8.
const sample = {
  id: "c0000001-0000-4000-8000-00000000001f",
  name: "Obsidian Dice Set",
  sku: "AF-DICE-001",
  upcGtin: "0123456789012",
  description: "Seven-piece polished set.",
  imageLink: "https://cdn.example.com/dice.jpg",
  cost: 4.25,
  price: 19.99,
  map: 17.99,
  msrp: 24.99,
  mop: 12,
  quantityPerCarton: 48,
  stockCount: 310,
  orderByDate: "2026-09-01T00:00:00.000Z",
  editingStatus: "standard",
  verified: true,
  defaultManufacturer: {
    id: "a0000001-0000-4000-8000-000000000001",
    name: "Ironforge Works",
    region: "United States",
    email: "sales@ironforge.example",
    contactNumber: "+1 555 0100"
  },
  category: { id: "d0000001-0000-4000-8000-000000000005", name: "Accessories" },
  type: { id: "e0000001-0000-4000-8000-000000000002", name: "Dice" },
  collection: { id: "f0000001-0000-4000-8000-000000000003", name: "Core Line" },
  createdAt: "2026-01-04T10:11:12.000Z",
  updatedAt: "2026-07-30T08:09:10.000Z"
};

function parse(raw: unknown) {
  const result = poAppProductSchema.safeParse(raw);
  assert.ok(result.success, "the documented product shape must parse");
  return result.data;
}

test("the documented product maps onto CRM columns", () => {
  const mapped = mapPoAppProduct(parse(sample));

  assert.equal(mapped.poAppProductId, sample.id);
  assert.equal(mapped.name, "Obsidian Dice Set");
  assert.equal(mapped.sku, "AF-DICE-001");
  assert.equal(mapped.productCode, "AF-DICE-001");
  assert.equal(mapped.category, "Accessories");
  assert.equal(mapped.family, "Core Line");
  assert.equal(mapped.productType, "Dice");
  assert.equal(mapped.manufacturerName, "Ironforge Works");
  assert.equal(mapped.manufacturerPhone, "+1 555 0100");
  assert.equal(mapped.stockCount, 310);
  assert.equal(mapped.minimumOrderPieces, 12);
  assert.equal(mapped.verified, true);
  assert.equal(mapped.poAppUpdatedAt?.toISOString(), "2026-07-30T08:09:10.000Z");
});

test("money is carried as an exact two-place string, not a float", () => {
  const mapped = mapPoAppProduct(parse({ ...sample, cost: 4.2, price: 19.999, msrp: 0 }));

  assert.equal(mapped.cost, "4.20");
  assert.equal(mapped.price, "20.00");
  assert.equal(mapped.msrp, "0.00");
  assert.equal(mapped.mapPrice, "17.99");
});

test("an unset imageLink arrives as an empty string and becomes null", () => {
  assert.equal(mapPoAppProduct(parse({ ...sample, imageLink: "" })).imageLink, null);
});

test("null relations and nullable fields collapse to null", () => {
  const mapped = mapPoAppProduct(
    parse({ ...sample, category: null, type: null, collection: null, cost: null, stockCount: null, upcGtin: null })
  );

  assert.equal(mapped.category, null);
  assert.equal(mapped.family, null);
  assert.equal(mapped.productType, null);
  assert.equal(mapped.collectionName, null);
  assert.equal(mapped.cost, null);
  assert.equal(mapped.stockCount, null);
  assert.equal(mapped.upcGtin, null);
});

test("orderByDate keeps the calendar date and drops the time", () => {
  const mapped = mapPoAppProduct(parse({ ...sample, orderByDate: "2026-09-01T21:30:00.000Z" }));

  assert.equal(mapped.orderByDate?.toISOString(), "2026-09-01T00:00:00.000Z");
});

test("a product with no usable name falls back to its SKU", () => {
  assert.equal(mapPoAppProduct(parse({ ...sample, name: "   " })).name, "AF-DICE-001");
});

test("unknown fields are ignored rather than rejected", () => {
  const mapped = mapPoAppProduct(parse({ ...sample, futureField: { nested: true } }));

  assert.equal(mapped.poAppProductId, sample.id);
});

test("a product without an id cannot be mapped", () => {
  assert.equal(poAppProductSchema.safeParse({ ...sample, id: "" }).success, false);
});

test("an unrecognised editingStatus is treated as standard", () => {
  assert.equal(normalizeEditingStatus("discontinued"), "discontinued");
  assert.equal(normalizeEditingStatus("FINAL_STOCK"), "final_stock");
  assert.equal(normalizeEditingStatus("some_future_value"), "standard");
  assert.equal(normalizeEditingStatus(null), "standard");
});

test("an older update never overwrites a newer one", () => {
  const older = new Date("2026-07-30T08:00:00.000Z");
  const newer = new Date("2026-07-30T09:00:00.000Z");

  assert.equal(shouldApplyPoAppUpdate(newer, older), true);
  assert.equal(shouldApplyPoAppUpdate(older, newer), false);
  // Equal timestamps still apply: polling overlap re-delivers unchanged rows idempotently.
  assert.equal(shouldApplyPoAppUpdate(older, older), true);
  assert.equal(shouldApplyPoAppUpdate(older, null), true);
});

test("credential failures back off for hours instead of minutes", () => {
  assert.equal(poAppRetryDelayMinutes(1), 5);
  assert.equal(poAppRetryDelayMinutes(3), 30);
  assert.equal(poAppRetryDelayMinutes(9), 120);
  assert.equal(poAppRetryDelayMinutes(1, true), 360);
});

test("the sync interval is clamped to a sane range", () => {
  assert.equal(normalizeSyncIntervalMinutes(60), 60);
  assert.equal(normalizeSyncIntervalMinutes(1), 15);
  assert.equal(normalizeSyncIntervalMinutes(99999), 1440);
  assert.equal(normalizeSyncIntervalMinutes("nope"), 60);
});
