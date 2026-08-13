import "server-only";

import { Prisma } from "@prisma/client";
import {
  assignableProduct,
  assignConflictError,
  calculateLine,
  defaultUnitPrice,
  omitted,
  ProductLineError
} from "@/lib/product-line-service";
import { prisma } from "@/lib/prisma";
import type { RecordData } from "@/lib/crm-types";

export const opportunityProductInclude = { product: true } satisfies Prisma.OpportunityProductInclude;

export const opportunityProductOrder: Prisma.OpportunityProductOrderByWithRelationInput[] = [
  { displayOrder: "asc" },
  { createdAt: "asc" }
];

const DUPLICATE_LINE = "This Product is already assigned to the Opportunity. Edit the existing line instead.";

async function assertOpportunity(organizationId: string, opportunityId: string) {
  const opportunity = await prisma.opportunity.findFirst({
    where: { id: opportunityId, organizationId },
    select: { id: true }
  });
  if (!opportunity) throw new ProductLineError("Opportunity not found.", 404);
  return opportunity;
}

async function assertLine(organizationId: string, opportunityId: string, lineId: string) {
  const line = await prisma.opportunityProduct.findFirst({
    where: { id: lineId, opportunityId, organizationId },
    include: opportunityProductInclude
  });
  if (!line) throw new ProductLineError("Opportunity Product not found.", 404);
  return line;
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
  const product = await assignableProduct(organizationId, payload.productId, "an Opportunity");

  const duplicate = await prisma.opportunityProduct.findFirst({
    where: { organizationId, opportunityId, productId: product.id },
    select: { id: true }
  });
  if (duplicate) throw new ProductLineError(DUPLICATE_LINE, 409, "productId");

  const [unitPrice, lastLine] = await Promise.all([
    omitted(payload.unitPrice)
      ? defaultUnitPrice(organizationId, product.id, product.price)
      : Promise.resolve(payload.unitPrice as string),
    prisma.opportunityProduct.findFirst({
      where: { organizationId, opportunityId },
      orderBy: { displayOrder: "desc" },
      select: { displayOrder: true }
    })
  ]);

  const line = calculateLine({
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
      data: { organizationId, opportunityId, productId: product.id, ...line },
      include: opportunityProductInclude
    });
  } catch (error) {
    throw assignConflictError(error, DUPLICATE_LINE, "The Product or Opportunity no longer exists.");
  }
}

export async function updateOpportunityProduct(
  organizationId: string,
  opportunityId: string,
  lineId: string,
  payload: RecordData
) {
  const existing = await assertLine(organizationId, opportunityId, lineId);
  const line = calculateLine({
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
