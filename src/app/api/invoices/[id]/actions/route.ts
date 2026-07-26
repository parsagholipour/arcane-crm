import { NextRequest } from "next/server";
import { deliverInvoiceEmail } from "@/lib/email/invoice-email";
import { performInvoiceAction } from "@/lib/invoices";
import { invoiceErrorResponse, invoiceJson } from "@/lib/invoice-api";
import { requireOrganizationContext } from "@/lib/organization-context";

type Params = Promise<{ id: string }>;

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, route: { params: Params }) {
  try {
    const context = await requireOrganizationContext();
    const { id } = await route.params;
    const payload = (await request.json()) as { action?: unknown; recipientEmail?: unknown };
    const action = String(payload.action ?? "");
    if (action === "send") {
      return invoiceJson(
        await deliverInvoiceEmail({
          organizationId: context.organizationId,
          organizationName: context.organization.name,
          userId: context.userId,
          invoiceId: id,
          recipientEmail: payload.recipientEmail
        })
      );
    }
    return invoiceJson(await performInvoiceAction(context.organizationId, context.userId, id, action));
  } catch (error) {
    return invoiceErrorResponse(error);
  }
}
