import "server-only";

import { prisma } from "@/lib/prisma";
import { mapPoAppProduct, shouldApplyPoAppUpdate, type PoAppProduct } from "@/lib/po-app-product";

/**
 * Writes one PO App product into the CRM catalogue: the Product row, its price book entry, and
 * the inventory record for the selected commerce store. Every write is keyed so that seeing the
 * same product twice — which both polling overlap and at-least-once webhooks guarantee — is a
 * no-op rather than a duplicate.
 */

export type PoAppWriteTarget = {
  organizationId: string;
  priceBookId: string;
  /** MarketingStore receiving stock counts. Null means inventory is not synced. */
  storeId: string | null;
  currency: string;
};

export type PoAppWriteOutcome = "created" | "updated" | "skipped";

const STANDARD_PRICE_BOOK_DESCRIPTION = "Default price book used by the PO App catalogue sync.";

/** Reuses the deterministic id the product wizard already relies on, so both agree on one book. */
export async function ensureStandardPriceBook(organizationId: string) {
  const id = `${organizationId}-standard-price-book`;
  const existing = await prisma.priceBook.findFirst({ where: { id, organizationId }, select: { id: true } });
  if (existing) return existing.id;
  const created = await prisma.priceBook.create({
    data: {
      id,
      organizationId,
      name: "Standard Price Book",
      active: true,
      isStandard: true,
      description: STANDARD_PRICE_BOOK_DESCRIPTION
    }
  });
  return created.id;
}

async function writePriceBookEntry(productId: string, listPrice: string, target: PoAppWriteTarget) {
  // PriceBookEntry has no unique constraint on (priceBook, product, currency), so the dedupe is
  // done by hand exactly as the price book entries route does.
  const existing = await prisma.priceBookEntry.findFirst({
    where: {
      organizationId: target.organizationId,
      priceBookId: target.priceBookId,
      productId,
      currency: target.currency
    },
    select: { id: true }
  });
  if (existing) {
    await prisma.priceBookEntry.update({ where: { id: existing.id }, data: { listPrice, active: true } });
    return;
  }
  await prisma.priceBookEntry.create({
    data: {
      organizationId: target.organizationId,
      productId,
      priceBookId: target.priceBookId,
      listPrice,
      currency: target.currency,
      active: true
    }
  });
}

async function writeInventory(productId: string, stockCount: number, target: PoAppWriteTarget) {
  if (!target.storeId) return;
  // Only quantityOnHand is owned by PO App; reservations and reorder points stay local.
  await prisma.inventoryItem.upsert({
    where: {
      organizationId_storeId_productId: {
        organizationId: target.organizationId,
        storeId: target.storeId,
        productId
      }
    },
    update: { quantityOnHand: stockCount },
    create: {
      organizationId: target.organizationId,
      storeId: target.storeId,
      productId,
      quantityOnHand: stockCount
    }
  });
}

export async function upsertPoAppProduct(
  product: PoAppProduct,
  target: PoAppWriteTarget,
  now: Date
): Promise<PoAppWriteOutcome> {
  const mapped = mapPoAppProduct(product);
  const existing = await prisma.product.findUnique({
    where: {
      organizationId_poAppProductId: {
        organizationId: target.organizationId,
        poAppProductId: mapped.poAppProductId
      }
    },
    select: { id: true, poAppUpdatedAt: true, poAppDeletedAt: true }
  });

  if (existing && !shouldApplyPoAppUpdate(mapped.poAppUpdatedAt, existing.poAppUpdatedAt)) {
    // Still touch the watermark, otherwise a full sync's reconcile would read this row as
    // missing upstream and deactivate it.
    await prisma.product.update({ where: { id: existing.id }, data: { poAppSyncedAt: now } });
    return "skipped";
  }

  const attributes = {
    name: mapped.name,
    sku: mapped.sku,
    productCode: mapped.productCode,
    description: mapped.description,
    category: mapped.category,
    family: mapped.family,
    upcGtin: mapped.upcGtin,
    imageLink: mapped.imageLink,
    cost: mapped.cost,
    price: mapped.price,
    mapPrice: mapped.mapPrice,
    msrp: mapped.msrp,
    minimumOrderPieces: mapped.minimumOrderPieces,
    quantityPerCarton: mapped.quantityPerCarton,
    stockCount: mapped.stockCount,
    orderByDate: mapped.orderByDate,
    editingStatus: mapped.editingStatus,
    verified: mapped.verified,
    manufacturerName: mapped.manufacturerName,
    manufacturerRegion: mapped.manufacturerRegion,
    manufacturerEmail: mapped.manufacturerEmail,
    manufacturerPhone: mapped.manufacturerPhone,
    productType: mapped.productType,
    collectionName: mapped.collectionName,
    poAppUpdatedAt: mapped.poAppUpdatedAt,
    poAppSyncedAt: now
  };

  const productRow = await prisma.product.upsert({
    where: {
      organizationId_poAppProductId: {
        organizationId: target.organizationId,
        poAppProductId: mapped.poAppProductId
      }
    },
    // active is only forced on the way in or on the way back from a delete. Leaving it alone
    // otherwise means a locally deactivated product is not silently switched back on.
    update: {
      ...attributes,
      ...(existing?.poAppDeletedAt ? { active: true, poAppDeletedAt: null } : {})
    },
    create: {
      ...attributes,
      organizationId: target.organizationId,
      poAppProductId: mapped.poAppProductId,
      active: true
    },
    select: { id: true }
  });

  if (mapped.price !== null) await writePriceBookEntry(productRow.id, mapped.price, target);
  if (mapped.stockCount !== null) await writeInventory(productRow.id, mapped.stockCount, target);

  return existing ? "updated" : "created";
}

/**
 * Upstream deletions deactivate rather than delete: a product referenced by an invoice, order,
 * or inventory record cannot be removed, and the local history is worth keeping either way.
 */
export async function deactivatePoAppProduct(organizationId: string, poAppProductId: string, deletedAt: Date) {
  const result = await prisma.product.updateMany({
    where: { organizationId, poAppProductId, poAppDeletedAt: null },
    data: { active: false, poAppDeletedAt: deletedAt, poAppSyncedAt: deletedAt }
  });
  return result.count;
}

/**
 * Reconciles deletions after a *complete* full sync: anything still carrying a watermark from
 * before the run was not returned by PO App and no longer exists upstream. Callers must never
 * run this after a partial page-through, or a transient failure would empty the catalogue.
 */
export async function deactivateStalePoAppProducts(organizationId: string, syncStartedAt: Date, now: Date) {
  const result = await prisma.product.updateMany({
    where: {
      organizationId,
      poAppProductId: { not: null },
      poAppDeletedAt: null,
      OR: [{ poAppSyncedAt: null }, { poAppSyncedAt: { lt: syncStartedAt } }]
    },
    data: { active: false, poAppDeletedAt: now, poAppSyncedAt: now }
  });
  return result.count;
}
