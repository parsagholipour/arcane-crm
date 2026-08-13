-- Samples sent to a Lead: when one was asked for, where it is in the sample workflow, and
-- the courier/tracking pair the USPS watch polls. deliveryDate mirrors the Opportunity column
-- so the same poller can stamp a delivery timestamp on either subject.
ALTER TABLE "Lead" ADD COLUMN "sampleRequestedDate" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN "sampleStatus" TEXT;
ALTER TABLE "Lead" ADD COLUMN "courier" TEXT;
ALTER TABLE "Lead" ADD COLUMN "trackingNumber" TEXT;
ALTER TABLE "Lead" ADD COLUMN "deliveryDate" TIMESTAMP(3);

-- Products included in a Lead's sample. totalPrice is always derived from quantity * unitPrice
-- on the server, so the column can be trusted by reporting without recomputing the line.
CREATE TABLE "LeadSampleProduct" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "totalPrice" DECIMAL(18,2) NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadSampleProduct_pkey" PRIMARY KEY ("id")
);

-- A Product is sampled to a Lead at most once; quantity carries the repetition.
CREATE UNIQUE INDEX "LeadSampleProduct_leadId_productId_key" ON "LeadSampleProduct"("leadId", "productId");

CREATE INDEX "LeadSampleProduct_organizationId_idx" ON "LeadSampleProduct"("organizationId");

CREATE INDEX "LeadSampleProduct_leadId_displayOrder_idx" ON "LeadSampleProduct"("leadId", "displayOrder");

CREATE INDEX "LeadSampleProduct_productId_idx" ON "LeadSampleProduct"("productId");

ALTER TABLE "LeadSampleProduct" ADD CONSTRAINT "LeadSampleProduct_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeadSampleProduct" ADD CONSTRAINT "LeadSampleProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
