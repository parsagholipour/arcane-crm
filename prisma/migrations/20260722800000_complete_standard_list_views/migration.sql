-- Add the standard fields required by visible CRM list views and preserve all rows.
ALTER TABLE "Contact" ADD COLUMN "birthDate" TIMESTAMP(3);

ALTER TABLE "Lead"
    ADD COLUMN "convertedAt" TIMESTAMP(3),
    ADD COLUMN "convertedAccountId" TEXT,
    ADD COLUMN "convertedContactId" TEXT,
    ADD COLUMN "convertedOpportunityId" TEXT;

CREATE INDEX "Lead_organizationId_convertedAt_idx" ON "Lead"("organizationId", "convertedAt");

-- Quick Text favorites are personal, organization-scoped state rather than browser-only state.
CREATE TABLE "QuickTextFavorite" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quickTextId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuickTextFavorite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QuickTextFavorite_organizationId_userId_quickTextId_key"
    ON "QuickTextFavorite"("organizationId", "userId", "quickTextId");
CREATE INDEX "QuickTextFavorite_organizationId_userId_createdAt_idx"
    ON "QuickTextFavorite"("organizationId", "userId", "createdAt");

ALTER TABLE "QuickTextFavorite"
    ADD CONSTRAINT "QuickTextFavorite_quickTextId_fkey"
    FOREIGN KEY ("quickTextId") REFERENCES "QuickText"("id") ON DELETE CASCADE ON UPDATE CASCADE;
