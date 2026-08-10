import "server-only";

import type { ShipmentTracking } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  announceOpportunityPostDeliveryFollowUp,
  announceShipmentStatus,
  OPPORTUNITY_POST_DELIVERY_FOLLOW_UP_DAYS,
  opportunityPostDeliveryFollowUpIsDue,
  SHIPMENT_NOTIFICATION_SKIPPED,
  type ShipmentNotificationDependencies
} from "@/lib/shipment-notifications";
import { fetchUspsTracking, UspsError, uspsTrackingConfigured } from "@/lib/usps-client";
import { persistOpportunityDeliveryDate } from "@/lib/shipment-tracking-sync";
import {
  isExceptionShipmentStatus,
  isTerminalShipmentStatus,
  mapUspsTracking,
  MAX_CONSECUTIVE_FAILURES,
  MAX_TRACKING_AGE_DAYS,
  TERMINAL_SHIPMENT_STATUSES,
  USPS_CARRIER,
  uspsPollDelayMinutes,
  uspsRetryDelayMinutes
} from "@/lib/usps-status";

const DEFAULT_BATCH_LIMIT = 50;
const MAX_BATCH_LIMIT = 200;
/** How long a claimed row stays off the due list, so a crashed run self-heals. */
const POLL_LEASE_MINUTES = 10;

export type ShipmentPollSummary = {
  processed: number;
  updated: number;
  delivered: number;
  alerted: number;
  /** Opportunity follow-ups fired 7 days after delivery. */
  followUps: number;
  retried: number;
  failed: number;
};

export type ShipmentPollOptions = {
  now?: Date;
  organizationId?: string;
  limit?: number;
  dependencies?: ShipmentNotificationDependencies;
};

function minutesFrom(now: Date, minutes: number) {
  return new Date(now.getTime() + minutes * 60 * 1000);
}

function safeFailureReason(error: unknown) {
  if (error instanceof UspsError) {
    switch (error.code) {
      case "not_configured":
        return "USPS tracking is not configured.";
      case "authentication":
        return "USPS rejected the configured credentials.";
      case "not_found":
        return "USPS has no record of this tracking number yet.";
      case "rate_limit":
        return "USPS is receiving too many requests.";
      case "timeout":
        return "USPS did not respond in time.";
      case "invalid_response":
        return "USPS returned a response we could not read.";
      default:
        return "USPS is temporarily unavailable.";
    }
  }
  return "The USPS status could not be refreshed.";
}

async function dueShipments(now: Date, organizationId: string | undefined, limit: number) {
  return prisma.shipmentTracking.findMany({
    where: {
      carrier: USPS_CARRIER,
      status: { notIn: TERMINAL_SHIPMENT_STATUSES },
      ...(organizationId ? { organizationId } : {}),
      OR: [{ nextPollAt: null }, { nextPollAt: { lte: now } }]
    },
    orderBy: [{ nextPollAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
    take: limit
  });
}

/**
 * Take exclusive ownership of a row by pushing its nextPollAt out to the lease horizon.
 * The compare-and-set doubles as the claim, so two concurrent runs never poll the same
 * shipment and no extra "Processing" status column is needed.
 */
async function claimShipment(tracking: ShipmentTracking, now: Date) {
  const claimed = await prisma.shipmentTracking.updateMany({
    where: {
      id: tracking.id,
      status: { notIn: TERMINAL_SHIPMENT_STATUSES },
      OR: [{ nextPollAt: null }, { nextPollAt: { lte: now } }]
    },
    data: {
      nextPollAt: minutesFrom(now, POLL_LEASE_MINUTES),
      lastPolledAt: now,
      attemptCount: { increment: 1 }
    }
  });
  if (!claimed.count) return null;
  return prisma.shipmentTracking.findUnique({ where: { id: tracking.id } });
}

async function expireShipment(tracking: ShipmentTracking, now: Date) {
  await prisma.shipmentTracking.update({
    where: { id: tracking.id },
    data: {
      status: "Expired",
      nextPollAt: null,
      lastError: `Tracking stopped after ${MAX_TRACKING_AGE_DAYS} days without delivery.`,
      lastPolledAt: now
    }
  });
}

/** Fire the delivery or exception notification at most once per shipment. */
async function announceIfNeeded(
  tracking: ShipmentTracking,
  summary: ShipmentPollSummary,
  dependencies: ShipmentNotificationDependencies
) {
  if (tracking.status === "Delivered" && !tracking.deliveredNotificationId) {
    const notificationId = await announceShipmentStatus(tracking, "delivered", dependencies);
    if (notificationId)
      await prisma.shipmentTracking.update({
        where: { id: tracking.id },
        data: { deliveredNotificationId: notificationId }
      });
    summary.delivered += 1;
    return;
  }
  if (isExceptionShipmentStatus(tracking.status) && !tracking.alertNotificationId) {
    const notificationId = await announceShipmentStatus(tracking, "exception", dependencies);
    if (notificationId)
      await prisma.shipmentTracking.update({
        where: { id: tracking.id },
        data: { alertNotificationId: notificationId }
      });
    summary.alerted += 1;
  }
}

/**
 * Opportunity owners get a one-time nudge a week after delivery. Delivered rows are terminal
 * for USPS polling, so this is a separate pass over already-delivered Opportunity shipments.
 */
async function announceDuePostDeliveryFollowUps(
  now: Date,
  organizationId: string | undefined,
  limit: number,
  summary: ShipmentPollSummary,
  dependencies: ShipmentNotificationDependencies
) {
  const dueBefore = new Date(now.getTime() - OPPORTUNITY_POST_DELIVERY_FOLLOW_UP_DAYS * 24 * 60 * 60 * 1000);
  const candidates = await prisma.shipmentTracking.findMany({
    where: {
      subjectType: "Opportunity",
      status: "Delivered",
      deliveredAt: { lte: dueBefore },
      postDeliveryNotificationId: null,
      ...(organizationId ? { organizationId } : {})
    },
    orderBy: [{ deliveredAt: "asc" }, { createdAt: "asc" }],
    take: limit
  });

  for (const candidate of candidates) {
    if (!opportunityPostDeliveryFollowUpIsDue(candidate.deliveredAt, now)) continue;
    try {
      const notificationId = await announceOpportunityPostDeliveryFollowUp(candidate, dependencies);
      if (notificationId && notificationId !== SHIPMENT_NOTIFICATION_SKIPPED) summary.followUps += 1;
    } catch (error) {
      // The atomic transaction rolled back, so the next sweep can safely retry this row.
      console.error("[shipments] post-delivery follow-up failed", error);
    }
  }
}

async function refreshShipment(
  tracking: ShipmentTracking,
  now: Date,
  summary: ShipmentPollSummary,
  dependencies: ShipmentNotificationDependencies
) {
  const mapped = mapUspsTracking(await fetchUspsTracking(tracking.trackingNumber));
  const delay = uspsPollDelayMinutes(mapped.status);
  const deliveredAt = mapped.deliveredAt ?? tracking.deliveredAt;
  const updated = await prisma.shipmentTracking.update({
    where: { id: tracking.id },
    data: {
      status: mapped.status,
      statusSummary: mapped.statusSummary,
      expectedDeliveryAt: mapped.expectedDeliveryAt,
      lastEventAt: mapped.lastEventAt,
      lastEventDescription: mapped.lastEventDescription,
      deliveredAt,
      nextPollAt: delay === null ? null : minutesFrom(now, delay),
      failureCount: 0,
      lastError: null
    }
  });
  await persistOpportunityDeliveryDate(prisma, updated, deliveredAt);
  summary.updated += 1;
  await announceIfNeeded(updated, summary, dependencies);
}

async function recordFailure(
  tracking: ShipmentTracking,
  error: unknown,
  now: Date,
  summary: ShipmentPollSummary,
  dependencies: ShipmentNotificationDependencies
) {
  const reason = safeFailureReason(error);
  const failureCount = tracking.failureCount + 1;
  const uspsError = error instanceof UspsError ? error : null;

  // A brand new label often has no USPS data yet, so "not found" backs off rather than
  // burning through the failure budget on its own.
  const exhausted = failureCount >= MAX_CONSECUTIVE_FAILURES && uspsError?.code !== "not_found";
  if (exhausted) {
    const failed = await prisma.shipmentTracking.update({
      where: { id: tracking.id },
      data: { status: "Failed", failureCount, nextPollAt: null, lastError: reason }
    });
    summary.failed += 1;
    await announceIfNeeded(failed, summary, dependencies);
    return;
  }

  const delayMinutes = uspsError?.code === "not_found" ? 360 : uspsRetryDelayMinutes(failureCount);
  await prisma.shipmentTracking.update({
    where: { id: tracking.id },
    data: { failureCount, nextPollAt: minutesFrom(now, delayMinutes), lastError: reason }
  });
  summary.retried += 1;
}

/**
 * Refresh every USPS shipment that is due, notifying owners on delivery and on exceptions,
 * then fire Opportunity follow-ups that are 7 days past delivery.
 * Called both by the scheduled dispatch route and by the in-app sweep (scoped to one org).
 */
export async function pollDueShipments(options: ShipmentPollOptions = {}): Promise<ShipmentPollSummary> {
  const now = options.now ?? new Date();
  const limit = Math.max(1, Math.min(options.limit ?? DEFAULT_BATCH_LIMIT, MAX_BATCH_LIMIT));
  const dependencies = options.dependencies ?? {};
  const summary: ShipmentPollSummary = {
    processed: 0,
    updated: 0,
    delivered: 0,
    alerted: 0,
    followUps: 0,
    retried: 0,
    failed: 0
  };

  // Follow-ups only need deliveredAt; they do not call USPS. Run them even when tracking
  // credentials are missing so Opportunity owners still get the week-later nudge.
  await announceDuePostDeliveryFollowUps(now, options.organizationId, limit, summary, dependencies);

  if (!uspsTrackingConfigured()) return summary;

  const staleBefore = new Date(now.getTime() - MAX_TRACKING_AGE_DAYS * 24 * 60 * 60 * 1000);
  for (const candidate of await dueShipments(now, options.organizationId, limit)) {
    const tracking = await claimShipment(candidate, now);
    if (!tracking) continue;
    summary.processed += 1;

    if (tracking.createdAt <= staleBefore) {
      await expireShipment(tracking, now);
      continue;
    }
    try {
      await refreshShipment(tracking, now, summary, dependencies);
    } catch (error) {
      await recordFailure(tracking, error, now, summary, dependencies);
    }
  }

  return summary;
}

export { isTerminalShipmentStatus };
