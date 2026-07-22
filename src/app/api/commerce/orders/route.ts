import { authorizationErrorResponse, requireOrganizationContext } from "@/lib/organization-context";
import { commerceErrorResponse, commerceOrderInclude, createCommerceOrder } from "@/lib/commerce";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try { const context = await requireOrganizationContext(); const status = request.nextUrl.searchParams.get("status"); const storeId = request.nextUrl.searchParams.get("storeId"); const orders = await prisma.commerceOrder.findMany({ where: { organizationId: context.organizationId, ...(status ? { status } : {}), ...(storeId ? { storeId } : {}) }, include: commerceOrderInclude, orderBy: { orderDate: "desc" } }); return NextResponse.json({ orders: JSON.parse(JSON.stringify(orders)) }); }
  catch (error) { return authorizationErrorResponse(error) ?? NextResponse.json({ error: "Unable to load orders." }, { status: 500 }); }
}
export async function POST(request: NextRequest) {
  try { const context = await requireOrganizationContext(); const result = await createCommerceOrder(context.organizationId, context.userId, await request.json()); return NextResponse.json(JSON.parse(JSON.stringify(result)), { status: 201 }); }
  catch (error) { const auth = authorizationErrorResponse(error); if (auth) return auth; const domain = commerceErrorResponse(error); if (domain) return NextResponse.json({ error: domain.error, field: domain.field }, { status: domain.status }); console.error(error); return NextResponse.json({ error: "Unable to create order." }, { status: 500 }); }
}
