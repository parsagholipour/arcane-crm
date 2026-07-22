-- Allocate organization-scoped Case numbers atomically without rewriting existing cases.
CREATE TABLE "CaseNumberSequence" (
    "organizationId" TEXT NOT NULL,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseNumberSequence_pkey" PRIMARY KEY ("organizationId")
);

INSERT INTO "CaseNumberSequence" ("organizationId", "nextNumber", "updatedAt")
SELECT
    "organizationId",
    COALESCE(MAX(CASE WHEN "caseNumber" ~ '^[0-9]+$' THEN "caseNumber"::INTEGER ELSE 0 END), 0) + 1,
    CURRENT_TIMESTAMP
FROM "cases"
GROUP BY "organizationId";
