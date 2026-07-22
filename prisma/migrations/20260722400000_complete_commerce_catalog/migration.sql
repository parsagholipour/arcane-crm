-- Expand the store placeholder without removing existing store rows.
ALTER TABLE "MarketingStore"
  ADD COLUMN "slug" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "priceBookId" TEXT,
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "launchedAt" TIMESTAMP(3),
  ADD COLUMN "archivedAt" TIMESTAMP(3);

UPDATE "MarketingStore" store
SET
  "slug" = trim(both '-' from lower(regexp_replace(store."name", '[^a-zA-Z0-9]+', '-', 'g'))) || '-' || substr(store."id", 1, 8),
  "currency" = COALESCE(NULLIF(store."currency", ''), 'USD'),
  "status" = COALESCE(NULLIF(store."status", ''), 'Draft'),
  "createdById" = COALESCE((
    SELECT membership."userId"
    FROM "OrganizationMembership" membership
    WHERE membership."organizationId" = store."organizationId" AND membership."status" = 'ACTIVE'
    ORDER BY membership."createdAt" ASC
    LIMIT 1
  ), 'commerce-migration');

ALTER TABLE "MarketingStore"
  ALTER COLUMN "slug" SET NOT NULL,
  ALTER COLUMN "currency" SET DEFAULT 'USD',
  ALTER COLUMN "currency" SET NOT NULL,
  ALTER COLUMN "status" SET DEFAULT 'Draft',
  ALTER COLUMN "status" SET NOT NULL,
  ALTER COLUMN "createdById" SET NOT NULL;

CREATE UNIQUE INDEX "MarketingStore_organizationId_slug_key" ON "MarketingStore"("organizationId", "slug");
CREATE INDEX "MarketingStore_organizationId_status_idx" ON "MarketingStore"("organizationId", "status");
ALTER TABLE "MarketingStore" ADD CONSTRAINT "MarketingStore_priceBookId_fkey" FOREIGN KEY ("priceBookId") REFERENCES "PriceBook"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "CommerceOrderSequence" (
  "organizationId" TEXT NOT NULL,
  "nextNumber" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommerceOrderSequence_pkey" PRIMARY KEY ("organizationId")
);

CREATE TABLE "CommerceOrder" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "orderNumber" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "contactId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'Draft',
  "fulfillmentStatus" TEXT NOT NULL DEFAULT 'Unfulfilled',
  "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "purchaseOrderNumber" TEXT,
  "shippingName" TEXT,
  "shippingStreet" TEXT,
  "shippingCity" TEXT,
  "shippingState" TEXT,
  "shippingPostalCode" TEXT,
  "shippingCountry" TEXT,
  "notes" TEXT,
  "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "discountTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "taxTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "shippingTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "createdById" TEXT NOT NULL,
  "confirmedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "fulfilledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommerceOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommerceOrderLine" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "priceBookEntryId" TEXT,
  "description" TEXT NOT NULL,
  "quantity" DECIMAL(18,3) NOT NULL,
  "unitPrice" DECIMAL(18,2) NOT NULL,
  "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "taxRate" DECIMAL(7,4) NOT NULL DEFAULT 0,
  "lineSubtotal" DECIMAL(18,2) NOT NULL,
  "taxAmount" DECIMAL(18,2) NOT NULL,
  "lineTotal" DECIMAL(18,2) NOT NULL,
  "fulfilledQuantity" DECIMAL(18,3) NOT NULL DEFAULT 0,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommerceOrderLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommercePromotion" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "value" DECIMAL(18,2) NOT NULL,
  "minimumOrderAmount" DECIMAL(18,2),
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "maxRedemptions" INTEGER,
  "redemptionCount" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommercePromotion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommerceOrderPromotion" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "promotionId" TEXT NOT NULL,
  "discountAmount" DECIMAL(18,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommerceOrderPromotion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryItem" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantityOnHand" DECIMAL(18,3) NOT NULL DEFAULT 0,
  "quantityReserved" DECIMAL(18,3) NOT NULL DEFAULT 0,
  "reorderPoint" DECIMAL(18,3) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommerceFulfillment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "fulfillmentNumber" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'Draft',
  "carrier" TEXT,
  "trackingNumber" TEXT,
  "notes" TEXT,
  "createdById" TEXT NOT NULL,
  "packedAt" TIMESTAMP(3),
  "shippedAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommerceFulfillment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommerceFulfillmentLine" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "fulfillmentId" TEXT NOT NULL,
  "orderLineId" TEXT NOT NULL,
  "quantity" DECIMAL(18,3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommerceFulfillmentLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommerceOrder_organizationId_orderNumber_key" ON "CommerceOrder"("organizationId", "orderNumber");
CREATE INDEX "CommerceOrder_organizationId_status_orderDate_idx" ON "CommerceOrder"("organizationId", "status", "orderDate");
CREATE INDEX "CommerceOrder_organizationId_storeId_idx" ON "CommerceOrder"("organizationId", "storeId");
CREATE INDEX "CommerceOrder_organizationId_accountId_idx" ON "CommerceOrder"("organizationId", "accountId");
CREATE INDEX "CommerceOrderLine_organizationId_orderId_idx" ON "CommerceOrderLine"("organizationId", "orderId");
CREATE INDEX "CommerceOrderLine_organizationId_productId_idx" ON "CommerceOrderLine"("organizationId", "productId");
CREATE UNIQUE INDEX "CommercePromotion_organizationId_storeId_code_key" ON "CommercePromotion"("organizationId", "storeId", "code");
CREATE INDEX "CommercePromotion_organizationId_storeId_active_idx" ON "CommercePromotion"("organizationId", "storeId", "active");
CREATE UNIQUE INDEX "CommerceOrderPromotion_organizationId_orderId_promotionId_key" ON "CommerceOrderPromotion"("organizationId", "orderId", "promotionId");
CREATE INDEX "CommerceOrderPromotion_organizationId_orderId_idx" ON "CommerceOrderPromotion"("organizationId", "orderId");
CREATE UNIQUE INDEX "InventoryItem_organizationId_storeId_productId_key" ON "InventoryItem"("organizationId", "storeId", "productId");
CREATE INDEX "InventoryItem_organizationId_storeId_idx" ON "InventoryItem"("organizationId", "storeId");
CREATE UNIQUE INDEX "CommerceFulfillment_organizationId_fulfillmentNumber_key" ON "CommerceFulfillment"("organizationId", "fulfillmentNumber");
CREATE INDEX "CommerceFulfillment_organizationId_orderId_idx" ON "CommerceFulfillment"("organizationId", "orderId");
CREATE UNIQUE INDEX "CommerceFulfillmentLine_organizationId_fulfillmentId_orderLineId_key" ON "CommerceFulfillmentLine"("organizationId", "fulfillmentId", "orderLineId");
CREATE INDEX "CommerceFulfillmentLine_organizationId_orderLineId_idx" ON "CommerceFulfillmentLine"("organizationId", "orderLineId");

ALTER TABLE "CommerceOrder" ADD CONSTRAINT "CommerceOrder_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "MarketingStore"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommerceOrder" ADD CONSTRAINT "CommerceOrder_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommerceOrder" ADD CONSTRAINT "CommerceOrder_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommerceOrderLine" ADD CONSTRAINT "CommerceOrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CommerceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommerceOrderLine" ADD CONSTRAINT "CommerceOrderLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommerceOrderLine" ADD CONSTRAINT "CommerceOrderLine_priceBookEntryId_fkey" FOREIGN KEY ("priceBookEntryId") REFERENCES "PriceBookEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommercePromotion" ADD CONSTRAINT "CommercePromotion_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "MarketingStore"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommerceOrderPromotion" ADD CONSTRAINT "CommerceOrderPromotion_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CommerceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommerceOrderPromotion" ADD CONSTRAINT "CommerceOrderPromotion_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "CommercePromotion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "MarketingStore"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommerceFulfillment" ADD CONSTRAINT "CommerceFulfillment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CommerceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommerceFulfillmentLine" ADD CONSTRAINT "CommerceFulfillmentLine_fulfillmentId_fkey" FOREIGN KEY ("fulfillmentId") REFERENCES "CommerceFulfillment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommerceFulfillmentLine" ADD CONSTRAINT "CommerceFulfillmentLine_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "CommerceOrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
