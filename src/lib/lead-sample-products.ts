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

export const leadSampleProductInclude = { product: true } satisfies Prisma.LeadSampleProductInclude;

export const leadSampleProductOrder: Prisma.LeadSampleProductOrderByWithRelationInput[] = [
  { displayOrder: "asc" },
  { createdAt: "asc" }
];

const DUPLICATE_LINE = "This Product is already in the Lead's sample. Edit the existing line instead.";

async function assertLead(organizationId: string, leadId: string) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId },
    select: { id: true, convertedAt: true }
  });
  if (!lead) throw new ProductLineError("Lead not found.", 404);
  return lead;
}

/** Converted Leads are read-only everywhere else, so their sample lines are frozen too. */
async function assertEditableLead(organizationId: string, leadId: string) {
  const lead = await assertLead(organizationId, leadId);
  if (lead.convertedAt)
    throw new ProductLineError(
      "Converted Leads are read-only. Open the converted Account, Contact, or Opportunity instead.",
      409
    );
  return lead;
}

async function assertLine(organizationId: string, leadId: string, lineId: string) {
  const line = await prisma.leadSampleProduct.findFirst({
    where: { id: lineId, leadId, organizationId },
    include: leadSampleProductInclude
  });
  if (!line) throw new ProductLineError("Sample Product not found.", 404);
  return line;
}

export async function listLeadSampleProducts(organizationId: string, leadId: string) {
  await assertLead(organizationId, leadId);
  return prisma.leadSampleProduct.findMany({
    where: { organizationId, leadId },
    include: leadSampleProductInclude,
    orderBy: leadSampleProductOrder
  });
}

export async function addLeadSampleProduct(organizationId: string, leadId: string, payload: RecordData) {
  await assertEditableLead(organizationId, leadId);
  const product = await assignableProduct(organizationId, payload.productId, "a Lead sample");

  const duplicate = await prisma.leadSampleProduct.findFirst({
    where: { organizationId, leadId, productId: product.id },
    select: { id: true }
  });
  if (duplicate) throw new ProductLineError(DUPLICATE_LINE, 409, "productId");

  const [unitPrice, lastLine] = await Promise.all([
    omitted(payload.unitPrice)
      ? defaultUnitPrice(organizationId, product.id, product.price)
      : Promise.resolve(payload.unitPrice as string),
    prisma.leadSampleProduct.findFirst({
      where: { organizationId, leadId },
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
    return await prisma.leadSampleProduct.create({
      data: { organizationId, leadId, productId: product.id, ...line },
      include: leadSampleProductInclude
    });
  } catch (error) {
    throw assignConflictError(error, DUPLICATE_LINE, "The Product or Lead no longer exists.");
  }
}

export async function updateLeadSampleProduct(
  organizationId: string,
  leadId: string,
  lineId: string,
  payload: RecordData
) {
  await assertEditableLead(organizationId, leadId);
  const existing = await assertLine(organizationId, leadId, lineId);
  const line = calculateLine({
    quantity: payload.quantity === undefined ? existing.quantity : (payload.quantity as string),
    unitPrice: payload.unitPrice === undefined ? existing.unitPrice : (payload.unitPrice as string),
    description: payload.description === undefined ? existing.description : (payload.description as string | null),
    displayOrder: Number.isInteger(Number(payload.displayOrder)) ? Number(payload.displayOrder) : existing.displayOrder
  });

  return prisma.leadSampleProduct.update({
    where: { id: lineId },
    data: line,
    include: leadSampleProductInclude
  });
}

export async function deleteLeadSampleProduct(organizationId: string, leadId: string, lineId: string) {
  await assertEditableLead(organizationId, leadId);
  const existing = await assertLine(organizationId, leadId, lineId);
  await prisma.leadSampleProduct.deleteMany({ where: { id: lineId, leadId, organizationId } });
  return existing;
}
