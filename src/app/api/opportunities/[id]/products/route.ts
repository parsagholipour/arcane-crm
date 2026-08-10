import { NextRequest, NextResponse } from "next/server";
import { authorizationErrorResponse, requireOrganizationContext } from "@/lib/organization-context";
import {
  addOpportunityProduct,
  listOpportunityProducts,
  opportunityProductErrorResponse
} from "@/lib/opportunity-products";

type Params = Promise<{ id: string }>;

export async function GET(_request: NextRequest, { params }: { params: Params }) {
  try {
    const context = await requireOrganizationContext();
    const { id } = await params;
    const lines = await listOpportunityProducts(context.organizationId, id);
    return NextResponse.json({ products: JSON.parse(JSON.stringify(lines)) });
  } catch (error) {
    return (
      authorizationErrorResponse(error) ??
      opportunityProductErrorResponse(error) ??
      NextResponse.json({ error: "Unable to load Opportunity Products." }, { status: 500 })
    );
  }
}

export async function POST(request: NextRequest, { params }: { params: Params }) {
  try {
    const context = await requireOrganizationContext();
    const { id } = await params;
    const payload = await request.json();
    const line = await addOpportunityProduct(context.organizationId, id, payload);
    return NextResponse.json({ product: JSON.parse(JSON.stringify(line)) }, { status: 201 });
  } catch (error) {
    return (
      authorizationErrorResponse(error) ??
      opportunityProductErrorResponse(error) ??
      NextResponse.json({ error: "Unable to assign the Product." }, { status: 500 })
    );
  }
}
