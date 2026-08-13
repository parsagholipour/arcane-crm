import "server-only";

import type { Prisma, ShipmentTracking } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isUspsCarrier, normalizeCarrier, normalizeTrackingNumber, USPS_CARRIER } from "@/lib/usps-status";

export type ShipmentSubjectType = "Opportunity" | "Lead" | "CommerceFulfillment";

/** Subjects that keep the carrier delivery timestamp on their own row (Lead samples included). */
export type DeliveryDateSubjectType = "Opportunity" | "Lead";

type TrackingClient = Pick<Prisma.TransactionClient, "shipmentTracking" | "opportunity" | "lead"> | typeof prisma;

export type ShipmentSubject = {
  organizationId: string;
  subjectType: ShipmentSubjectType;
  subjectId: string;
  carrier: unknown;
  trackingNumber: unknown;
};

/**
 * Reconcile the ShipmentTracking row for a subject record with whatever carrier and
 * tracking number it now carries. Safe to call on every save: an unchanged tracking
 * number is a no-op, so a Kanban stage drag never disturbs the polling schedule.
 */
export async function syncShipmentTracking(client: TrackingClient, subject: ShipmentSubject, now = new Date()) {
  const carrier = normalizeCarrier(subject.carrier);
  const trackingNumber = normalizeTrackingNumber(subject.trackingNumber);
  const where = {
    organizationId: subject.organizationId,
    subjectType: subject.subjectType,
    subjectId: subject.subjectId
  };

  // Only USPS is polled today. Anything else stores its number on the subject record and
  // renders a carrier link, so a tracking row would just be dead weight.
  if (!isUspsCarrier(carrier) || !trackingNumber) {
    const deleted = await client.shipmentTracking.deleteMany({ where });
    // Drop the denormalized delivery date when its USPS tracking goes away, otherwise
    // lists/shipping UI keep showing a date with no active shipment.
    if (deleted.count > 0) await clearSubjectDeliveryDate(client, subject);
    return null;
  }

  const existing = await client.shipmentTracking.findUnique({
    where: { organizationId_subjectType_subjectId: where }
  });
  if (existing && existing.trackingNumber === trackingNumber && existing.carrier === USPS_CARRIER) return existing;

  if (!existing) {
    // A fresh tracking row means this subject is waiting on a new shipment.
    await clearSubjectDeliveryDate(client, subject);
    return client.shipmentTracking.create({
      data: { ...where, carrier: USPS_CARRIER, trackingNumber, status: "Pending", nextPollAt: now }
    });
  }

  // A new tracking number is a new shipment: clear the status, the retry counters, and the
  // one-time notification guards so the replacement can notify on its own delivery.
  await clearSubjectDeliveryDate(client, subject);
  return client.shipmentTracking.update({
    where: { id: existing.id },
    data: {
      carrier: USPS_CARRIER,
      trackingNumber,
      status: "Pending",
      statusSummary: null,
      expectedDeliveryAt: null,
      lastEventAt: null,
      lastEventDescription: null,
      deliveredAt: null,
      deliveredNotificationId: null,
      postDeliveryNotificationId: null,
      alertNotificationId: null,
      attemptCount: 0,
      failureCount: 0,
      lastPolledAt: null,
      nextPollAt: now,
      lastError: null
    }
  });
}

/**
 * Write the delivery date onto whichever subject denormalizes it. Commerce fulfillments keep
 * their own column, so they are skipped here.
 */
async function writeSubjectDeliveryDate(
  client: TrackingClient,
  subjectType: string,
  organizationId: string,
  subjectId: string,
  deliveryDate: Date | null
) {
  const where = { id: subjectId, organizationId };
  if (subjectType === "Opportunity") await client.opportunity.updateMany({ where, data: { deliveryDate } });
  else if (subjectType === "Lead") await client.lead.updateMany({ where, data: { deliveryDate } });
}

/** Drop a stale delivery date when a subject's USPS tracking row is created, replaced, or removed. */
async function clearSubjectDeliveryDate(client: TrackingClient, subject: ShipmentSubject) {
  await writeSubjectDeliveryDate(client, subject.subjectType, subject.organizationId, subject.subjectId, null);
}

/**
 * Copy the carrier delivery timestamp onto the Opportunity or Lead so lists and forms can show
 * it without joining ShipmentTracking. No-op for commerce fulfillments (they keep their own column).
 */
export async function persistSubjectDeliveryDate(
  client: TrackingClient,
  tracking: Pick<ShipmentTracking, "organizationId" | "subjectType" | "subjectId" | "status">,
  deliveredAt: Date | null
) {
  if (tracking.status !== "Delivered" || !deliveredAt) return;
  await writeSubjectDeliveryDate(
    client,
    tracking.subjectType,
    tracking.organizationId,
    tracking.subjectId,
    deliveredAt
  );
}

/**
 * Sync from a saved record rather than the request payload: a PATCH is partial, so only the
 * persisted row knows the resulting courier and tracking number. Opportunity shipments and
 * Lead samples carry the same trio of columns, so both come through here.
 */
export async function syncRecordShipment(
  organizationId: string,
  subjectType: DeliveryDateSubjectType,
  record: unknown
) {
  const saved = record as { id?: unknown; courier?: unknown; trackingNumber?: unknown };
  if (typeof saved?.id !== "string") return null;
  return syncShipmentTracking(prisma, {
    organizationId,
    subjectType,
    subjectId: saved.id,
    carrier: saved.courier,
    trackingNumber: saved.trackingNumber
  });
}

/** Load carrier status for many subjects at once, keyed by subject id. */
export async function shipmentTrackingBySubject(
  organizationId: string,
  subjectType: ShipmentSubjectType,
  subjectIds: string[]
) {
  if (!subjectIds.length) return new Map<string, ShipmentTracking>();
  const rows = await prisma.shipmentTracking.findMany({
    where: { organizationId, subjectType, subjectId: { in: [...new Set(subjectIds)] } }
  });
  return new Map(rows.map((row) => [row.subjectId, row]));
}

/** Attach each subject's live carrier status as a `shipment` property. */
export function attachShipmentTracking<T extends { id: string }>(
  subjects: T[],
  bySubject: Map<string, ShipmentTracking>
) {
  if (!bySubject.size) return subjects;
  return subjects.map((subject) => {
    const shipment = bySubject.get(subject.id);
    return shipment ? { ...subject, shipment } : subject;
  });
}

/** Drop tracking for a deleted subject so the poller stops chasing a record nobody can open. */
export async function deleteShipmentTracking(
  organizationId: string,
  subjectType: ShipmentSubjectType,
  subjectId: string
) {
  await prisma.shipmentTracking.deleteMany({ where: { organizationId, subjectType, subjectId } });
}

/** Close out a shipment a human marked delivered so the poller stops chasing it. */
export async function markShipmentDelivered(
  client: TrackingClient,
  subject: Omit<ShipmentSubject, "carrier" | "trackingNumber">,
  now = new Date()
) {
  await client.shipmentTracking.updateMany({
    where: {
      organizationId: subject.organizationId,
      subjectType: subject.subjectType,
      subjectId: subject.subjectId,
      status: { notIn: ["Delivered", "Returned"] }
    },
    data: { status: "Delivered", deliveredAt: now, nextPollAt: null, lastError: null }
  });
}
