-- New events default to a 24-hour reminder. Existing NULL values remain NULL.
ALTER TABLE "Event" ALTER COLUMN "reminderMinutes" SET DEFAULT 1440;

-- Existing dispatches are deliberately marked Legacy so reminders that already
-- fired before email delivery was introduced cannot be sent again.
ALTER TABLE "EventReminderDispatch"
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'Legacy',
ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastAttemptAt" TIMESTAMP(3),
ADD COLUMN "nextAttemptAt" TIMESTAMP(3),
ADD COLUMN "emailAcceptedAt" TIMESTAMP(3),
ADD COLUMN "notificationId" TEXT,
ADD COLUMN "warningNotificationId" TEXT,
ADD COLUMN "lastError" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "EventReminderDispatch_status_nextAttemptAt_idx"
ON "EventReminderDispatch"("status", "nextAttemptAt");
