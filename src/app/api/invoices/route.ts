import { NextRequest } from "next/server";
import { createInvoice, listInvoices } from "@/lib/invoices";
import { invoiceErrorResponse, invoiceJson } from "@/lib/invoice-api";
import { requireOrganizationContext } from "@/lib/organization-context";
import type { RecordData } from "@/lib/crm-types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const context = await requireOrganizationContext();
    const invoices = await listInvoices(context.organizationId, context.userId);
    return invoiceJson({ invoices });
  } catch (error) {
    return invoiceErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireOrganizationContext();
    const payload = (await request.json()) as RecordData;
    const result = await createInvoice(context.organizationId, context.userId, payload);
    return invoiceJson(result, { status: 201 });
  } catch (error) {
    return invoiceErrorResponse(error);
  }
}
