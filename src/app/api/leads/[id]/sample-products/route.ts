import { NextRequest, NextResponse } from "next/server";
import { authorizationErrorResponse, requireOrganizationContext } from "@/lib/organization-context";
import { addLeadSampleProduct, listLeadSampleProducts } from "@/lib/lead-sample-products";
import { productLineErrorResponse } from "@/lib/product-line-service";

type Params = Promise<{ id: string }>;

export async function GET(_request: NextRequest, { params }: { params: Params }) {
  try {
    const context = await requireOrganizationContext();
    const { id } = await params;
    const lines = await listLeadSampleProducts(context.organizationId, id);
    return NextResponse.json({ products: JSON.parse(JSON.stringify(lines)) });
  } catch (error) {
    return (
      authorizationErrorResponse(error) ??
      productLineErrorResponse(error) ??
      NextResponse.json({ error: "Unable to load Sample Products." }, { status: 500 })
    );
  }
}

export async function POST(request: NextRequest, { params }: { params: Params }) {
  try {
    const context = await requireOrganizationContext();
    const { id } = await params;
    const payload = await request.json();
    const line = await addLeadSampleProduct(context.organizationId, id, payload);
    return NextResponse.json({ product: JSON.parse(JSON.stringify(line)) }, { status: 201 });
  } catch (error) {
    return (
      authorizationErrorResponse(error) ??
      productLineErrorResponse(error) ??
      NextResponse.json({ error: "Unable to add the Sample Product." }, { status: 500 })
    );
  }
}
