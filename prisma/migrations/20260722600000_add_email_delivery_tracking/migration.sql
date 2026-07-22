-- Persist provider acceptance separately from signed SendGrid delivery events.
CREATE TABLE "EmailDelivery" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "trackingKey" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'sendgrid',
    "providerMessageId" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "recipient" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Accepted',
    "recordedById" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3) NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "lastEventAt" TIMESTAMP(3),
    "lastReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmailDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailDeliveryEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "providerEventId" TEXT,
    "providerMessageId" TEXT,
    "eventType" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "response" TEXT,
    "raw" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailDeliveryEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailDelivery_organizationId_trackingKey_recipient_key" ON "EmailDelivery"("organizationId", "trackingKey", "recipient");
CREATE INDEX "EmailDelivery_organizationId_sourceType_sourceId_idx" ON "EmailDelivery"("organizationId", "sourceType", "sourceId");
CREATE INDEX "EmailDelivery_trackingKey_recipient_idx" ON "EmailDelivery"("trackingKey", "recipient");
CREATE INDEX "EmailDelivery_providerMessageId_idx" ON "EmailDelivery"("providerMessageId");
CREATE UNIQUE INDEX "EmailDeliveryEvent_providerEventId_key" ON "EmailDeliveryEvent"("providerEventId");
CREATE INDEX "EmailDeliveryEvent_organizationId_deliveryId_occurredAt_idx" ON "EmailDeliveryEvent"("organizationId", "deliveryId", "occurredAt");
ALTER TABLE "EmailDeliveryEvent" ADD CONSTRAINT "EmailDeliveryEvent_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "EmailDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
