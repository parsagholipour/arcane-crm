import { NextRequest, NextResponse } from "next/server";
import { authorizationErrorResponse, requireOrganizationContext } from "@/lib/organization-context";
import { deleteLeadSampleProduct, updateLeadSampleProduct } from "@/lib/lead-sample-products";
import { emitLeadUpdated } from "@/lib/public-api/emit";
import { productLineErrorResponse } from "@/lib/product-line-service";

type Params = Promise<{ id: string; lineId: string }>;

export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  try {
    const context = await requireOrganizationContext();
    const { id, lineId } = await params;
    const payload = await request.json();
    const line = await updateLeadSampleProduct(context.organizationId, id, lineId, payload);
    await emitLeadUpdated(context.organizationId, id);
    return NextResponse.json({ product: JSON.parse(JSON.stringify(line)) });
  } catch (error) {
    return (
      authorizationErrorResponse(error) ??
      productLineErrorResponse(error) ??
      NextResponse.json({ error: "Unable to update the Sample Product." }, { status: 500 })
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Params }) {
  try {
    const context = await requireOrganizationContext();
    const { id, lineId } = await params;
    await deleteLeadSampleProduct(context.organizationId, id, lineId);
    await emitLeadUpdated(context.organizationId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return (
      authorizationErrorResponse(error) ??
      productLineErrorResponse(error) ??
      NextResponse.json({ error: "Unable to remove the Sample Product." }, { status: 500 })
    );
  }
}
