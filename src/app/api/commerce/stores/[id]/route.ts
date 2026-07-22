import { authorizationErrorResponse, requireOrganizationContext } from "@/lib/organization-context";
import { commerceErrorResponse, createCommerceNotification, requireCommerceStore, updateCommerceStore } from "@/lib/commerce";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type Params = Promise<{ id: string }>;

export async function GET(_request: NextRequest, { params }: { params: Params }) {
  try { const context = await requireOrganizationContext(); const { id } = await params; return NextResponse.json({ store: JSON.parse(JSON.stringify(await requireCommerceStore(context.organizationId, id))) }); }
  catch (error) { const auth = authorizationErrorResponse(error); if (auth) return auth; const domain = commerceErrorResponse(error); return domain ? NextResponse.json({ error: domain.error }, { status: domain.status }) : NextResponse.json({ error: "Unable to load store." }, { status: 500 }); }
}

export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  try { const context = await requireOrganizationContext(); const { id } = await params; const store = await updateCommerceStore(context.organizationId, context.userId, id, await request.json()); return NextResponse.json({ store: JSON.parse(JSON.stringify(store)) }); }
  catch (error) { const auth = authorizationErrorResponse(error); if (auth) return auth; const domain = commerceErrorResponse(error); return domain ? NextResponse.json({ error: domain.error, field: domain.field }, { status: domain.status }) : NextResponse.json({ error: "Unable to update store." }, { status: 500 }); }
}

export async function DELETE(_request: NextRequest, { params }: { params: Params }) {
  try {
    const context = await requireOrganizationContext(); const { id } = await params; const store = await requireCommerceStore(context.organizationId, id);
    if (store.status !== "Draft" || store._count.orders) return NextResponse.json({ error: "Only a Draft store without orders can be deleted." }, { status: 409 });
    await prisma.$transaction(async (tx) => { await tx.marketingStore.deleteMany({ where: { id, organizationId: context.organizationId } }); await createCommerceNotification(tx, { organizationId: context.organizationId, userId: context.userId, title: "Store deleted", body: `${store.name} was deleted.` }); });
    return NextResponse.json({ ok: true });
  } catch (error) { const auth = authorizationErrorResponse(error); if (auth) return auth; const domain = commerceErrorResponse(error); return domain ? NextResponse.json({ error: domain.error }, { status: domain.status }) : NextResponse.json({ error: "Unable to delete store." }, { status: 500 }); }
}
