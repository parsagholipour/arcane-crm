import { NextRequest } from "next/server";
import { deleteDraftInvoice, getInvoice, updateInvoice } from "@/lib/invoices";
import { invoiceErrorResponse, invoiceJson } from "@/lib/invoice-api";
import { requireOrganizationContext } from "@/lib/organization-context";
import type { RecordData } from "@/lib/crm-types";

type Params = Promise<{ id: string }>;

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, route: { params: Params }) {
  try {
    const context = await requireOrganizationContext();
    const { id } = await route.params;
    return invoiceJson({ invoice: await getInvoice(context.organizationId, context.userId, id) });
  } catch (error) {
    return invoiceErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, route: { params: Params }) {
  try {
    const context = await requireOrganizationContext();
    const { id } = await route.params;
    const payload = (await request.json()) as RecordData;
    return invoiceJson(await updateInvoice(context.organizationId, context.userId, id, payload));
  } catch (error) {
    return invoiceErrorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, route: { params: Params }) {
  try {
    const context = await requireOrganizationContext();
    const { id } = await route.params;
    const invoice = await deleteDraftInvoice(context.organizationId, id);
    return invoiceJson({ ok: true, invoice });
  } catch (error) {
    return invoiceErrorResponse(error);
  }
}
