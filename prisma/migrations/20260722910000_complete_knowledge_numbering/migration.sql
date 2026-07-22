-- Preserve Knowledge rows while making public slugs and article numbers tenant-unique.
WITH ranked_urls AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (PARTITION BY "organizationId", "urlName" ORDER BY "createdAt", "id") AS duplicate_rank
    FROM "KnowledgeArticle"
)
UPDATE "KnowledgeArticle" AS article
SET "urlName" = article."urlName" || '-' || SUBSTRING(MD5(article."id") FROM 1 FOR 8)
FROM ranked_urls
WHERE article."id" = ranked_urls."id" AND ranked_urls.duplicate_rank > 1;

WITH ranked_numbers AS (
    SELECT
        "id",
        "articleNumber",
        ROW_NUMBER() OVER (PARTITION BY "organizationId", "articleNumber" ORDER BY "createdAt", "id") AS duplicate_rank
    FROM "KnowledgeArticle"
)
UPDATE "KnowledgeArticle" AS article
SET "articleNumber" = 'KA-MIG-' || UPPER(SUBSTRING(MD5(article."id") FROM 1 FOR 12))
FROM ranked_numbers
WHERE article."id" = ranked_numbers."id"
  AND (ranked_numbers."articleNumber" IS NULL OR ranked_numbers.duplicate_rank > 1);

CREATE UNIQUE INDEX "KnowledgeArticle_organizationId_urlName_key"
    ON "KnowledgeArticle"("organizationId", "urlName");
CREATE UNIQUE INDEX "KnowledgeArticle_organizationId_articleNumber_key"
    ON "KnowledgeArticle"("organizationId", "articleNumber");

CREATE TABLE "KnowledgeArticleNumberSequence" (
    "organizationId" TEXT NOT NULL,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeArticleNumberSequence_pkey" PRIMARY KEY ("organizationId")
);

INSERT INTO "KnowledgeArticleNumberSequence" ("organizationId", "nextNumber", "updatedAt")
SELECT
    "organizationId",
    COALESCE(MAX(CASE WHEN "articleNumber" ~ '^KA-[0-9]+$' THEN SUBSTRING("articleNumber" FROM 4)::INTEGER ELSE 0 END), 0) + 1,
    CURRENT_TIMESTAMP
FROM "KnowledgeArticle"
GROUP BY "organizationId";
