-- Add real marketing landing pages and lead-capture submissions without changing existing marketing data.
CREATE TABLE "MarketingLandingPage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "headline" TEXT NOT NULL,
    "description" TEXT,
    "submitLabel" TEXT NOT NULL DEFAULT 'Submit',
    "successMessage" TEXT NOT NULL DEFAULT 'Thanks. Your information was received.',
    "fields" TEXT[],
    "campaignId" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingLandingPage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketingFormSubmission" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "landingPageId" TEXT NOT NULL,
    "leadId" TEXT,
    "data" JSONB NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingFormSubmission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketingLandingPage_organizationId_name_key" ON "MarketingLandingPage"("organizationId", "name");
CREATE UNIQUE INDEX "MarketingLandingPage_organizationId_slug_key" ON "MarketingLandingPage"("organizationId", "slug");
CREATE INDEX "MarketingLandingPage_organizationId_status_updatedAt_idx" ON "MarketingLandingPage"("organizationId", "status", "updatedAt");
CREATE INDEX "MarketingLandingPage_organizationId_campaignId_idx" ON "MarketingLandingPage"("organizationId", "campaignId");
CREATE INDEX "MarketingFormSubmission_organizationId_landingPageId_submittedAt_idx" ON "MarketingFormSubmission"("organizationId", "landingPageId", "submittedAt");
CREATE INDEX "MarketingFormSubmission_organizationId_leadId_idx" ON "MarketingFormSubmission"("organizationId", "leadId");

ALTER TABLE "MarketingLandingPage" ADD CONSTRAINT "MarketingLandingPage_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketingFormSubmission" ADD CONSTRAINT "MarketingFormSubmission_landingPageId_fkey"
    FOREIGN KEY ("landingPageId") REFERENCES "MarketingLandingPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingFormSubmission" ADD CONSTRAINT "MarketingFormSubmission_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
