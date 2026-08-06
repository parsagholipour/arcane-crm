-- Link a CRM product back to the PO App product it was imported from, and carry over the
-- catalogue attributes PO App owns. poAppUpdatedAt is the upstream updatedAt: webhooks are
-- unordered, so a write only applies when it is at least as new as what is already stored.
ALTER TABLE "Product" ADD COLUMN "poAppProductId" TEXT;
ALTER TABLE "Product" ADD COLUMN "poAppUpdatedAt" TIMESTAMP(3);
ALTER TABLE "Product" ADD COLUMN "poAppSyncedAt" TIMESTAMP(3);
ALTER TABLE "Product" ADD COLUMN "poAppDeletedAt" TIMESTAMP(3);
ALTER TABLE "Product" ADD COLUMN "upcGtin" TEXT;
ALTER TABLE "Product" ADD COLUMN "imageLink" TEXT;
ALTER TABLE "Product" ADD COLUMN "cost" DECIMAL(18,2);
ALTER TABLE "Product" ADD COLUMN "price" DECIMAL(18,2);
ALTER TABLE "Product" ADD COLUMN "mapPrice" DECIMAL(18,2);
ALTER TABLE "Product" ADD COLUMN "msrp" DECIMAL(18,2);
ALTER TABLE "Product" ADD COLUMN "minimumOrderPieces" INTEGER;
ALTER TABLE "Product" ADD COLUMN "quantityPerCarton" INTEGER;
ALTER TABLE "Product" ADD COLUMN "stockCount" INTEGER;
ALTER TABLE "Product" ADD COLUMN "orderByDate" TIMESTAMP(3);
ALTER TABLE "Product" ADD COLUMN "editingStatus" TEXT;
ALTER TABLE "Product" ADD COLUMN "verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN "manufacturerName" TEXT;
ALTER TABLE "Product" ADD COLUMN "manufacturerRegion" TEXT;
ALTER TABLE "Product" ADD COLUMN "manufacturerEmail" TEXT;
ALTER TABLE "Product" ADD COLUMN "manufacturerPhone" TEXT;
ALTER TABLE "Product" ADD COLUMN "productType" TEXT;
ALTER TABLE "Product" ADD COLUMN "collectionName" TEXT;

-- Makes the importer's upsert idempotent. Postgres treats NULLs as distinct, so every
-- manually created product keeps a NULL poAppProductId without colliding.
CREATE UNIQUE INDEX "Product_organizationId_poAppProductId_key" ON "Product"("organizationId", "poAppProductId");

-- One PO App connection per organization. Secrets are stored as AES-256-GCM ciphertext;
-- tokenPreview is the masked form the settings screen displays.
CREATE TABLE "PoAppIntegration" (
    "organizationId" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "tokenCiphertext" TEXT,
    "tokenPreview" TEXT,
    "webhookSecretCipher" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "storeId" TEXT,
    "syncIntervalMinutes" INTEGER NOT NULL DEFAULT 60,
    "poStoreId" TEXT,
    "poStoreName" TEXT,
    "poTokenId" TEXT,
    "scopes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Disconnected',
    "lastError" TEXT,
    -- Lease held by the sync in progress. Cleared when a run ends, so back-to-back manual syncs
    -- are allowed while concurrent ones are not, and a crashed run frees itself after the horizon.
    "syncingSince" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "lastFullSyncAt" TIMESTAMP(3),
    "nextSyncAt" TIMESTAMP(3),
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "productsSynced" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PoAppIntegration_pkey" PRIMARY KEY ("organizationId")
);

-- Drives the scheduler's due query.
CREATE INDEX "PoAppIntegration_enabled_nextSyncAt_idx" ON "PoAppIntegration"("enabled", "nextSyncAt");

-- Webhook delivery is at-least-once. The primary key is the X-PO-Delivery id, which is stable
-- across retries, so an insert conflict is how a duplicate is detected. processedAt stays NULL
-- until the handler finishes, which lets a retry of an interrupted delivery run again.
CREATE TABLE "PoAppWebhookDelivery" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PoAppWebhookDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PoAppWebhookDelivery_organizationId_receivedAt_idx" ON "PoAppWebhookDelivery"("organizationId", "receivedAt");
