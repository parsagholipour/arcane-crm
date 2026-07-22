import { authorizationErrorResponse, requireOrganizationContext } from "@/lib/organization-context";
import { commerceErrorResponse, requireCommerceStore } from "@/lib/commerce";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type Params = Promise<{ id: string; promotionId: string }>;
export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  try { const context = await requireOrganizationContext(); const { id, promotionId } = await params; await requireCommerceStore(context.organizationId, id); const payload = await request.json(); const result = await prisma.commercePromotion.updateMany({ where: { id: promotionId, storeId: id, organizationId: context.organizationId }, data: { active: payload.active === undefined ? undefined : Boolean(payload.active), name: payload.name === undefined ? undefined : String(payload.name).trim() } }); if (!result.count) return NextResponse.json({ error: "Promotion not found." }, { status: 404 }); const promotion = await prisma.commercePromotion.findFirst({ where: { id: promotionId, storeId: id, organizationId: context.organizationId } }); return NextResponse.json({ promotion: JSON.parse(JSON.stringify(promotion)) }); }
  catch (error) { const auth = authorizationErrorResponse(error); if (auth) return auth; const domain = commerceErrorResponse(error); return domain ? NextResponse.json({ error: domain.error }, { status: domain.status }) : NextResponse.json({ error: "Unable to update promotion." }, { status: 500 }); }
}
export async function DELETE(_request: NextRequest, { params }: { params: Params }) {
  try { const context = await requireOrganizationContext(); const { id, promotionId } = await params; await requireCommerceStore(context.organizationId, id); const used = await prisma.commerceOrderPromotion.count({ where: { organizationId: context.organizationId, promotionId } }); if (used) return NextResponse.json({ error: "A promotion used on an order cannot be deleted. Deactivate it instead." }, { status: 409 }); const result = await prisma.commercePromotion.deleteMany({ where: { id: promotionId, storeId: id, organizationId: context.organizationId } }); if (!result.count) return NextResponse.json({ error: "Promotion not found." }, { status: 404 }); return NextResponse.json({ ok: true }); }
  catch (error) { const auth = authorizationErrorResponse(error); if (auth) return auth; const domain = commerceErrorResponse(error); return domain ? NextResponse.json({ error: domain.error }, { status: domain.status }) : NextResponse.json({ error: "Unable to delete promotion." }, { status: 500 }); }
}
