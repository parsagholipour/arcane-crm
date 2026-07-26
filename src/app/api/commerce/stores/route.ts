import { authorizationErrorResponse, requireOrganizationContext } from "@/lib/organization-context";
import { commerceErrorResponse, commerceStoreInclude, createCommerceStore } from "@/lib/commerce";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const context = await requireOrganizationContext();
    const stores = await prisma.marketingStore.findMany({
      where: { organizationId: context.organizationId },
      include: commerceStoreInclude,
      orderBy: { updatedAt: "desc" }
    });
    return NextResponse.json({ stores: JSON.parse(JSON.stringify(stores)) });
  } catch (error) {
    return authorizationErrorResponse(error) ?? NextResponse.json({ error: "Unable to load stores." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireOrganizationContext();
    const result = await createCommerceStore(context.organizationId, context.userId, await request.json());
    return NextResponse.json(JSON.parse(JSON.stringify(result)), { status: 201 });
  } catch (error) {
    const auth = authorizationErrorResponse(error);
    if (auth) return auth;
    const domain = commerceErrorResponse(error);
    if (domain) return NextResponse.json({ error: domain.error, field: domain.field }, { status: domain.status });
    console.error(error);
    return NextResponse.json({ error: "Unable to create store." }, { status: 500 });
  }
}
