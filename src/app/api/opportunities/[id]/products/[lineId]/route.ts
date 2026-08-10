import { NextRequest, NextResponse } from "next/server";
import { authorizationErrorResponse, requireOrganizationContext } from "@/lib/organization-context";
import {
  deleteOpportunityProduct,
  opportunityProductErrorResponse,
  updateOpportunityProduct
} from "@/lib/opportunity-products";

type Params = Promise<{ id: string; lineId: string }>;

export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  try {
    const context = await requireOrganizationContext();
    const { id, lineId } = await params;
    const payload = await request.json();
    const line = await updateOpportunityProduct(context.organizationId, id, lineId, payload);
    return NextResponse.json({ product: JSON.parse(JSON.stringify(line)) });
  } catch (error) {
    return (
      authorizationErrorResponse(error) ??
      opportunityProductErrorResponse(error) ??
      NextResponse.json({ error: "Unable to update the Opportunity Product." }, { status: 500 })
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Params }) {
  try {
    const context = await requireOrganizationContext();
    const { id, lineId } = await params;
    await deleteOpportunityProduct(context.organizationId, id, lineId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return (
      authorizationErrorResponse(error) ??
      opportunityProductErrorResponse(error) ??
      NextResponse.json({ error: "Unable to remove the Opportunity Product." }, { status: 500 })
    );
  }
}
