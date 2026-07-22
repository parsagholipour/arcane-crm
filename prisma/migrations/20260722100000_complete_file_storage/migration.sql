-- Preserve legacy metadata-only rows while enabling durable, database-backed file content.
ALTER TABLE "FileRecord"
    ADD COLUMN "contentType" TEXT,
    ADD COLUMN "checksum" TEXT,
    ADD COLUMN "content" BYTEA;

ALTER TABLE "AttachmentRecord"
    ADD COLUMN "contentType" TEXT,
    ADD COLUMN "checksum" TEXT,
    ADD COLUMN "content" BYTEA;

CREATE INDEX "FileRecord_organizationId_relatedObjectType_relatedRecordId_idx"
    ON "FileRecord"("organizationId", "relatedObjectType", "relatedRecordId");

CREATE INDEX "AttachmentRecord_organizationId_relatedObjectType_relatedRecordId_idx"
    ON "AttachmentRecord"("organizationId", "relatedObjectType", "relatedRecordId");
