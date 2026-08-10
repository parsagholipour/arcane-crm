-- Products assigned to an Opportunity. totalPrice is always derived from quantity * unitPrice
-- on the server, so the column can be trusted by reporting without recomputing the line.
CREATE TABLE "OpportunityProduct" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "totalPrice" DECIMAL(18,2) NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpportunityProduct_pkey" PRIMARY KEY ("id")
);

-- A Product is assigned to an Opportunity at most once; quantity carries the repetition.
CREATE UNIQUE INDEX "OpportunityProduct_opportunityId_productId_key" ON "OpportunityProduct"("opportunityId", "productId");

CREATE INDEX "OpportunityProduct_organizationId_idx" ON "OpportunityProduct"("organizationId");

CREATE INDEX "OpportunityProduct_opportunityId_displayOrder_idx" ON "OpportunityProduct"("opportunityId", "displayOrder");

CREATE INDEX "OpportunityProduct_productId_idx" ON "OpportunityProduct"("productId");

ALTER TABLE "OpportunityProduct" ADD CONSTRAINT "OpportunityProduct_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OpportunityProduct" ADD CONSTRAINT "OpportunityProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
