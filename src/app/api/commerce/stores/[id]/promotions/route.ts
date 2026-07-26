import { authorizationErrorResponse, requireOrganizationContext } from "@/lib/organization-context";
import { commerceErrorResponse, createPromotion, requireCommerceStore } from "@/lib/commerce";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type Params = Promise<{ id: string }>;
export async function GET(_request: NextRequest, { params }: { params: Params }) {
  try {
    const context = await requireOrganizationContext();
    const { id } = await params;
    await requireCommerceStore(context.organizationId, id);
    const promotions = await prisma.commercePromotion.findMany({
      where: { organizationId: context.organizationId, storeId: id },
      orderBy: { updatedAt: "desc" }
    });
    return NextResponse.json({ promotions: JSON.parse(JSON.stringify(promotions)) });
  } catch (error) {
    const auth = authorizationErrorResponse(error);
    if (auth) return auth;
    const domain = commerceErrorResponse(error);
    return domain
      ? NextResponse.json({ error: domain.error }, { status: domain.status })
      : NextResponse.json({ error: "Unable to load promotions." }, { status: 500 });
  }
}
export async function POST(request: NextRequest, { params }: { params: Params }) {
  try {
    const context = await requireOrganizationContext();
    const { id } = await params;
    const promotion = await createPromotion(context.organizationId, context.userId, id, await request.json());
    return NextResponse.json({ promotion: JSON.parse(JSON.stringify(promotion)) }, { status: 201 });
  } catch (error) {
    const auth = authorizationErrorResponse(error);
    if (auth) return auth;
    const domain = commerceErrorResponse(error);
    return domain
      ? NextResponse.json({ error: domain.error, field: domain.field }, { status: domain.status })
      : NextResponse.json({ error: "Unable to create promotion." }, { status: 500 });
  }
}
