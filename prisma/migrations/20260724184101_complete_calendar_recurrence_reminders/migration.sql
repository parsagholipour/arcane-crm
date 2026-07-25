-- AlterTable
ALTER TABLE "CampaignMember" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "recurrenceEndAt" TIMESTAMP(3),
ADD COLUMN     "recurrenceExceptionDates" TIMESTAMP(3)[],
ADD COLUMN     "recurrenceOriginalStart" TIMESTAMP(3),
ADD COLUMN     "recurrenceParentId" TEXT,
ADD COLUMN     "recurrenceRule" TEXT,
ADD COLUMN     "reminderMinutes" INTEGER;

-- AlterTable
ALTER TABLE "UserPreference" ADD COLUMN     "weekStartsOn" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "EventReminderDispatch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "occurrenceAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventReminderDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventReminderDispatch_organizationId_userId_idx" ON "EventReminderDispatch"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "EventReminderDispatch_organizationId_userId_eventId_occurre_key" ON "EventReminderDispatch"("organizationId", "userId", "eventId", "occurrenceAt");

-- CreateIndex
CREATE INDEX "Event_organizationId_recurrenceParentId_idx" ON "Event"("organizationId", "recurrenceParentId");

-- CreateIndex
CREATE INDEX "Event_organizationId_startAt_idx" ON "Event"("organizationId", "startAt");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_recurrenceParentId_fkey" FOREIGN KEY ("recurrenceParentId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "AttachmentRecord_organizationId_relatedObjectType_relatedRecord" RENAME TO "AttachmentRecord_organizationId_relatedObjectType_relatedRe_idx";

-- RenameIndex
ALTER INDEX "CommerceFulfillmentLine_organizationId_fulfillmentId_orderLineI" RENAME TO "CommerceFulfillmentLine_organizationId_fulfillmentId_orderL_key";

-- RenameIndex
ALTER INDEX "MarketingFormSubmission_organizationId_landingPageId_submittedA" RENAME TO "MarketingFormSubmission_organizationId_landingPageId_submit_idx";
