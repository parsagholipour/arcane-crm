-- Record the courier and tracking number a sales rep is waiting on so USPS shipments
-- can be followed without leaving the Opportunity.
ALTER TABLE "Opportunity" ADD COLUMN "courier" TEXT;
ALTER TABLE "Opportunity" ADD COLUMN "trackingNumber" TEXT;

-- Polling state for a carrier shipment attached to a CRM record. Kept out of the
-- subject tables because it is job bookkeeping, not data anybody types.
CREATE TABLE "ShipmentTracking" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "carrier" TEXT NOT NULL,
    "trackingNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "statusSummary" TEXT,
    "expectedDeliveryAt" TIMESTAMP(3),
    "lastEventAt" TIMESTAMP(3),
    "lastEventDescription" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "deliveredNotificationId" TEXT,
    "alertNotificationId" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "lastPolledAt" TIMESTAMP(3),
    "nextPollAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShipmentTracking_pkey" PRIMARY KEY ("id")
);

-- One shipment per subject record, so re-saving the same tracking number is a no-op.
CREATE UNIQUE INDEX "ShipmentTracking_organizationId_subjectType_subjectId_key" ON "ShipmentTracking"("organizationId", "subjectType", "subjectId");

-- Drives the scheduler's due query.
CREATE INDEX "ShipmentTracking_carrier_status_nextPollAt_idx" ON "ShipmentTracking"("carrier", "status", "nextPollAt");

CREATE INDEX "ShipmentTracking_organizationId_subjectType_subjectId_idx" ON "ShipmentTracking"("organizationId", "subjectType", "subjectId");
