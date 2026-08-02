export const SHIPMENT_STATUSES = [
  "Pending",
  "InTransit",
  "OutForDelivery",
  "Alert",
  "Delivered",
  "Returned",
  "Expired",
  "Failed"
] as const;

export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

/** Statuses that stop the poller. Terminal rows keep a null nextPollAt. */
export const TERMINAL_SHIPMENT_STATUSES: ShipmentStatus[] = ["Delivered", "Returned", "Expired", "Failed"];

/** Statuses that warrant a one-time "this shipment needs attention" notification. */
export const EXCEPTION_SHIPMENT_STATUSES: ShipmentStatus[] = ["Alert", "Returned", "Failed"];

export const USPS_CARRIER = "USPS";
export const COURIERS = ["USPS", "UPS", "FedEx", "DHL", "Other"] as const;
export const MAX_CONSECUTIVE_FAILURES = 8;
export const MAX_TRACKING_AGE_DAYS = 45;

export function isTerminalShipmentStatus(status: string) {
  return TERMINAL_SHIPMENT_STATUSES.includes(status as ShipmentStatus);
}

export function isExceptionShipmentStatus(status: string) {
  return EXCEPTION_SHIPMENT_STATUSES.includes(status as ShipmentStatus);
}

export type UspsTrackingEvent = {
  eventType?: string | null;
  eventTimestamp?: string | null;
  eventCity?: string | null;
  eventState?: string | null;
  eventZIP?: string | null;
};

export type UspsTrackingResponse = {
  trackingNumber?: string | null;
  statusCategory?: string | null;
  statusSummary?: string | null;
  expectedDeliveryTimeStamp?: string | null;
  trackingEvents?: UspsTrackingEvent[] | null;
};

export type MappedShipment = {
  status: ShipmentStatus;
  statusSummary: string | null;
  expectedDeliveryAt: Date | null;
  lastEventAt: Date | null;
  lastEventDescription: string | null;
  deliveredAt: Date | null;
};

/**
 * USPS returns verbatim English phrases rather than a fixed enum, so these rules match
 * on substrings in priority order. Order matters: "Delivery Attempt" and "Not Delivered"
 * both contain "delivered", and must lose to the exception rules above them.
 */
const STATUS_RULES: Array<{ status: ShipmentStatus; phrases: string[] }> = [
  { status: "Returned", phrases: ["return to sender", "returned to sender", "return requested"] },
  {
    status: "Alert",
    phrases: [
      "alert",
      "delivery attempt",
      "attempted delivery",
      "not delivered",
      "undeliverable",
      "available for pickup",
      "held",
      "no access",
      "delayed",
      "delivery exception"
    ]
  },
  { status: "OutForDelivery", phrases: ["out for delivery"] },
  { status: "Delivered", phrases: ["delivered", "delivery complete"] },
  { status: "Pending", phrases: ["pre-shipment", "label created", "shipping label", "awaiting item"] },
  { status: "InTransit", phrases: ["in transit", "accepted", "arrived", "departed", "processing", "in-transit"] }
];

function matchStatus(phrase: string): ShipmentStatus | null {
  const normalized = phrase.trim().toLowerCase();
  if (!normalized) return null;
  for (const rule of STATUS_RULES) {
    if (rule.phrases.some((candidate) => normalized.includes(candidate))) return rule.status;
  }
  return null;
}

function parseDate(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(String(value));
  return Number.isFinite(date.getTime()) ? date : null;
}

function eventDescription(event: UspsTrackingEvent) {
  const place = [event.eventCity, event.eventState].filter((part) => Boolean(part && String(part).trim())).join(", ");
  const label = String(event.eventType ?? "").trim();
  if (label && place) return `${label} — ${place}`;
  return label || place || null;
}

/**
 * Translate a USPS tracking payload into the fields we persist. An unrecognized phrase
 * falls back to InTransit so the poller keeps watching rather than firing a wrong
 * "delivered" notification.
 */
export function mapUspsTracking(response: UspsTrackingResponse): MappedShipment {
  const events = (response.trackingEvents ?? []).filter(Boolean);
  const latest = events[0] ?? null;
  const fromCategory = matchStatus(String(response.statusCategory ?? ""));
  const fromEvent = latest ? matchStatus(String(latest.eventType ?? "")) : null;
  const status = fromCategory ?? fromEvent ?? "InTransit";
  const deliveryEvent = events.find((event) => matchStatus(String(event.eventType ?? "")) === "Delivered");

  return {
    status,
    statusSummary: String(response.statusSummary ?? response.statusCategory ?? "").trim() || null,
    expectedDeliveryAt: parseDate(response.expectedDeliveryTimeStamp),
    lastEventAt: latest ? parseDate(latest.eventTimestamp) : null,
    lastEventDescription: latest ? eventDescription(latest) : null,
    // Prefer the scan timestamp over "now" so a late poll still records the real delivery time.
    deliveredAt:
      status === "Delivered" ? ((deliveryEvent ? parseDate(deliveryEvent.eventTimestamp) : null) ?? new Date()) : null
  };
}

/** How long to wait before the next successful poll. Terminal statuses stop polling. */
export function uspsPollDelayMinutes(status: ShipmentStatus): number | null {
  if (isTerminalShipmentStatus(status)) return null;
  if (status === "OutForDelivery") return 30;
  if (status === "InTransit") return 180;
  return 360;
}

/** Backoff after a transient USPS failure, capped at two hours. */
export function uspsRetryDelayMinutes(failureCount: number) {
  if (failureCount <= 1) return 5;
  if (failureCount === 2) return 15;
  if (failureCount === 3) return 30;
  if (failureCount === 4) return 60;
  return 120;
}

export function normalizeTrackingNumber(value: unknown) {
  return String(value ?? "")
    .replace(/[\s-]/g, "")
    .toUpperCase();
}

export function normalizeCarrier(value: unknown) {
  const normalized = String(value ?? "").trim();
  const match = COURIERS.find((courier) => courier.toLowerCase() === normalized.toLowerCase());
  return match ?? normalized;
}

export function isUspsCarrier(value: unknown) {
  return normalizeCarrier(value) === USPS_CARRIER;
}

/** Domestic USPS numbers are 20-22 digits; international shipments use the S10 form. */
export function isLikelyUspsTrackingNumber(value: unknown) {
  const normalized = normalizeTrackingNumber(value);
  return /^\d{20,22}$/.test(normalized) || /^[A-Z]{2}\d{9}US$/.test(normalized);
}

export function carrierTrackingUrl(carrier: unknown, trackingNumber: unknown) {
  const number = normalizeTrackingNumber(trackingNumber);
  if (!number) return null;
  const encoded = encodeURIComponent(number);
  switch (normalizeCarrier(carrier)) {
    case "USPS":
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encoded}`;
    case "UPS":
      return `https://www.ups.com/track?tracknum=${encoded}`;
    case "FedEx":
      return `https://www.fedex.com/fedextrack/?trknbr=${encoded}`;
    case "DHL":
      return `https://www.dhl.com/en/express/tracking.html?AWB=${encoded}`;
    default:
      return null;
  }
}

export function shipmentStatusLabel(status: string) {
  switch (status) {
    case "InTransit":
      return "In Transit";
    case "OutForDelivery":
      return "Out for Delivery";
    case "Alert":
      return "Needs Attention";
    case "Expired":
      return "No Longer Tracked";
    case "Failed":
      return "Tracking Unavailable";
    default:
      return status;
  }
}
