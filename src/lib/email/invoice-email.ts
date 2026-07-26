import "server-only";

import { prisma } from "@/lib/prisma";
import { generateInvoicePdf } from "@/lib/invoice-pdf";
import { invoiceInclude, InvoiceDomainError, markInvoiceSentAfterDelivery } from "@/lib/invoices";
import { EmailValidationError } from "@/lib/email/errors";
import { invoiceEmailTemplate } from "@/lib/email/templates";
import { isValidEmail } from "@/lib/email/service";
import { sendTrackedEmail } from "@/lib/email/tracking";
import type { EmailAdapter } from "@/lib/email/types";

export async function deliverInvoiceEmail(
  input: {
    organizationId: string;
    organizationName: string;
    userId: string;
    invoiceId: string;
    recipientEmail: unknown;
  },
  dependencies: { adapter?: EmailAdapter; senderEmail?: string } = {}
) {
  const recipientEmail = String(input.recipientEmail ?? "").trim();
  if (!isValidEmail(recipientEmail)) throw new EmailValidationError("Enter a valid invoice recipient email address.");
  const invoice = await prisma.invoice.findFirst({
    where: { id: input.invoiceId, organizationId: input.organizationId },
    include: invoiceInclude
  });
  if (!invoice) throw new InvoiceDomainError("Invoice not found.", 404);
  if (invoice.status !== "Draft") throw new InvoiceDomainError("Only a Draft invoice can be sent.", 409);
  if (!invoice.lineItems.length)
    throw new InvoiceDomainError("Add at least one valid line item before sending the invoice.", 400, "lineItems");

  const sentDocument = { ...invoice, status: "Sent" };
  const pdf = await generateInvoicePdf(sentDocument, input.organizationName);
  const template = invoiceEmailTemplate(invoice, input.organizationName);
  const delivery = await sendTrackedEmail(
    {
      fromName: input.organizationName,
      to: [{ email: recipientEmail, name: invoice.billingName }],
      subject: template.subject,
      text: template.text,
      html: template.html,
      attachments: [{ filename: `${invoice.invoiceNumber}.pdf`, content: pdf, contentType: "application/pdf" }]
    },
    { organizationId: input.organizationId, userId: input.userId, sourceType: "Invoice", sourceId: input.invoiceId },
    dependencies
  );
  const result = await markInvoiceSentAfterDelivery(
    input.organizationId,
    input.userId,
    input.invoiceId,
    recipientEmail
  );
  return { ...result, delivery };
}
