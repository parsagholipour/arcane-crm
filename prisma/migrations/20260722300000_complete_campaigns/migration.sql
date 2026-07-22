-- Expand the association-only campaign records into first-class marketing campaigns.
ALTER TABLE "Campaign"
    ADD COLUMN "type" TEXT NOT NULL DEFAULT 'Email',
    ADD COLUMN "parentCampaignId" TEXT,
    ADD COLUMN "startDate" TIMESTAMP(3),
    ADD COLUMN "endDate" TIMESTAMP(3),
    ADD COLUMN "budgetedCost" DECIMAL(18,2),
    ADD COLUMN "actualCost" DECIMAL(18,2),
    ADD COLUMN "expectedRevenue" DECIMAL(18,2),
    ADD COLUMN "description" TEXT,
    ADD COLUMN "createdById" TEXT,
    ADD COLUMN "activatedAt" TIMESTAMP(3),
    ADD COLUMN "completedAt" TIMESTAMP(3),
    ADD COLUMN "archivedAt" TIMESTAMP(3);

UPDATE "Campaign" campaign
SET "createdById" = COALESCE(campaign."ownerId", (
    SELECT membership."userId"
    FROM "OrganizationMembership" membership
    WHERE membership."organizationId" = campaign."organizationId" AND membership."status" = 'ACTIVE'
    ORDER BY membership."createdAt" ASC
    LIMIT 1
), 'campaign-migration');

ALTER TABLE "Campaign" ALTER COLUMN "createdById" SET NOT NULL;

ALTER TABLE "CampaignMember"
    ADD COLUMN "responded" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "firstRespondedAt" TIMESTAMP(3),
    ADD COLUMN "notes" TEXT,
    ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "Campaign_organizationId_status_startDate_idx" ON "Campaign"("organizationId", "status", "startDate");
CREATE INDEX "Campaign_organizationId_parentCampaignId_idx" ON "Campaign"("organizationId", "parentCampaignId");
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_parentCampaignId_fkey" FOREIGN KEY ("parentCampaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
