-- Per-organization API token (hash only) and outbound Lead webhook settings.
CREATE TABLE "OrganizationApiAccess" (
    "organizationId" TEXT NOT NULL,
    "tokenHash" TEXT,
    "tokenPrefix" TEXT,
    "tokenCreatedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "webhookUrl" TEXT,
    "webhookSecretCipher" TEXT,
    "webhookEnabled" BOOLEAN NOT NULL DEFAULT false,
    "webhookFailureCount" INTEGER NOT NULL DEFAULT 0,
    "webhookLastError" TEXT,
    "webhookLastDeliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationApiAccess_pkey" PRIMARY KEY ("organizationId")
);

CREATE UNIQUE INDEX "OrganizationApiAccess_tokenHash_key" ON "OrganizationApiAccess"("tokenHash");

ALTER TABLE "OrganizationApiAccess" ADD CONSTRAINT "OrganizationApiAccess_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Durable outbox for signed Lead webhook deliveries. `id` is stable across retries.
CREATE TABLE "OrganizationWebhookDelivery" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "leadId" TEXT,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "responseStatus" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "OrganizationWebhookDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrganizationWebhookDelivery_status_nextAttemptAt_idx" ON "OrganizationWebhookDelivery"("status", "nextAttemptAt");

CREATE INDEX "OrganizationWebhookDelivery_organizationId_createdAt_idx" ON "OrganizationWebhookDelivery"("organizationId", "createdAt");

ALTER TABLE "OrganizationWebhookDelivery" ADD CONSTRAINT "OrganizationWebhookDelivery_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
