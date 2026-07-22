-- Expand the legacy read-only invoice scaffold without discarding existing rows.
ALTER TABLE "Invoice"
    ADD COLUMN "invoiceNumber" TEXT,
    ADD COLUMN "accountId" TEXT,
    ADD COLUMN "opportunityId" TEXT,
    ADD COLUMN "issueDate" TIMESTAMP(3),
    ADD COLUMN "dueDate" TIMESTAMP(3),
    ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'USD',
    ADD COLUMN "purchaseOrderNumber" TEXT,
    ADD COLUMN "billingName" TEXT,
    ADD COLUMN "billingStreet" TEXT,
    ADD COLUMN "billingCity" TEXT,
    ADD COLUMN "billingState" TEXT,
    ADD COLUMN "billingPostalCode" TEXT,
    ADD COLUMN "billingCountry" TEXT,
    ADD COLUMN "notes" TEXT,
    ADD COLUMN "terms" TEXT,
    ADD COLUMN "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    ADD COLUMN "discountTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    ADD COLUMN "taxTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    ADD COLUMN "total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    ADD COLUMN "amountPaid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    ADD COLUMN "balanceDue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    ADD COLUMN "createdById" TEXT,
    ADD COLUMN "sentAt" TIMESTAMP(3),
    ADD COLUMN "paidAt" TIMESTAMP(3),
    ADD COLUMN "voidedAt" TIMESTAMP(3);

-- A required customer is needed for legacy rows. Prefer an existing account and
-- create one clearly identified migration account only for organizations without one.
INSERT INTO "Account" (
    "id", "organizationId", "name", "ownerId", "createdById", "updatedById", "createdAt", "updatedAt"
)
SELECT
    'legacy-invoice-account-' || SUBSTRING(MD5(invoice_org."organizationId"), 1, 24),
    invoice_org."organizationId",
    'Legacy Invoice Customer',
    COALESCE((
        SELECT membership."userId"
        FROM "OrganizationMembership" membership
        WHERE membership."organizationId" = invoice_org."organizationId"
        ORDER BY membership."createdAt" ASC
        LIMIT 1
    ), 'invoice-migration'),
    COALESCE((
        SELECT membership."userId"
        FROM "OrganizationMembership" membership
        WHERE membership."organizationId" = invoice_org."organizationId"
        ORDER BY membership."createdAt" ASC
        LIMIT 1
    ), 'invoice-migration'),
    COALESCE((
        SELECT membership."userId"
        FROM "OrganizationMembership" membership
        WHERE membership."organizationId" = invoice_org."organizationId"
        ORDER BY membership."createdAt" ASC
        LIMIT 1
    ), 'invoice-migration'),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "organizationId" FROM "Invoice") invoice_org
WHERE NOT EXISTS (
    SELECT 1 FROM "Account" account WHERE account."organizationId" = invoice_org."organizationId"
);

WITH numbered AS (
    SELECT
        invoice."id",
        ROW_NUMBER() OVER (PARTITION BY invoice."organizationId" ORDER BY invoice."createdAt", invoice."id") AS row_number
    FROM "Invoice" invoice
), account_for_org AS (
    SELECT DISTINCT ON (account."organizationId") account.*
    FROM "Account" account
    ORDER BY account."organizationId", account."createdAt", account."id"
)
UPDATE "Invoice" invoice
SET
    "invoiceNumber" = 'INV-' || LPAD(numbered.row_number::TEXT, 6, '0'),
    "accountId" = account."id",
    "issueDate" = invoice."createdAt",
    "dueDate" = invoice."createdAt",
    "billingName" = account."name",
    "billingStreet" = account."billingStreet",
    "billingCity" = account."billingCity",
    "billingState" = account."billingState",
    "billingPostalCode" = account."billingPostalCode",
    "billingCountry" = account."billingCountry",
    "createdById" = account."createdById",
    "status" = CASE LOWER(COALESCE(invoice."status", 'draft'))
        WHEN 'sent' THEN 'Sent'
        WHEN 'partially paid' THEN 'Partially Paid'
        WHEN 'partially_paid' THEN 'Partially Paid'
        WHEN 'paid' THEN 'Paid'
        WHEN 'overdue' THEN 'Overdue'
        WHEN 'void' THEN 'Void'
        WHEN 'voided' THEN 'Void'
        ELSE 'Draft'
    END,
    "subtotal" = COALESCE(invoice."amount", 0),
    "total" = COALESCE(invoice."amount", 0),
    "amountPaid" = CASE WHEN LOWER(COALESCE(invoice."status", '')) = 'paid' THEN COALESCE(invoice."amount", 0) ELSE 0 END,
    "balanceDue" = CASE WHEN LOWER(COALESCE(invoice."status", '')) IN ('paid', 'void', 'voided') THEN 0 ELSE COALESCE(invoice."amount", 0) END,
    "sentAt" = CASE WHEN LOWER(COALESCE(invoice."status", '')) IN ('sent', 'partially paid', 'partially_paid', 'paid', 'overdue') THEN invoice."updatedAt" ELSE NULL END,
    "paidAt" = CASE WHEN LOWER(COALESCE(invoice."status", '')) = 'paid' THEN invoice."updatedAt" ELSE NULL END,
    "voidedAt" = CASE WHEN LOWER(COALESCE(invoice."status", '')) IN ('void', 'voided') THEN invoice."updatedAt" ELSE NULL END
FROM numbered, account_for_org account
WHERE invoice."id" = numbered."id"
  AND account."organizationId" = invoice."organizationId";

ALTER TABLE "Invoice"
    ALTER COLUMN "invoiceNumber" SET NOT NULL,
    ALTER COLUMN "accountId" SET NOT NULL,
    ALTER COLUMN "status" SET NOT NULL,
    ALTER COLUMN "status" SET DEFAULT 'Draft',
    ALTER COLUMN "issueDate" SET NOT NULL,
    ALTER COLUMN "dueDate" SET NOT NULL,
    ALTER COLUMN "billingName" SET NOT NULL,
    ALTER COLUMN "createdById" SET NOT NULL,
    DROP COLUMN "name",
    DROP COLUMN "amount";

CREATE TABLE "InvoiceLineItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "productId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "lineSubtotal" DECIMAL(18,2) NOT NULL,
    "taxAmount" DECIMAL(18,2) NOT NULL,
    "lineTotal" DECIMAL(18,2) NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceLineItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvoicePayment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "referenceNumber" TEXT,
    "notes" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoicePayment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvoiceNumberSequence" (
    "organizationId" TEXT NOT NULL,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceNumberSequence_pkey" PRIMARY KEY ("organizationId")
);

INSERT INTO "InvoiceNumberSequence" ("organizationId", "nextNumber", "updatedAt")
SELECT "organizationId", COUNT(*)::INTEGER + 1, CURRENT_TIMESTAMP
FROM "Invoice"
GROUP BY "organizationId";

CREATE UNIQUE INDEX "Invoice_organizationId_invoiceNumber_key" ON "Invoice"("organizationId", "invoiceNumber");
CREATE INDEX "Invoice_organizationId_status_dueDate_idx" ON "Invoice"("organizationId", "status", "dueDate");
CREATE INDEX "Invoice_organizationId_accountId_idx" ON "Invoice"("organizationId", "accountId");
CREATE INDEX "Invoice_organizationId_opportunityId_idx" ON "Invoice"("organizationId", "opportunityId");
CREATE INDEX "InvoiceLineItem_invoiceId_displayOrder_idx" ON "InvoiceLineItem"("invoiceId", "displayOrder");
CREATE INDEX "InvoiceLineItem_productId_idx" ON "InvoiceLineItem"("productId");
CREATE INDEX "InvoicePayment_invoiceId_paymentDate_idx" ON "InvoicePayment"("invoiceId", "paymentDate");

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InvoicePayment" ADD CONSTRAINT "InvoicePayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
