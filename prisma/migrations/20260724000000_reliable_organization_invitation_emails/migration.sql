-- Account setup is an identity-level event, while invitation delivery belongs to
-- an individual organization membership.
ALTER TABLE "users" ADD COLUMN "setupEmailSentAt" TIMESTAMP(3);

UPDATE "users" AS "user"
SET "setupEmailSentAt" = "history"."sentAt"
FROM (
  SELECT "userId", MAX("inviteSentAt") AS "sentAt"
  FROM "OrganizationMembership"
  WHERE "inviteSentAt" IS NOT NULL
  GROUP BY "userId"
) AS "history"
WHERE "user"."id" = "history"."userId";

-- Historical values represented Keycloak setup emails. From this migration
-- onward, inviteSentAt exclusively represents the SendGrid membership email.
UPDATE "OrganizationMembership"
SET "inviteSentAt" = NULL
WHERE "inviteSentAt" IS NOT NULL;
