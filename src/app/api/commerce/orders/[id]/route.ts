import { authorizationErrorResponse, requireOrganizationContext } from "@/lib/organization-context";
import { commerceErrorResponse, deleteCommerceOrder, requireCommerceOrder, updateCommerceOrder } from "@/lib/commerce";
import { NextRequest, NextResponse } from "next/server";

type Params = Promise<{ id: string }>;
export async function GET(_request: NextRequest, { params }: { params: Params }) {
  try { const context = await requireOrganizationContext(); const { id } = await params; return NextResponse.json({ order: JSON.parse(JSON.stringify(await requireCommerceOrder(context.organizationId, id))) }); }
  catch (error) { const auth = authorizationErrorResponse(error); if (auth) return auth; const domain = commerceErrorResponse(error); return domain ? NextResponse.json({ error: domain.error }, { status: domain.status }) : NextResponse.json({ error: "Unable to load order." }, { status: 500 }); }
}
export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  try { const context = await requireOrganizationContext(); const { id } = await params; const order = await updateCommerceOrder(context.organizationId, context.userId, id, await request.json()); return NextResponse.json({ order: JSON.parse(JSON.stringify(order)) }); }
  catch (error) { const auth = authorizationErrorResponse(error); if (auth) return auth; const domain = commerceErrorResponse(error); return domain ? NextResponse.json({ error: domain.error, field: domain.field }, { status: domain.status }) : NextResponse.json({ error: "Unable to update order." }, { status: 500 }); }
}
export async function DELETE(_request: NextRequest, { params }: { params: Params }) {
  try { const context = await requireOrganizationContext(); const { id } = await params; await deleteCommerceOrder(context.organizationId, id); return NextResponse.json({ ok: true }); }
  catch (error) { const auth = authorizationErrorResponse(error); if (auth) return auth; const domain = commerceErrorResponse(error); return domain ? NextResponse.json({ error: domain.error }, { status: domain.status }) : NextResponse.json({ error: "Unable to delete order." }, { status: 500 }); }
}
