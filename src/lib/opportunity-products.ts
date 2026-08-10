import "server-only";

import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import {
  calculateOpportunityProduct,
  OpportunityProductInputError,
  type OpportunityProductInput
} from "@/lib/opportunity-product-lines";
import { prisma } from "@/lib/prisma";
import type { RecordData } from "@/lib/crm-types";

export const opportunityProductInclude = { product: true } satisfies Prisma.OpportunityProductInclude;

export const opportunityProductOrder: Prisma.OpportunityProductOrderByWithRelationInput[] = [
  { displayOrder: "asc" },
  { createdAt: "asc" }
];

export class OpportunityProductError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 = 400,
    readonly field?: string
  ) {
    super(message);
    this.name = "OpportunityProductError";
  }
}

/** Maps a domain failure onto the `{ error, fields }` body the browser client understands. */
export function opportunityProductErrorResponse(error: unknown) {
  if (!(error instanceof OpportunityProductError)) return null;
  return NextResponse.json(
    { error: error.message, ...(error.field ? { fields: { [error.field]: error.message } } : {}) },
    { status: error.status }
  );
}

function calculate(input: OpportunityProductInput) {
  try {
    return calculateOpportunityProduct(input);
  } catch (error) {
    if (error instanceof OpportunityProductInputError)
      throw new OpportunityProductError(error.message, 400, error.field);
    throw error;
  }
}

/** True when the client omitted the field so the server may apply a default. Empty string is not omitted. */
function omitted(value: unknown) {
  return value === undefined || value === null;
}

async function assertOpportunity(organizationId: string, opportunityId: string) {
  const opportunity = await prisma.opportunity.findFirst({
    where: { id: opportunityId, organizationId },
    select: { id: true }
  });
  if (!opportunity) throw new OpportunityProductError("Opportunity not found.", 404);
  return opportunity;
}

async function assertLine(organizationId: string, opportunityId: string, lineId: string) {
  const line = await prisma.opportunityProduct.findFirst({
    where: { id: lineId, opportunityId, organizationId },
    include: opportunityProductInclude
  });
  if (!line) throw new OpportunityProductError("Opportunity Product not found.", 404);
  return line;
}

/**
 * Sales price suggested when a line is added without one: the active list price from the
 * standard price book wins, then any other active price book, then the catalogue price.
 */
async function defaultUnitPrice(organizationId: string, productId: string, catalogPrice: Prisma.Decimal | null) {
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

export async function listOpportunityProducts(organizationId: string, opportunityId: string) {
  await assertOpportunity(organizationId, opportunityId);
  return prisma.opportunityProduct.findMany({
    where: { organizationId, opportunityId },
    include: opportunityProductInclude,
    orderBy: opportunityProductOrder
  });
}

export async function addOpportunityProduct(organizationId: string, opportunityId: string, payload: RecordData) {
  await assertOpportunity(organizationId, opportunityId);

  const productId = String(payload.productId ?? "").trim();
  if (!productId) throw new OpportunityProductError("Choose a Product.", 400, "productId");
  const product = await prisma.product.findFirst({ where: { id: productId, organizationId } });
  if (!product) throw new OpportunityProductError("Product not found.", 404, "productId");
  if (!product.active)
    throw new OpportunityProductError("Only active Products can be assigned to an Opportunity.", 400, "productId");

  const duplicate = await prisma.opportunityProduct.findFirst({
    where: { organizationId, opportunityId, productId },
    select: { id: true }
  });
  if (duplicate)
    throw new OpportunityProductError(
      "This Product is already assigned to the Opportunity. Edit the existing line instead.",
      409,
      "productId"
    );

  const [unitPrice, lastLine] = await Promise.all([
    omitted(payload.unitPrice)
      ? defaultUnitPrice(organizationId, productId, product.price)
      : Promise.resolve(payload.unitPrice as string),
    prisma.opportunityProduct.findFirst({
      where: { organizationId, opportunityId },
      orderBy: { displayOrder: "desc" },
      select: { displayOrder: true }
    })
  ]);

  const line = calculate({
    quantity: omitted(payload.quantity) ? 1 : (payload.quantity as string),
    unitPrice,
    // Omitted description inherits the catalogue copy; an explicit blank clears the line note.
    description: omitted(payload.description) ? product.description : (payload.description as string | null),
    displayOrder: Number.isInteger(Number(payload.displayOrder))
      ? Number(payload.displayOrder)
      : (lastLine?.displayOrder ?? -1) + 1
  });

  try {
    return await prisma.opportunityProduct.create({
      data: { organizationId, opportunityId, productId, ...line },
      include: opportunityProductInclude
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new OpportunityProductError(
        "This Product is already assigned to the Opportunity. Edit the existing line instead.",
        409,
        "productId"
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      throw new OpportunityProductError("The Product or Opportunity no longer exists.", 409);
    }
    throw error;
  }
}

export async function updateOpportunityProduct(
  organizationId: string,
  opportunityId: string,
  lineId: string,
  payload: RecordData
) {
  const existing = await assertLine(organizationId, opportunityId, lineId);
  const line = calculate({
    quantity: payload.quantity === undefined ? existing.quantity : (payload.quantity as string),
    unitPrice: payload.unitPrice === undefined ? existing.unitPrice : (payload.unitPrice as string),
    description: payload.description === undefined ? existing.description : (payload.description as string | null),
    displayOrder: Number.isInteger(Number(payload.displayOrder)) ? Number(payload.displayOrder) : existing.displayOrder
  });

  return prisma.opportunityProduct.update({
    where: { id: lineId },
    data: line,
    include: opportunityProductInclude
  });
}

export async function deleteOpportunityProduct(organizationId: string, opportunityId: string, lineId: string) {
  const existing = await assertLine(organizationId, opportunityId, lineId);
  await prisma.opportunityProduct.deleteMany({ where: { id: lineId, opportunityId, organizationId } });
  return existing;
}
