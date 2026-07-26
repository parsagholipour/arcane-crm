import { NextRequest } from "next/server";
import { recordInvoicePayment } from "@/lib/invoices";
import { invoiceErrorResponse, invoiceJson } from "@/lib/invoice-api";
import { requireOrganizationContext } from "@/lib/organization-context";
import type { RecordData } from "@/lib/crm-types";

type Params = Promise<{ id: string }>;

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, route: { params: Params }) {
  try {
    const context = await requireOrganizationContext();
    const { id } = await route.params;
    const payload = (await request.json()) as RecordData;
    return invoiceJson(await recordInvoicePayment(context.organizationId, context.userId, id, payload), {
      status: 201
    });
  } catch (error) {
    return invoiceErrorResponse(error);
  }
}
