ALTER TABLE "KnowledgeArticle" ADD COLUMN "lastViewedAt" TIMESTAMP(3);

CREATE TABLE "KnowledgeFeedback" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "articleId" TEXT NOT NULL,
  "visitorKey" TEXT NOT NULL,
  "helpful" BOOLEAN NOT NULL,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KnowledgeFeedback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KnowledgeFeedback_organizationId_articleId_visitorKey_key" ON "KnowledgeFeedback"("organizationId", "articleId", "visitorKey");
CREATE INDEX "KnowledgeFeedback_organizationId_articleId_helpful_idx" ON "KnowledgeFeedback"("organizationId", "articleId", "helpful");
ALTER TABLE "KnowledgeFeedback" ADD CONSTRAINT "KnowledgeFeedback_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "KnowledgeArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
