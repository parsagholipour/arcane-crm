import assert from "node:assert/strict";
import test from "node:test";
import {
  carrierTrackingUrl,
  isExceptionShipmentStatus,
  isLikelyUspsTrackingNumber,
  isTerminalShipmentStatus,
  isUspsCarrier,
  mapUspsTracking,
  normalizeCarrier,
  normalizeTrackingNumber,
  shipmentStatusLabel,
  uspsPollDelayMinutes,
  uspsRetryDelayMinutes
} from "@/lib/usps-status";

test("USPS status phrases map to shipment states", () => {
  assert.equal(mapUspsTracking({ statusCategory: "Delivered" }).status, "Delivered");
  assert.equal(mapUspsTracking({ statusCategory: "Out for Delivery" }).status, "OutForDelivery");
  assert.equal(mapUspsTracking({ statusCategory: "In Transit to Next Facility" }).status, "InTransit");
  assert.equal(mapUspsTracking({ statusCategory: "Pre-Shipment" }).status, "Pending");
  assert.equal(mapUspsTracking({ statusCategory: "Return to Sender" }).status, "Returned");
  assert.equal(mapUspsTracking({ statusCategory: "Alert" }).status, "Alert");
});

test("delivery-adjacent exception phrases never read as delivered", () => {
  // These all contain "delivered"/"delivery" and would false-positive on a naive match.
  assert.equal(mapUspsTracking({ statusCategory: "Delivery Attempt: Action Needed" }).status, "Alert");
  assert.equal(mapUspsTracking({ statusCategory: "Alert: Not Delivered" }).status, "Alert");
  assert.equal(mapUspsTracking({ statusCategory: "Available for Pickup" }).status, "Alert");
  assert.equal(mapUspsTracking({ statusCategory: "Out for Delivery" }).status, "OutForDelivery");
});

test("an unrecognized status keeps polling instead of firing a notification", () => {
  const mapped = mapUspsTracking({ statusCategory: "Some Phrase USPS Invented Later" });
  assert.equal(mapped.status, "InTransit");
  assert.equal(mapped.deliveredAt, null);
  assert.equal(isTerminalShipmentStatus(mapped.status), false);
  assert.equal(isExceptionShipmentStatus(mapped.status), false);
});

test("status falls back to the newest tracking event when the category is missing", () => {
  const mapped = mapUspsTracking({
    trackingEvents: [{ eventType: "Delivered, In/At Mailbox", eventTimestamp: "2026-08-01T14:30:00Z" }]
  });
  assert.equal(mapped.status, "Delivered");
});

test("delivery time comes from the scan, not from the moment we polled", () => {
  const mapped = mapUspsTracking({
    statusCategory: "Delivered",
    statusSummary: "Your item was delivered at 2:30 pm.",
    expectedDeliveryTimeStamp: "2026-08-01T18:00:00Z",
    trackingEvents: [
      {
        eventType: "Delivered, Front Door/Porch",
        eventTimestamp: "2026-08-01T14:30:00Z",
        eventCity: "Austin",
        eventState: "TX"
      },
      { eventType: "Out for Delivery", eventTimestamp: "2026-08-01T09:12:00Z" }
    ]
  });
  assert.equal(mapped.deliveredAt?.toISOString(), "2026-08-01T14:30:00.000Z");
  assert.equal(mapped.lastEventAt?.toISOString(), "2026-08-01T14:30:00.000Z");
  assert.equal(mapped.lastEventDescription, "Delivered, Front Door/Porch — Austin, TX");
  assert.equal(mapped.expectedDeliveryAt?.toISOString(), "2026-08-01T18:00:00.000Z");
  assert.equal(mapped.statusSummary, "Your item was delivered at 2:30 pm.");
});

test("malformed timestamps degrade to null rather than an Invalid Date", () => {
  const mapped = mapUspsTracking({
    statusCategory: "In Transit",
    expectedDeliveryTimeStamp: "not-a-date",
    trackingEvents: [{ eventType: "Arrived at Facility", eventTimestamp: "" }]
  });
  assert.equal(mapped.expectedDeliveryAt, null);
  assert.equal(mapped.lastEventAt, null);
});

test("an empty payload does not throw", () => {
  const mapped = mapUspsTracking({});
  assert.equal(mapped.status, "InTransit");
  assert.equal(mapped.statusSummary, null);
  assert.equal(mapped.lastEventDescription, null);
});

test("terminal statuses stop polling and moving statuses tighten the cadence", () => {
  assert.equal(uspsPollDelayMinutes("Delivered"), null);
  assert.equal(uspsPollDelayMinutes("Returned"), null);
  assert.equal(uspsPollDelayMinutes("Expired"), null);
  assert.equal(uspsPollDelayMinutes("Failed"), null);
  assert.equal(uspsPollDelayMinutes("OutForDelivery"), 30);
  assert.equal(uspsPollDelayMinutes("InTransit"), 180);
  assert.equal(uspsPollDelayMinutes("Pending"), 360);
  assert.equal(uspsPollDelayMinutes("Alert"), 360);
});

test("retries back off to a two-hour cap", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 9].map(uspsRetryDelayMinutes), [5, 15, 30, 60, 120, 120]);
});

test("tracking numbers are normalized before validation and lookup", () => {
  assert.equal(normalizeTrackingNumber(" 9400 1000 0000 0000 0000 00 "), "9400100000000000000000");
  assert.equal(normalizeTrackingNumber("lz-123456789-us"), "LZ123456789US");
  assert.equal(normalizeTrackingNumber(null), "");
});

test("USPS tracking numbers accept domestic and international forms", () => {
  assert.equal(isLikelyUspsTrackingNumber("9400 1000 0000 0000 0000 00"), true);
  assert.equal(isLikelyUspsTrackingNumber("LZ123456789US"), true);
  assert.equal(isLikelyUspsTrackingNumber("lz123456789us"), true);
  assert.equal(isLikelyUspsTrackingNumber("1Z999AA10123456784"), false, "a UPS number is not USPS");
  assert.equal(isLikelyUspsTrackingNumber("123"), false);
  assert.equal(isLikelyUspsTrackingNumber(""), false);
});

test("carrier names normalize case and only USPS is treated as pollable", () => {
  assert.equal(normalizeCarrier("usps"), "USPS");
  assert.equal(normalizeCarrier("FEDEX"), "FedEx");
  assert.equal(isUspsCarrier(" UsPs "), true);
  assert.equal(isUspsCarrier("UPS"), false);
  assert.equal(isUspsCarrier(null), false);
});

test("carrier tracking links are built per courier and skipped when unknown", () => {
  assert.equal(
    carrierTrackingUrl("USPS", "9400 1000 0000 0000 0000 00"),
    "https://tools.usps.com/go/TrackConfirmAction?tLabels=9400100000000000000000"
  );
  assert.match(String(carrierTrackingUrl("FedEx", "123456789012")), /^https:\/\/www\.fedex\.com/);
  assert.equal(carrierTrackingUrl("Other", "123456789012"), null);
  assert.equal(carrierTrackingUrl("USPS", ""), null);
});

test("status labels stay readable in the UI", () => {
  assert.equal(shipmentStatusLabel("OutForDelivery"), "Out for Delivery");
  assert.equal(shipmentStatusLabel("InTransit"), "In Transit");
  assert.equal(shipmentStatusLabel("Delivered"), "Delivered");
});
