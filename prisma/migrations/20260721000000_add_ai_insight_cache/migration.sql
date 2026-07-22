CREATE TABLE "AiInsightCache" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "surface" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "usage" JSONB,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiInsightCache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiInsightCache_organizationId_userId_surface_scopeKey_key"
ON "AiInsightCache"("organizationId", "userId", "surface", "scopeKey");

CREATE INDEX "AiInsightCache_organizationId_userId_surface_idx"
ON "AiInsightCache"("organizationId", "userId", "surface");
