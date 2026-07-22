import { authorizationErrorResponse, requireOrganizationContext } from "@/lib/organization-context";
import { commerceErrorResponse, requireCommerceStore, upsertInventory } from "@/lib/commerce";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type Params = Promise<{ id: string }>;
export async function GET(_request: NextRequest, { params }: { params: Params }) {
  try { const context = await requireOrganizationContext(); const { id } = await params; await requireCommerceStore(context.organizationId, id); const inventory = await prisma.inventoryItem.findMany({ where: { organizationId: context.organizationId, storeId: id }, include: { product: true }, orderBy: { updatedAt: "desc" } }); return NextResponse.json({ inventory: JSON.parse(JSON.stringify(inventory)) }); }
  catch (error) { const auth = authorizationErrorResponse(error); if (auth) return auth; const domain = commerceErrorResponse(error); return domain ? NextResponse.json({ error: domain.error }, { status: domain.status }) : NextResponse.json({ error: "Unable to load inventory." }, { status: 500 }); }
}
export async function POST(request: NextRequest, { params }: { params: Params }) {
  try { const context = await requireOrganizationContext(); const { id } = await params; const inventoryItem = await upsertInventory(context.organizationId, id, await request.json()); return NextResponse.json({ inventoryItem: JSON.parse(JSON.stringify(inventoryItem)) }); }
  catch (error) { const auth = authorizationErrorResponse(error); if (auth) return auth; const domain = commerceErrorResponse(error); return domain ? NextResponse.json({ error: domain.error, field: domain.field }, { status: domain.status }) : NextResponse.json({ error: "Unable to update inventory." }, { status: 500 }); }
}
