-- Let locally managed events belong to a persisted calendar source without changing existing events.
ALTER TABLE "Event" ADD COLUMN "calendarSourceId" TEXT;
ALTER TABLE "CalendarSource" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'Local';
ALTER TABLE "CalendarSource" ADD COLUMN "externalId" TEXT;
ALTER TABLE "CalendarSource" ADD COLUMN "connectionStatus" TEXT NOT NULL DEFAULT 'Local';
ALTER TABLE "CalendarSource" ADD COLUMN "readOnly" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CalendarSource" ADD COLUMN "lastSyncedAt" TIMESTAMP(3);
CREATE INDEX "Event_organizationId_calendarSourceId_startAt_idx" ON "Event"("organizationId", "calendarSourceId", "startAt");
CREATE INDEX "CalendarSource_organizationId_userId_idx" ON "CalendarSource"("organizationId", "userId");
ALTER TABLE "Event" ADD CONSTRAINT "Event_calendarSourceId_fkey" FOREIGN KEY ("calendarSourceId") REFERENCES "CalendarSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
