import "server-only";

import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import {
  calculateOpportunityProduct,
  OpportunityProductInputError,
  type OpportunityProductInput
} from "@/lib/opportunity-product-lines";
import { prisma } from "@/lib/prisma";

/**
 * Behaviour shared by every "Products assigned to a record" list — Opportunity Products and
 * Lead Sample Products. Only the Prisma delegate and the parent column differ, so those stay
 * in the per-object services and everything else lives here.
 */
export class ProductLineError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 = 400,
    readonly field?: string
  ) {
    super(message);
    this.name = "ProductLineError";
  }
}

/** Maps a domain failure onto the `{ error, fields }` body the browser client understands. */
export function productLineErrorResponse(error: unknown) {
  if (!(error instanceof ProductLineError)) return null;
  return NextResponse.json(
    { error: error.message, ...(error.field ? { fields: { [error.field]: error.message } } : {}) },
    { status: error.status }
  );
}

export function calculateLine(input: OpportunityProductInput) {
  try {
    return calculateOpportunityProduct(input);
  } catch (error) {
    if (error instanceof OpportunityProductInputError) throw new ProductLineError(error.message, 400, error.field);
    throw error;
  }
}

/** True when the client omitted the field so the server may apply a default. Empty string is not omitted. */
export function omitted(value: unknown) {
  return value === undefined || value === null;
}

/** Resolve the Product a new line points at: it must be in the tenant and still be active. */
export async function assignableProduct(organizationId: string, rawProductId: unknown, subjectLabel: string) {
  const productId = String(rawProductId ?? "").trim();
  if (!productId) throw new ProductLineError("Choose a Product.", 400, "productId");
  const product = await prisma.product.findFirst({ where: { id: productId, organizationId } });
  if (!product) throw new ProductLineError("Product not found.", 404, "productId");
  if (!product.active)
    throw new ProductLineError(`Only active Products can be assigned to ${subjectLabel}.`, 400, "productId");
  return product;
}

/**
 * Sales price suggested when a line is added without one: the active list price from the
 * standard price book wins, then any other active price book, then the catalogue price.
 */
export async function defaultUnitPrice(organizationId: string, productId: string, catalogPrice: Prisma.Decimal | null) {
  const now = new Date();
  const entries = await prisma.priceBookEntry.findMany({
    where: {
      organizationId,
      productId,
      active: true,
      currency: "USD",
      listPrice: { not: null },
      priceBook: {
        active: true,
        AND: [
          { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
          { OR: [{ validTo: null }, { validTo: { gte: now } }] }
        ]
      }
    },
    include: { priceBook: { select: { isStandard: true } } },
    orderBy: { id: "asc" }
  });
  entries.sort((left, right) => Number(right.priceBook.isStandard) - Number(left.priceBook.isStandard));
  return entries[0]?.listPrice ?? catalogPrice ?? new Prisma.Decimal(0);
}

/** Translate the unique/foreign-key races a concurrent assign can hit into field errors. */
export function assignConflictError(error: unknown, duplicateMessage: string, missingMessage: string) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
    return new ProductLineError(duplicateMessage, 409, "productId");
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003")
    return new ProductLineError(missingMessage, 409);
  return error;
}
