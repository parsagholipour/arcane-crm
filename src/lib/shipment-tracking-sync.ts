import "server-only";

import type { Prisma, ShipmentTracking } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isUspsCarrier, normalizeCarrier, normalizeTrackingNumber, USPS_CARRIER } from "@/lib/usps-status";

export type ShipmentSubjectType = "Opportunity" | "CommerceFulfillment";

type TrackingClient = Pick<Prisma.TransactionClient, "shipmentTracking"> | typeof prisma;

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
    await client.shipmentTracking.deleteMany({ where });
    return null;
  }

  const existing = await client.shipmentTracking.findUnique({
    where: { organizationId_subjectType_subjectId: where }
  });
  if (existing && existing.trackingNumber === trackingNumber && existing.carrier === USPS_CARRIER) return existing;

  if (!existing) {
    return client.shipmentTracking.create({
      data: { ...where, carrier: USPS_CARRIER, trackingNumber, status: "Pending", nextPollAt: now }
    });
  }

  // A new tracking number is a new shipment: clear the status, the retry counters, and the
  // one-time notification guards so the replacement can notify on its own delivery.
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
 * Sync from a saved record rather than the request payload: a PATCH is partial, so only the
 * persisted row knows the resulting courier and tracking number.
 */
export async function syncOpportunityShipment(organizationId: string, record: unknown) {
  const saved = record as { id?: unknown; courier?: unknown; trackingNumber?: unknown };
  if (typeof saved?.id !== "string") return null;
  return syncShipmentTracking(prisma, {
    organizationId,
    subjectType: "Opportunity",
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
