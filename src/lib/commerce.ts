import "server-only";

import { Prisma } from "@prisma/client";
import { calculateInvoiceTotals, InvoiceInputError, money } from "@/lib/invoice-calculations";
import { prisma } from "@/lib/prisma";
import type { RecordData } from "@/lib/crm-types";

export const STORE_STATUSES = ["Draft", "Active", "Archived"] as const;
export const ORDER_STATUSES = ["Draft", "Confirmed", "Fulfilled", "Cancelled"] as const;
export const FULFILLMENT_STATUSES = ["Packed", "Shipped", "Delivered"] as const;
export const PROMOTION_TYPES = ["Percentage", "Fixed Amount"] as const;

export const commerceStoreInclude = {
  priceBook: true,
  inventoryItems: { include: { product: true }, orderBy: { updatedAt: "desc" as const } },
  promotions: { orderBy: { updatedAt: "desc" as const } },
  _count: { select: { orders: true, inventoryItems: true, promotions: true } }
} satisfies Prisma.MarketingStoreInclude;

export const commerceOrderInclude = {
  store: true,
  account: true,
  contact: true,
  lines: { include: { product: true, priceBookEntry: { include: { priceBook: true } } }, orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }] },
  promotions: { include: { promotion: true } },
  fulfillments: { include: { lines: { include: { orderLine: { include: { product: true } } } } }, orderBy: { createdAt: "desc" as const } }
} satisfies Prisma.CommerceOrderInclude;

export class CommerceDomainError extends Error {
  constructor(message: string, readonly status: 400 | 404 | 409 = 400, readonly field?: string) {
    super(message);
    this.name = "CommerceDomainError";
  }
}

type Transaction = Prisma.TransactionClient;
type CommerceOrderAggregate = Prisma.CommerceOrderGetPayload<{ include: typeof commerceOrderInclude }>;

function text(value: unknown) {
  const result = value === null || value === undefined ? "" : String(value).trim();
  return result || null;
}

function requiredText(value: unknown, label: string) {
  const result = text(value);
  if (!result) throw new CommerceDomainError(`${label} is required.`, 400, label);
  return result;
}

function decimal(value: unknown, label: string, scale = 2) {
  try {
    const result = new Prisma.Decimal(value === null || value === undefined || value === "" ? 0 : String(value)).toDecimalPlaces(scale, Prisma.Decimal.ROUND_HALF_UP);
    if (!result.isFinite()) throw new Error("not finite");
    return result;
  } catch {
    throw new CommerceDomainError(`${label} must be a valid number.`, 400, label);
  }
}

function parseDate(value: unknown, label: string) {
  if (!value) return null;
  const result = new Date(String(value));
  if (!Number.isFinite(result.getTime())) throw new CommerceDomainError(`${label} must be a valid date.`, 400, label);
  return result;
}

export function storeSlug(value: unknown) {
  const result = requiredText(value, "Store name").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  if (!result) throw new CommerceDomainError("Store name must contain letters or numbers.", 400, "name");
  return result;
}

async function requireStoreFrom(tx: Transaction | typeof prisma, organizationId: string, id: string) {
  const store = await tx.marketingStore.findFirst({ where: { id, organizationId }, include: commerceStoreInclude });
  if (!store) throw new CommerceDomainError("Store not found.", 404);
  return store;
}

export async function requireCommerceStore(organizationId: string, id: string) {
  return requireStoreFrom(prisma, organizationId, id);
}

async function requireOrderFrom(tx: Transaction | typeof prisma, organizationId: string, id: string) {
  const order = await tx.commerceOrder.findFirst({ where: { id, organizationId }, include: commerceOrderInclude });
  if (!order) throw new CommerceDomainError("Order not found.", 404);
  return order;
}

export async function requireCommerceOrder(organizationId: string, id: string) {
  return requireOrderFrom(prisma, organizationId, id);
}

export async function createCommerceNotification(tx: Transaction | typeof prisma, values: { organizationId: string; userId: string; title: string; body: string; href?: string }) {
  return tx.notification.create({ data: { organizationId: values.organizationId, userId: values.userId, title: values.title, body: values.body, href: values.href ?? "/lightning/app/commerce", category: "Commerce" } });
}

export async function createCommerceStore(organizationId: string, userId: string, payload: RecordData) {
  const name = requiredText(payload.name, "Store name");
  const slug = text(payload.slug) ? storeSlug(payload.slug) : storeSlug(name);
  const currency = requiredText(payload.currency ?? "USD", "Currency").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new CommerceDomainError("Currency must be a three-letter ISO code.", 400, "currency");
  const priceBookId = text(payload.priceBookId);
  if (priceBookId && !(await prisma.priceBook.findFirst({ where: { id: priceBookId, organizationId }, select: { id: true } }))) throw new CommerceDomainError("Price Book not found.", 404, "priceBookId");
  if (await prisma.marketingStore.findFirst({ where: { organizationId, slug }, select: { id: true } })) throw new CommerceDomainError("That store URL slug is already in use.", 409, "slug");
  return prisma.$transaction(async (tx) => {
    const store = await tx.marketingStore.create({ data: { organizationId, name, slug, currency, status: "Draft", description: text(payload.description), priceBookId, createdById: userId }, include: commerceStoreInclude });
    const notification = await createCommerceNotification(tx, { organizationId, userId, title: "Store created", body: `${name} was created as a Draft.` });
    return { store, notifications: [notification] };
  });
}

export async function updateCommerceStore(organizationId: string, userId: string, id: string, payload: RecordData) {
  const existing = await requireCommerceStore(organizationId, id);
  if (existing.status === "Archived") throw new CommerceDomainError("Archived stores cannot be edited. Restore the store first.", 409);
  const name = payload.name === undefined ? existing.name : requiredText(payload.name, "Store name");
  const slug = payload.slug === undefined ? existing.slug : storeSlug(payload.slug);
  const duplicate = await prisma.marketingStore.findFirst({ where: { organizationId, slug, id: { not: id } }, select: { id: true } });
  if (duplicate) throw new CommerceDomainError("That store URL slug is already in use.", 409, "slug");
  const priceBookId = payload.priceBookId === undefined ? existing.priceBookId : text(payload.priceBookId);
  if (priceBookId && !(await prisma.priceBook.findFirst({ where: { id: priceBookId, organizationId }, select: { id: true } }))) throw new CommerceDomainError("Price Book not found.", 404, "priceBookId");
  const store = await prisma.marketingStore.update({ where: { id }, data: { name, slug, currency: payload.currency === undefined ? undefined : requiredText(payload.currency, "Currency").toUpperCase(), description: payload.description === undefined ? undefined : text(payload.description), priceBookId }, include: commerceStoreInclude });
  await createCommerceNotification(prisma, { organizationId, userId, title: "Store updated", body: `${store.name} settings were updated.` });
  return store;
}

export async function transitionCommerceStore(organizationId: string, userId: string, id: string, action: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await requireStoreFrom(tx, organizationId, id);
    const normalized = action.toLowerCase();
    let status: string;
    if (normalized === "activate" && existing.status === "Draft") {
      if (!existing.priceBookId) throw new CommerceDomainError("Choose a Price Book before activating the store.", 400, "priceBookId");
      const activeEntries = await tx.priceBookEntry.count({ where: { organizationId, priceBookId: existing.priceBookId, active: true, product: { active: true } } });
      if (!activeEntries) throw new CommerceDomainError("Activate at least one Product and Price Book entry before activating the store.", 400);
      status = "Active";
    } else if (normalized === "archive" && existing.status !== "Archived") status = "Archived";
    else if (normalized === "restore" && existing.status === "Archived") status = "Draft";
    else throw new CommerceDomainError(`Cannot ${normalized || "perform that action"} while the store is ${existing.status}.`, 409);
    const now = new Date();
    const store = await tx.marketingStore.update({ where: { id }, data: { status, launchedAt: status === "Active" ? existing.launchedAt ?? now : undefined, archivedAt: status === "Archived" ? now : status === "Draft" ? null : undefined }, include: commerceStoreInclude });
    const notification = await createCommerceNotification(tx, { organizationId, userId, title: `Store ${status.toLowerCase()}`, body: `${store.name} is now ${status}.` });
    return { store, notifications: [notification] };
  });
}

async function allocateOrderNumber(tx: Transaction, organizationId: string) {
  const rows = await tx.$queryRaw<Array<{ allocatedNumber: number }>>(Prisma.sql`
    INSERT INTO "CommerceOrderSequence" ("organizationId", "nextNumber", "updatedAt")
    VALUES (${organizationId}, 2, CURRENT_TIMESTAMP)
    ON CONFLICT ("organizationId") DO UPDATE
      SET "nextNumber" = "CommerceOrderSequence"."nextNumber" + 1,
          "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "nextNumber" - 1 AS "allocatedNumber"
  `);
  const allocated = Number(rows[0]?.allocatedNumber);
  if (!Number.isInteger(allocated) || allocated < 1) throw new CommerceDomainError("Unable to allocate an order number.", 409);
  return `ORD-${String(allocated).padStart(6, "0")}`;
}

async function prepareOrder(tx: Transaction, organizationId: string, payload: RecordData, existing?: CommerceOrderAggregate) {
  const storeId = requiredText(payload.storeId ?? existing?.storeId, "Store");
  const store = await requireStoreFrom(tx, organizationId, storeId);
  if (store.status === "Archived") throw new CommerceDomainError("Archived stores cannot receive orders.", 409, "storeId");
  const accountId = requiredText(payload.accountId ?? existing?.accountId, "Account");
  const account = await tx.account.findFirst({ where: { id: accountId, organizationId } });
  if (!account) throw new CommerceDomainError("Account not found.", 404, "accountId");
  const contactId = payload.contactId === undefined ? existing?.contactId ?? null : text(payload.contactId);
  if (contactId) {
    const contact = await tx.contact.findFirst({ where: { id: contactId, organizationId } });
    if (!contact) throw new CommerceDomainError("Contact not found.", 404, "contactId");
    if (contact.accountId !== accountId) throw new CommerceDomainError("The Contact must belong to the selected Account.", 400, "contactId");
  }
  const currency = requiredText(payload.currency ?? existing?.currency ?? store.currency, "Currency").toUpperCase();
  if (currency !== store.currency) throw new CommerceDomainError(`Order currency must match the store currency (${store.currency}).`, 400, "currency");
  const sourceLines = payload.lineItems === undefined ? existing?.lines ?? [] : payload.lineItems;
  if (!Array.isArray(sourceLines)) throw new CommerceDomainError("Line items must be an array.", 400, "lineItems");
  const lines = sourceLines.map((line, index) => {
    if (!line || typeof line !== "object" || Array.isArray(line)) throw new CommerceDomainError(`Line ${index + 1} is invalid.`, 400, `lineItems.${index}`);
    return line as RecordData;
  });
  const productIds = [...new Set(lines.map((line) => text(line.productId)).filter((value): value is string => Boolean(value)))];
  if (productIds.length !== lines.length) throw new CommerceDomainError("Every order line requires a Product.", 400, "lineItems.productId");
  const products = await tx.product.findMany({ where: { organizationId, id: { in: productIds } } });
  if (products.length !== productIds.length) throw new CommerceDomainError("One or more Products were not found.", 404, "lineItems.productId");
  const productsById = new Map(products.map((product) => [product.id, product]));
  const entries = await tx.priceBookEntry.findMany({ where: { organizationId, productId: { in: productIds }, ...(store.priceBookId ? { priceBookId: store.priceBookId } : {}), currency }, include: { priceBook: true } });
  const entriesById = new Map(entries.map((entry) => [entry.id, entry]));
  const defaultEntryByProduct = new Map<string, typeof entries[number]>();
  entries.filter((entry) => entry.active).forEach((entry) => { if (!defaultEntryByProduct.has(entry.productId)) defaultEntryByProduct.set(entry.productId, entry); });
  let calculated;
  try {
    calculated = calculateInvoiceTotals(lines.map((line, index) => {
      const productId = requiredText(line.productId, `Line ${index + 1} Product`);
      const product = productsById.get(productId)!;
      const entryId = text(line.priceBookEntryId);
      const entry = entryId ? entriesById.get(entryId) : defaultEntryByProduct.get(productId);
      if (entryId && (!entry || entry.productId !== productId)) throw new CommerceDomainError(`Line ${index + 1} Price Book entry is invalid for this store.`, 400, `lineItems.${index}.priceBookEntryId`);
      return { productId, description: text(line.description) ?? product.description ?? product.name, quantity: (line.quantity ?? 1) as Prisma.Decimal.Value, unitPrice: (line.unitPrice ?? entry?.listPrice ?? 0) as Prisma.Decimal.Value, discountAmount: (line.discountAmount ?? 0) as Prisma.Decimal.Value, taxRate: (line.taxRate ?? 0) as Prisma.Decimal.Value, displayOrder: Number(line.sortOrder ?? index) };
    }));
  } catch (error) {
    if (error instanceof InvoiceInputError) throw new CommerceDomainError(error.message, 400, error.field);
    throw error;
  }
  const promotionCode = text(payload.promotionCode);
  let promotion: Prisma.CommercePromotionGetPayload<object> | null = null;
  let promotionDiscount = money(0);
  if (promotionCode) {
    promotion = await tx.commercePromotion.findFirst({ where: { organizationId, storeId, code: promotionCode.toUpperCase() } });
    if (!promotion || !promotion.active) throw new CommerceDomainError("Promotion code is invalid or inactive.", 400, "promotionCode");
    const now = new Date();
    if ((promotion.startsAt && promotion.startsAt > now) || (promotion.endsAt && promotion.endsAt < now) || (promotion.maxRedemptions !== null && promotion.redemptionCount >= promotion.maxRedemptions)) throw new CommerceDomainError("Promotion code is not currently available.", 400, "promotionCode");
    const discountedSubtotal = calculated.subtotal.minus(calculated.discountTotal);
    if (promotion.minimumOrderAmount && discountedSubtotal.lt(promotion.minimumOrderAmount)) throw new CommerceDomainError(`This promotion requires an order of at least ${promotion.minimumOrderAmount.toFixed(2)}.`, 400, "promotionCode");
    promotionDiscount = promotion.type === "Percentage" ? money(discountedSubtotal.mul(promotion.value).div(100)) : money(Prisma.Decimal.min(discountedSubtotal, promotion.value));
  }
  const shippingTotal = decimal(payload.shippingTotal ?? existing?.shippingTotal ?? 0, "Shipping total");
  if (shippingTotal.lt(0)) throw new CommerceDomainError("Shipping total cannot be negative.", 400, "shippingTotal");
  return {
    header: { storeId, accountId, contactId, currency, purchaseOrderNumber: text(payload.purchaseOrderNumber ?? existing?.purchaseOrderNumber), shippingName: text(payload.shippingName ?? existing?.shippingName) ?? account.name, shippingStreet: text(payload.shippingStreet ?? existing?.shippingStreet ?? account.shippingStreet), shippingCity: text(payload.shippingCity ?? existing?.shippingCity ?? account.shippingCity), shippingState: text(payload.shippingState ?? existing?.shippingState ?? account.shippingState), shippingPostalCode: text(payload.shippingPostalCode ?? existing?.shippingPostalCode ?? account.shippingPostalCode), shippingCountry: text(payload.shippingCountry ?? existing?.shippingCountry ?? account.shippingCountry), notes: text(payload.notes ?? existing?.notes), orderDate: parseDate(payload.orderDate, "Order date") ?? existing?.orderDate ?? new Date() },
    calculated,
    entriesByProduct: defaultEntryByProduct,
    promotion,
    promotionDiscount,
    shippingTotal,
    discountTotal: money(calculated.discountTotal.plus(promotionDiscount)),
    total: money(calculated.total.minus(promotionDiscount).plus(shippingTotal))
  };
}

export async function createCommerceOrder(organizationId: string, userId: string, payload: RecordData) {
  return prisma.$transaction(async (tx) => {
    const prepared = await prepareOrder(tx, organizationId, payload);
    const orderNumber = await allocateOrderNumber(tx, organizationId);
    const order = await tx.commerceOrder.create({ data: { organizationId, orderNumber, ...prepared.header, status: "Draft", fulfillmentStatus: "Unfulfilled", subtotal: prepared.calculated.subtotal, discountTotal: prepared.discountTotal, taxTotal: prepared.calculated.taxTotal, shippingTotal: prepared.shippingTotal, total: prepared.total, createdById: userId, lines: { create: prepared.calculated.lineItems.map((line) => ({ organizationId, productId: line.productId!, description: line.description, quantity: line.quantity, unitPrice: line.unitPrice, discountAmount: line.discountAmount, taxRate: line.taxRate, lineSubtotal: line.lineSubtotal, taxAmount: line.taxAmount, lineTotal: line.lineTotal, sortOrder: line.displayOrder, priceBookEntryId: line.productId ? prepared.entriesByProduct.get(line.productId)?.id ?? null : null })) }, ...(prepared.promotion ? { promotions: { create: { organizationId, promotionId: prepared.promotion.id, discountAmount: prepared.promotionDiscount } } } : {}) }, include: commerceOrderInclude });
    const notification = await createCommerceNotification(tx, { organizationId, userId, title: "Order created", body: `${order.orderNumber} was created as a Draft.` });
    return { order, notifications: [notification] };
  });
}

export async function updateCommerceOrder(organizationId: string, userId: string, id: string, payload: RecordData) {
  return prisma.$transaction(async (tx) => {
    const existing = await requireOrderFrom(tx, organizationId, id);
    if (existing.status !== "Draft") throw new CommerceDomainError("Only Draft orders can be edited.", 409);
    const prepared = await prepareOrder(tx, organizationId, payload, existing);
    await tx.commerceOrderPromotion.deleteMany({ where: { organizationId, orderId: id } });
    await tx.commerceOrderLine.deleteMany({ where: { organizationId, orderId: id } });
    const order = await tx.commerceOrder.update({ where: { id }, data: { ...prepared.header, subtotal: prepared.calculated.subtotal, discountTotal: prepared.discountTotal, taxTotal: prepared.calculated.taxTotal, shippingTotal: prepared.shippingTotal, total: prepared.total, lines: { create: prepared.calculated.lineItems.map((line) => ({ organizationId, productId: line.productId!, description: line.description, quantity: line.quantity, unitPrice: line.unitPrice, discountAmount: line.discountAmount, taxRate: line.taxRate, lineSubtotal: line.lineSubtotal, taxAmount: line.taxAmount, lineTotal: line.lineTotal, sortOrder: line.displayOrder, priceBookEntryId: line.productId ? prepared.entriesByProduct.get(line.productId)?.id ?? null : null })) }, ...(prepared.promotion ? { promotions: { create: { organizationId, promotionId: prepared.promotion.id, discountAmount: prepared.promotionDiscount } } } : {}) }, include: commerceOrderInclude });
    await createCommerceNotification(tx, { organizationId, userId, title: "Order updated", body: `${order.orderNumber} was updated.` });
    return order;
  });
}

async function reserveInventory(tx: Transaction, organizationId: string, order: CommerceOrderAggregate, release = false) {
  for (const line of order.lines) {
    const inventory = await tx.inventoryItem.findFirst({ where: { organizationId, storeId: order.storeId, productId: line.productId } });
    if (!inventory) continue;
    const available = inventory.quantityOnHand.minus(inventory.quantityReserved);
    if (!release && available.lt(line.quantity)) throw new CommerceDomainError(`Insufficient inventory for ${line.product.name}. Available: ${available.toFixed(3)}.`, 409);
    await tx.inventoryItem.update({ where: { id: inventory.id }, data: { quantityReserved: release ? Prisma.Decimal.max(0, inventory.quantityReserved.minus(line.quantity)) : inventory.quantityReserved.plus(line.quantity) } });
  }
}

function inventoryForStore(tx: Transaction, organizationId: string, storeId: string) {
  return tx.inventoryItem.findMany({
    where: { organizationId, storeId },
    include: { product: true, store: true },
    orderBy: { updatedAt: "desc" }
  });
}

export async function transitionCommerceOrder(organizationId: string, userId: string, id: string, action: string, payload: RecordData = {}) {
  return prisma.$transaction(async (tx) => {
    const existing = await requireOrderFrom(tx, organizationId, id);
    const normalized = action.toLowerCase();
    if (normalized === "confirm") {
      if (existing.status !== "Draft") throw new CommerceDomainError(`Cannot confirm an order while it is ${existing.status}.`, 409);
      if (!existing.lines.length) throw new CommerceDomainError("Add at least one line item before confirming the order.", 400);
      if (existing.store.status !== "Active") throw new CommerceDomainError("The Store must be Active before confirming an order.", 409);
      await reserveInventory(tx, organizationId, existing);
      const promotion = existing.promotions[0]
        ? await tx.commercePromotion.update({ where: { id: existing.promotions[0].promotionId }, data: { redemptionCount: { increment: 1 } }, include: { store: true } })
        : undefined;
      const order = await tx.commerceOrder.update({ where: { id }, data: { status: "Confirmed", confirmedAt: new Date() }, include: commerceOrderInclude });
      const notification = await createCommerceNotification(tx, { organizationId, userId, title: "Order confirmed", body: `${order.orderNumber} was confirmed. No payment was processed by the CRM.` });
      return { order, promotion, inventoryItems: await inventoryForStore(tx, organizationId, existing.storeId), notifications: [notification] };
    }
    if (normalized === "cancel") {
      if (!(["Draft", "Confirmed"] as string[]).includes(existing.status)) throw new CommerceDomainError(`Cannot cancel an order while it is ${existing.status}.`, 409);
      if (existing.fulfillments.some((fulfillment) => ["Shipped", "Delivered"].includes(fulfillment.status))) throw new CommerceDomainError("An order with shipped items cannot be cancelled.", 409);
      if (existing.status === "Confirmed") await reserveInventory(tx, organizationId, existing, true);
      const order = await tx.commerceOrder.update({ where: { id }, data: { status: "Cancelled", cancelledAt: new Date(), fulfillmentStatus: "Cancelled" }, include: commerceOrderInclude });
      const notification = await createCommerceNotification(tx, { organizationId, userId, title: "Order cancelled", body: `${order.orderNumber} was cancelled.` });
      return { order, inventoryItems: await inventoryForStore(tx, organizationId, existing.storeId), notifications: [notification] };
    }
    if (normalized === "fulfill") return fulfillCommerceOrder(tx, organizationId, userId, existing, payload);
    if (normalized === "deliver") {
      if (existing.status !== "Fulfilled") throw new CommerceDomainError("Only a fully fulfilled order can be marked delivered.", 409);
      const fulfillmentId = requiredText(payload.fulfillmentId ?? existing.fulfillments[0]?.id, "Fulfillment");
      const result = await tx.commerceFulfillment.updateMany({ where: { id: fulfillmentId, orderId: id, organizationId, status: "Shipped" }, data: { status: "Delivered", deliveredAt: new Date() } });
      if (!result.count) throw new CommerceDomainError("A shipped fulfillment was not found.", 404);
      const order = await requireOrderFrom(tx, organizationId, id);
      const notification = await createCommerceNotification(tx, { organizationId, userId, title: "Order delivered", body: `${order.orderNumber} was marked delivered.` });
      return { order, notifications: [notification] };
    }
    throw new CommerceDomainError("Choose a valid order action.", 400);
  });
}

async function fulfillCommerceOrder(tx: Transaction, organizationId: string, userId: string, order: CommerceOrderAggregate, payload: RecordData) {
  if (order.status !== "Confirmed") throw new CommerceDomainError(`Cannot fulfill an order while it is ${order.status}.`, 409);
  const requested = Array.isArray(payload.lines) ? payload.lines as RecordData[] : order.lines.map((line) => ({ orderLineId: line.id, quantity: line.quantity.minus(line.fulfilledQuantity) }));
  if (!requested.length) throw new CommerceDomainError("Choose at least one line to fulfill.", 400);
  const byId = new Map(order.lines.map((line) => [line.id, line]));
  const normalized = requested.map((line, index) => {
    const orderLineId = requiredText(line.orderLineId, `Fulfillment line ${index + 1}`);
    const source = byId.get(orderLineId);
    if (!source) throw new CommerceDomainError(`Fulfillment line ${index + 1} does not belong to this order.`, 400);
    const quantity = decimal(line.quantity, `Fulfillment line ${index + 1} quantity`, 3);
    const remaining = source.quantity.minus(source.fulfilledQuantity);
    if (quantity.lte(0) || quantity.gt(remaining)) throw new CommerceDomainError(`Fulfillment quantity for ${source.product.name} must be greater than zero and no more than ${remaining.toFixed(3)}.`, 400);
    return { source, quantity };
  });
  const ordinal = order.fulfillments.length + 1;
  const fulfillment = await tx.commerceFulfillment.create({ data: { organizationId, orderId: order.id, fulfillmentNumber: `${order.orderNumber}-F${String(ordinal).padStart(2, "0")}`, status: text(payload.status) === "Packed" ? "Packed" : "Shipped", carrier: text(payload.carrier), trackingNumber: text(payload.trackingNumber), notes: text(payload.notes), createdById: userId, packedAt: new Date(), shippedAt: text(payload.status) === "Packed" ? null : new Date(), lines: { create: normalized.map(({ source, quantity }) => ({ organizationId, orderLineId: source.id, quantity })) } } });
  for (const { source, quantity } of normalized) {
    await tx.commerceOrderLine.update({ where: { id: source.id }, data: { fulfilledQuantity: { increment: quantity } } });
    const inventory = await tx.inventoryItem.findFirst({ where: { organizationId, storeId: order.storeId, productId: source.productId } });
    if (inventory) await tx.inventoryItem.update({ where: { id: inventory.id }, data: { quantityOnHand: Prisma.Decimal.max(0, inventory.quantityOnHand.minus(quantity)), quantityReserved: Prisma.Decimal.max(0, inventory.quantityReserved.minus(quantity)) } });
  }
  const refreshedLines = await tx.commerceOrderLine.findMany({ where: { organizationId, orderId: order.id } });
  const complete = refreshedLines.every((line) => line.fulfilledQuantity.gte(line.quantity));
  const updated = await tx.commerceOrder.update({ where: { id: order.id }, data: { status: complete ? "Fulfilled" : "Confirmed", fulfillmentStatus: complete ? "Fulfilled" : "Partially Fulfilled", fulfilledAt: complete ? new Date() : null }, include: commerceOrderInclude });
  const notification = await createCommerceNotification(tx, { organizationId, userId, title: complete ? "Order fulfilled" : "Order partially fulfilled", body: `${updated.orderNumber} fulfillment ${fulfillment.fulfillmentNumber} was recorded.` });
  return { order: updated, fulfillment, inventoryItems: await inventoryForStore(tx, organizationId, order.storeId), notifications: [notification] };
}

export async function deleteCommerceOrder(organizationId: string, id: string) {
  const order = await requireCommerceOrder(organizationId, id);
  if (order.status !== "Draft") throw new CommerceDomainError("Only Draft orders can be deleted.", 409);
  await prisma.commerceOrder.deleteMany({ where: { id, organizationId } });
}

export async function upsertInventory(organizationId: string, storeId: string, payload: RecordData) {
  await requireCommerceStore(organizationId, storeId);
  const productId = requiredText(payload.productId, "Product");
  if (!(await prisma.product.findFirst({ where: { id: productId, organizationId }, select: { id: true } }))) throw new CommerceDomainError("Product not found.", 404, "productId");
  const quantityOnHand = decimal(payload.quantityOnHand, "Quantity on hand", 3);
  const reorderPoint = decimal(payload.reorderPoint, "Reorder point", 3);
  if (quantityOnHand.lt(0) || reorderPoint.lt(0)) throw new CommerceDomainError("Inventory quantities cannot be negative.", 400);
  const existing = await prisma.inventoryItem.findUnique({ where: { organizationId_storeId_productId: { organizationId, storeId, productId } } });
  if (existing && quantityOnHand.lt(existing.quantityReserved)) throw new CommerceDomainError(`Quantity on hand cannot be below the reserved quantity (${existing.quantityReserved.toFixed(3)}).`, 409);
  return prisma.inventoryItem.upsert({ where: { organizationId_storeId_productId: { organizationId, storeId, productId } }, update: { quantityOnHand, reorderPoint }, create: { organizationId, storeId, productId, quantityOnHand, reorderPoint }, include: { product: true } });
}

export async function createPromotion(organizationId: string, userId: string, storeId: string, payload: RecordData) {
  await requireCommerceStore(organizationId, storeId);
  const name = requiredText(payload.name, "Promotion name");
  const code = requiredText(payload.code, "Promotion code").toUpperCase();
  const type = requiredText(payload.type, "Promotion type");
  if (!(PROMOTION_TYPES as readonly string[]).includes(type)) throw new CommerceDomainError("Choose a valid promotion type.", 400, "type");
  const value = decimal(payload.value, "Promotion value");
  if (value.lte(0) || (type === "Percentage" && value.gt(100))) throw new CommerceDomainError(type === "Percentage" ? "Percentage promotions must be greater than 0 and no more than 100." : "Promotion value must be greater than zero.", 400, "value");
  const startsAt = parseDate(payload.startsAt, "Promotion start date");
  const endsAt = parseDate(payload.endsAt, "Promotion end date");
  if (startsAt && endsAt && endsAt < startsAt) throw new CommerceDomainError("Promotion end date cannot precede its start date.", 400, "endsAt");
  const minimumOrderAmount = payload.minimumOrderAmount ? decimal(payload.minimumOrderAmount, "Minimum order amount") : null;
  const maxRedemptions = payload.maxRedemptions ? Number(payload.maxRedemptions) : null;
  if (maxRedemptions !== null && (!Number.isInteger(maxRedemptions) || maxRedemptions <= 0)) throw new CommerceDomainError("Maximum redemptions must be a positive whole number.", 400, "maxRedemptions");
  if (await prisma.commercePromotion.findFirst({ where: { organizationId, storeId, code }, select: { id: true } })) throw new CommerceDomainError("That promotion code already exists for this store.", 409, "code");
  return prisma.commercePromotion.create({ data: { organizationId, storeId, name, code, type, value, minimumOrderAmount, startsAt, endsAt, maxRedemptions, active: payload.active !== false, createdById: userId } });
}

export function commerceErrorResponse(error: unknown) {
  return error instanceof CommerceDomainError ? { error: error.message, field: error.field, status: error.status } : null;
}
