import { authorizationErrorResponse, requireOrganizationContext } from "@/lib/organization-context";
import { commerceErrorResponse, transitionCommerceOrder } from "@/lib/commerce";
import { NextRequest, NextResponse } from "next/server";

type Params = Promise<{ id: string }>;
export async function POST(request: NextRequest, { params }: { params: Params }) {
  try {
    const context = await requireOrganizationContext();
    const { id } = await params;
    const payload = await request.json();
    const result = await transitionCommerceOrder(
      context.organizationId,
      context.userId,
      id,
      String(payload.action ?? ""),
      payload
    );
    return NextResponse.json(JSON.parse(JSON.stringify(result)));
  } catch (error) {
    const auth = authorizationErrorResponse(error);
    if (auth) return auth;
    const domain = commerceErrorResponse(error);
    return domain
      ? NextResponse.json({ error: domain.error, field: domain.field }, { status: domain.status })
      : NextResponse.json({ error: "Unable to update order." }, { status: 500 });
  }
}
