import { NextRequest } from "next/server";
import { getInvoice } from "@/lib/invoices";
import { invoiceErrorResponse } from "@/lib/invoice-api";
import { generateInvoicePdf } from "@/lib/invoice-pdf";
import { requireOrganizationContext } from "@/lib/organization-context";

type Params = Promise<{ id: string }>;

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, route: { params: Params }) {
  try {
    const context = await requireOrganizationContext();
    const { id } = await route.params;
    const invoice = await getInvoice(context.organizationId, context.userId, id);
    const bytes = await generateInvoicePdf(invoice, context.organization.name);
    const disposition = request.nextUrl.searchParams.get("inline") === "1" ? "inline" : "attachment";
    return new Response(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="${invoice.invoiceNumber}.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    return invoiceErrorResponse(error);
  }
}
