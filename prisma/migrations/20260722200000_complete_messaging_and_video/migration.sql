-- Expand the read-only Messaging Session and Video Call scaffolds while preserving existing rows.
ALTER TABLE "MessagingSession"
    ADD COLUMN "subject" TEXT,
    ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'Web Chat',
    ADD COLUMN "accountId" TEXT,
    ADD COLUMN "contactId" TEXT,
    ADD COLUMN "externalId" TEXT,
    ADD COLUMN "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN "endedAt" TIMESTAMP(3),
    ADD COLUMN "lastMessageAt" TIMESTAMP(3),
    ADD COLUMN "createdById" TEXT;

UPDATE "MessagingSession" session
SET
    "name" = COALESCE(NULLIF(TRIM(session."name"), ''), 'Messaging Session ' || SUBSTRING(session."id", 1, 8)),
    "status" = CASE LOWER(COALESCE(session."status", 'open'))
        WHEN 'closed' THEN 'Closed'
        WHEN 'waiting' THEN 'Waiting'
        ELSE 'Open'
    END,
    "ownerId" = COALESCE(session."ownerId", (
        SELECT membership."userId"
        FROM "OrganizationMembership" membership
        WHERE membership."organizationId" = session."organizationId" AND membership."status" = 'ACTIVE'
        ORDER BY membership."createdAt" ASC
        LIMIT 1
    ), 'messaging-migration'),
    "createdById" = COALESCE((
        SELECT membership."userId"
        FROM "OrganizationMembership" membership
        WHERE membership."organizationId" = session."organizationId" AND membership."status" = 'ACTIVE'
        ORDER BY membership."createdAt" ASC
        LIMIT 1
    ), session."ownerId", 'messaging-migration'),
    "startedAt" = session."createdAt",
    "lastMessageAt" = session."updatedAt";

ALTER TABLE "MessagingSession"
    ALTER COLUMN "name" SET NOT NULL,
    ALTER COLUMN "status" SET DEFAULT 'Open',
    ALTER COLUMN "status" SET NOT NULL,
    ALTER COLUMN "ownerId" SET NOT NULL,
    ALTER COLUMN "createdById" SET NOT NULL;

CREATE TABLE "MessagingSessionParticipant" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "contactId" TEXT,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "role" TEXT NOT NULL DEFAULT 'Customer',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    CONSTRAINT "MessagingSessionParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MessagingMessage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "senderName" TEXT,
    "senderAddress" TEXT,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Recorded',
    "externalMessageId" TEXT,
    "recordedById" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MessagingMessage_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "VideoCall"
    ADD COLUMN "description" TEXT,
    ADD COLUMN "status" TEXT NOT NULL DEFAULT 'Scheduled',
    ADD COLUMN "meetingUrl" TEXT,
    ADD COLUMN "scheduledStartAt" TIMESTAMP(3),
    ADD COLUMN "scheduledEndAt" TIMESTAMP(3),
    ADD COLUMN "endedAt" TIMESTAMP(3),
    ADD COLUMN "accountId" TEXT,
    ADD COLUMN "contactId" TEXT,
    ADD COLUMN "opportunityId" TEXT,
    ADD COLUMN "organizerId" TEXT,
    ADD COLUMN "createdById" TEXT,
    ADD COLUMN "recordingUrl" TEXT,
    ADD COLUMN "notes" TEXT;

UPDATE "VideoCall" call
SET
    "name" = COALESCE(NULLIF(TRIM(call."name"), ''), 'Video Call ' || SUBSTRING(call."id", 1, 8)),
    "provider" = COALESCE(NULLIF(TRIM(call."provider"), ''), 'External Link'),
    "status" = CASE WHEN call."startedAt" IS NULL THEN 'Scheduled' ELSE 'Completed' END,
    "scheduledStartAt" = COALESCE(call."startedAt", call."createdAt"),
    "scheduledEndAt" = COALESCE(call."startedAt", call."createdAt") + INTERVAL '1 hour',
    "endedAt" = CASE WHEN call."startedAt" IS NOT NULL THEN call."startedAt" + INTERVAL '1 hour' ELSE NULL END,
    "organizerId" = COALESCE((
        SELECT membership."userId"
        FROM "OrganizationMembership" membership
        WHERE membership."organizationId" = call."organizationId" AND membership."status" = 'ACTIVE'
        ORDER BY membership."createdAt" ASC
        LIMIT 1
    ), 'video-migration'),
    "createdById" = COALESCE((
        SELECT membership."userId"
        FROM "OrganizationMembership" membership
        WHERE membership."organizationId" = call."organizationId" AND membership."status" = 'ACTIVE'
        ORDER BY membership."createdAt" ASC
        LIMIT 1
    ), 'video-migration');

ALTER TABLE "VideoCall"
    ALTER COLUMN "name" SET NOT NULL,
    ALTER COLUMN "provider" SET DEFAULT 'External Link',
    ALTER COLUMN "provider" SET NOT NULL,
    ALTER COLUMN "scheduledStartAt" SET NOT NULL,
    ALTER COLUMN "scheduledEndAt" SET NOT NULL,
    ALTER COLUMN "organizerId" SET NOT NULL,
    ALTER COLUMN "createdById" SET NOT NULL;

CREATE TABLE "VideoCallParticipant" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "videoCallId" TEXT NOT NULL,
    "userId" TEXT,
    "contactId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "role" TEXT NOT NULL DEFAULT 'Attendee',
    "attendance" TEXT NOT NULL DEFAULT 'Invited',
    "joinedAt" TIMESTAMP(3),
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VideoCallParticipant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MessagingSession_organizationId_status_lastMessageAt_idx" ON "MessagingSession"("organizationId", "status", "lastMessageAt");
CREATE INDEX "MessagingSession_organizationId_accountId_idx" ON "MessagingSession"("organizationId", "accountId");
CREATE INDEX "MessagingSession_organizationId_contactId_idx" ON "MessagingSession"("organizationId", "contactId");
CREATE INDEX "MessagingSessionParticipant_organizationId_sessionId_idx" ON "MessagingSessionParticipant"("organizationId", "sessionId");
CREATE INDEX "MessagingSessionParticipant_organizationId_contactId_idx" ON "MessagingSessionParticipant"("organizationId", "contactId");
CREATE INDEX "MessagingMessage_organizationId_sessionId_sentAt_idx" ON "MessagingMessage"("organizationId", "sessionId", "sentAt");
CREATE INDEX "VideoCall_organizationId_status_scheduledStartAt_idx" ON "VideoCall"("organizationId", "status", "scheduledStartAt");
CREATE INDEX "VideoCall_organizationId_accountId_idx" ON "VideoCall"("organizationId", "accountId");
CREATE INDEX "VideoCall_organizationId_contactId_idx" ON "VideoCall"("organizationId", "contactId");
CREATE INDEX "VideoCall_organizationId_opportunityId_idx" ON "VideoCall"("organizationId", "opportunityId");
CREATE INDEX "VideoCallParticipant_organizationId_videoCallId_idx" ON "VideoCallParticipant"("organizationId", "videoCallId");
CREATE INDEX "VideoCallParticipant_organizationId_contactId_idx" ON "VideoCallParticipant"("organizationId", "contactId");

ALTER TABLE "MessagingSession" ADD CONSTRAINT "MessagingSession_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MessagingSession" ADD CONSTRAINT "MessagingSession_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MessagingSessionParticipant" ADD CONSTRAINT "MessagingSessionParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MessagingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessagingSessionParticipant" ADD CONSTRAINT "MessagingSessionParticipant_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MessagingMessage" ADD CONSTRAINT "MessagingMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MessagingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VideoCall" ADD CONSTRAINT "VideoCall_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VideoCall" ADD CONSTRAINT "VideoCall_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VideoCall" ADD CONSTRAINT "VideoCall_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VideoCallParticipant" ADD CONSTRAINT "VideoCallParticipant_videoCallId_fkey" FOREIGN KEY ("videoCallId") REFERENCES "VideoCall"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VideoCallParticipant" ADD CONSTRAINT "VideoCallParticipant_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
