-- One-time reminder when a Lead's Sample Requested Date has passed and Sample Status is
-- still unshipped (Need shipping or none). Null means the sweep has not fired yet.
ALTER TABLE "Lead" ADD COLUMN "sampleRequestedNotificationId" TEXT;

CREATE INDEX "Lead_sample_requested_due_idx" ON "Lead"("sampleRequestedNotificationId", "sampleRequestedDate", "convertedAt");
