"use client";

import { CalendarDays, Download, Edit3, Printer, Receipt, Send, Trash2, WalletCards } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { type ScopedCrmData, type RecordData } from "@/lib/crm-types";
import { formatDate, formatDateTime } from "@/lib/utils";
import { apiRequest, jsonBody } from "@/lib/api/client";
import {
  type InvoiceMutationResult,
  type InvoiceToast,
  requiredId,
  text,
  todayInput,
  InvoiceStatusBadge,
  InvoiceButton,
  InvoiceCard,
  Detail,
  money,
  TotalRow,
  SimpleDialog
} from "@/components/crm/invoices/primitives";
import { InvoiceSendModal } from "@/components/crm/invoices/send";

export function InvoiceDetailPage({
  initialInvoice,
  data,
  onEdit,
  onChanged,
  onDeleted,
  onOpenPayment,
  onToast
}: {
  initialInvoice: RecordData;
  data: ScopedCrmData;
  onEdit: () => void;
  onChanged: (result: InvoiceMutationResult) => void;
  onDeleted: (id: string) => void;
  onOpenPayment: () => void;
  onToast: (toast: InvoiceToast) => void;
}) {
  const router = useRouter();
  const invoice = data.invoices.find((item) => requiredId(item) === requiredId(initialInvoice)) ?? initialInvoice;
  const [confirm, setConfirm] = useState<null | {
    title: string;
    body: string;
    action: "delete" | "mark-sent" | "mark-overdue" | "void";
  }>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const currency = text(invoice.currency) || "USD";
  const lines = Array.isArray(invoice.lineItems)
    ? invoice.lineItems.filter(
        (item): item is RecordData => Boolean(item) && typeof item === "object" && !Array.isArray(item)
      )
    : [];
  const payments = Array.isArray(invoice.payments)
    ? invoice.payments.filter(
        (item): item is RecordData => Boolean(item) && typeof item === "object" && !Array.isArray(item)
      )
    : [];
  const deliveries = data.emailDeliveries.filter(
    (item) => item.sourceType === "Invoice" && item.sourceId === invoice.id
  ) as Array<RecordData & { lastReason?: string }>;
  const creator = data.users.find((user) => user.id === invoice.createdById);
  const canReceivePayment =
    ["Sent", "Partially Paid", "Overdue"].includes(text(invoice.status)) && Number(invoice.balanceDue) > 0;
  const canMarkOverdue =
    ["Sent", "Partially Paid"].includes(text(invoice.status)) &&
    new Date(text(invoice.dueDate)) < new Date(`${todayInput()}T00:00:00.000Z`);
  const invoiceOpportunity = data.opportunities.find((opportunity) => opportunity.id === invoice.opportunityId);
  const opportunityContact = data.contacts.find(
    (contact) => contact.id === invoiceOpportunity?.contactId && text(contact.email)
  );
  const accountContact = data.contacts.find(
    (contact) => contact.accountId === invoice.accountId && text(contact.email)
  );
  const defaultRecipient = text(opportunityContact?.email || accountContact?.email);

  useEffect(() => {
    let active = true;
    void apiRequest<InvoiceMutationResult>(`/api/invoices/${requiredId(initialInvoice)}`)
      .then((result) => {
        if (active && result.invoice) onChanged({ invoice: result.invoice });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialInvoice.id]);

  async function runConfirmedAction() {
    if (!confirm) return;
    setWorking(true);
    if (confirm.action === "delete") {
      try {
        await apiRequest<RecordData>(`/api/invoices/${requiredId(invoice)}`, {
          method: "DELETE"
        });
        onDeleted(requiredId(invoice));
        onToast({ tone: "success", message: `${text(invoice.invoiceNumber)} deleted.` });
        router.push("/lightning/o/Invoice/list");
      } catch (error) {
        onToast({
          tone: "error",
          message: error instanceof Error ? error.message : "The invoice could not be deleted."
        });
      } finally {
        setWorking(false);
      }
      return;
    }
    try {
      const result = await apiRequest<InvoiceMutationResult>(`/api/invoices/${requiredId(invoice)}/actions`, {
        method: "POST",
        body: jsonBody({ action: confirm.action })
      });
      onChanged(result);
      onToast({
        tone: "success",
        message:
          confirm.action === "void"
            ? "Invoice voided."
            : confirm.action === "mark-sent"
              ? "Invoice marked as Sent."
              : "Invoice marked Overdue."
      });
    } catch (error) {
      onToast({
        tone: "error",
        message: error instanceof Error ? error.message : "The invoice action could not be completed."
      });
    } finally {
      setWorking(false);
      setConfirm(null);
    }
  }

  return (
    <section className="space-y-3" aria-label="Invoice detail">
      <div className="rounded-lg border border-[#e4e7ec] bg-white shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded bg-[#9c5bff] text-white">
              <Receipt size={23} />
            </div>
            <div>
              <div className="text-xs text-[#706e6b]">Invoice</div>
              <h1 className="text-2xl font-semibold">{text(invoice.invoiceNumber)}</h1>
              <div className="mt-1">
                <InvoiceStatusBadge status={text(invoice.status)} />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {invoice.status === "Draft" && (
              <InvoiceButton onClick={onEdit}>
                <Edit3 size={14} /> Edit Draft
              </InvoiceButton>
            )}
            {invoice.status === "Draft" && (
              <InvoiceButton
                tone="danger"
                onClick={() =>
                  setConfirm({
                    title: "Delete draft invoice?",
                    body: `${text(invoice.invoiceNumber)} and its line items will be permanently deleted.`,
                    action: "delete"
                  })
                }
              >
                <Trash2 size={14} /> Delete Draft
              </InvoiceButton>
            )}
            {invoice.status === "Draft" && (
              <InvoiceButton
                tone="primary"
                onClick={() =>
                  setConfirm({
                    title: "Mark invoice as Sent?",
                    body: "Use this after the invoice has been delivered outside the CRM. This records the lifecycle change but does not send email or process money.",
                    action: "mark-sent"
                  })
                }
              >
                <Send size={14} /> Mark as Sent
              </InvoiceButton>
            )}
            {invoice.status === "Draft" && data.emailDeliveryConfigured && (
              <InvoiceButton onClick={() => setSendOpen(true)}>
                <Send size={14} /> Email Invoice
              </InvoiceButton>
            )}
            {canReceivePayment && (
              <InvoiceButton tone="primary" onClick={onOpenPayment}>
                <WalletCards size={14} /> Record Payment
              </InvoiceButton>
            )}
            {canMarkOverdue && (
              <InvoiceButton
                onClick={() =>
                  setConfirm({
                    title: "Mark invoice Overdue?",
                    body: "This invoice is past its due date and will be shown as Overdue.",
                    action: "mark-overdue"
                  })
                }
              >
                <CalendarDays size={14} /> Mark Overdue
              </InvoiceButton>
            )}
            {["Sent", "Partially Paid", "Overdue"].includes(text(invoice.status)) &&
              Number(invoice.amountPaid) === 0 && (
                <InvoiceButton
                  tone="danger"
                  onClick={() =>
                    setConfirm({
                      title: "Void invoice?",
                      body: "Voiding is irreversible. Invoices with payments cannot be voided.",
                      action: "void"
                    })
                  }
                >
                  Void
                </InvoiceButton>
              )}
            <InvoiceButton
              onClick={() =>
                window.open(`/api/invoices/${requiredId(invoice)}/pdf?inline=1`, "_blank", "noopener,noreferrer")
              }
            >
              <Printer size={14} /> Print
            </InvoiceButton>
            <a
              href={`/api/invoices/${requiredId(invoice)}/pdf`}
              className="inline-flex min-h-8 items-center gap-1.5 rounded border border-[#c9c9c9] bg-white px-3 py-1.5 text-xs font-semibold hover:bg-[#f3f3f3]"
            >
              <Download size={14} /> Download PDF
            </a>
          </div>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <div className="space-y-3">
          <InvoiceCard title="Invoice Details">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Detail
                label="Account"
                value={invoice.accountName || (invoice.account as RecordData | undefined)?.name}
                href={invoice.accountId ? `/lightning/r/Account/${text(invoice.accountId)}/view` : undefined}
              />
              <Detail
                label="Opportunity"
                value={invoice.opportunityName || (invoice.opportunity as RecordData | undefined)?.name || "-"}
                href={
                  invoice.opportunityId ? `/lightning/r/Opportunity/${text(invoice.opportunityId)}/view` : undefined
                }
              />
              <Detail label="Issue Date" value={formatDate(text(invoice.issueDate))} />
              <Detail label="Due Date" value={formatDate(text(invoice.dueDate))} />
              <Detail label="Currency" value={currency} />
              <Detail label="Purchase Order" value={invoice.purchaseOrderNumber || "-"} />
              <div className="md:col-span-2">
                <Detail
                  label="Billing Details"
                  value={[
                    invoice.billingName,
                    invoice.billingStreet,
                    [invoice.billingCity, invoice.billingState, invoice.billingPostalCode].filter(Boolean).join(" "),
                    invoice.billingCountry
                  ]
                    .filter(Boolean)
                    .join(", ")}
                />
              </div>
            </div>
          </InvoiceCard>
          <InvoiceCard title={`Line Items (${lines.length})`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-[#f3f3f3] text-xs text-[#514f4d]">
                  <tr>
                    <th className="px-3 py-2 text-left">Description</th>
                    <th className="px-3 py-2 text-right">Quantity</th>
                    <th className="px-3 py-2 text-right">Unit Price</th>
                    <th className="px-3 py-2 text-right">Discount</th>
                    <th className="px-3 py-2 text-right">Tax</th>
                    <th className="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={requiredId(line)} className="border-t border-[#e5e5e5]">
                      <td className="px-3 py-3">
                        <div>{text(line.description)}</div>
                        {Boolean(line.productId) && (
                          <div className="mt-0.5 text-xs text-[#706e6b]">
                            {text((line.product as RecordData | undefined)?.name || "Product")}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">{text(line.quantity)}</td>
                      <td className="px-3 py-3 text-right">{money(line.unitPrice, currency)}</td>
                      <td className="px-3 py-3 text-right">{money(line.discountAmount, currency)}</td>
                      <td className="px-3 py-3 text-right">
                        {money(line.taxAmount, currency)}{" "}
                        <span className="text-xs text-[#706e6b]">({text(line.taxRate)}%)</span>
                      </td>
                      <td className="px-3 py-3 text-right font-semibold">{money(line.lineTotal, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!lines.length && (
                <div className="p-6 text-center text-sm text-[#706e6b]">
                  No line items have been added to this draft.
                </div>
              )}
            </div>
          </InvoiceCard>
          <InvoiceCard title="Notes and Terms">
            <div className="grid gap-6 md:grid-cols-2">
              <Detail label="Notes" value={invoice.notes || "-"} multiline />
              <Detail label="Payment Terms" value={invoice.terms || "-"} multiline />
            </div>
          </InvoiceCard>
          <InvoiceCard title={`Payment History (${payments.length})`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead className="bg-[#f3f3f3] text-xs text-[#514f4d]">
                  <tr>
                    <th className="px-3 py-2 text-left">Payment Date</th>
                    <th className="px-3 py-2 text-left">Method</th>
                    <th className="px-3 py-2 text-left">Reference</th>
                    <th className="px-3 py-2 text-left">Recorded By</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={requiredId(payment)} className="border-t border-[#e5e5e5]">
                      <td className="px-3 py-3">{formatDate(text(payment.paymentDate))}</td>
                      <td className="px-3 py-3">{text(payment.paymentMethod)}</td>
                      <td className="px-3 py-3">{text(payment.referenceNumber) || "-"}</td>
                      <td className="px-3 py-3">
                        {data.users.find((user) => user.id === payment.recordedById)?.name ??
                          text(payment.recordedById)}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold">{money(payment.amount, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!payments.length && (
                <div className="p-6 text-center text-sm text-[#706e6b]">
                  No externally received payments have been recorded.
                </div>
              )}
            </div>
          </InvoiceCard>
        </div>
        <div className="space-y-3">
          <InvoiceCard title="Totals">
            <div className="space-y-3">
              <TotalRow label="Subtotal" value={money(invoice.subtotal, currency)} />
              <TotalRow label="Discounts" value={`-${money(invoice.discountTotal, currency)}`} />
              <TotalRow label="Tax" value={money(invoice.taxTotal, currency)} />
              <TotalRow label="Total" value={money(invoice.total, currency)} strong />
              <TotalRow label="Amount Paid" value={money(invoice.amountPaid, currency)} />
              <div className="rounded-lg bg-[#032d60] p-4 text-white">
                <TotalRow label="Balance Due" value={money(invoice.balanceDue, currency)} strong />
              </div>
            </div>
          </InvoiceCard>
          <InvoiceCard title={`Email Delivery (${deliveries.length})`}>
            <div className="space-y-3">
              {deliveries.map((delivery) => (
                <div key={requiredId(delivery)} className="border-b border-[#eef1f6] pb-3 text-sm last:border-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold">{text(delivery.recipient)}</span>
                    <span className="rounded-full bg-[#f3f3f3] px-2 py-1 text-xs font-semibold">
                      {text(delivery.status)}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-[#706e6b]">
                    {formatDateTime(text(delivery.lastEventAt || delivery.acceptedAt))}
                  </div>
                  {delivery.lastReason && (
                    <div className="mt-1 text-xs text-[#8e030f]">{text(delivery.lastReason)}</div>
                  )}
                </div>
              ))}
              {!deliveries.length && (
                <div className="text-sm text-[#706e6b]">
                  No provider email delivery has been attempted. Use Mark as Sent when delivery happened outside the
                  CRM.
                </div>
              )}
            </div>
          </InvoiceCard>
          <InvoiceCard title="Record Information">
            <div className="space-y-4">
              <Detail label="Created By" value={creator?.name ?? text(invoice.createdById)} />
              <Detail label="Created" value={formatDateTime(text(invoice.createdAt))} />
              <Detail label="Last Modified" value={formatDateTime(text(invoice.updatedAt))} />
              {Boolean(invoice.sentAt) && <Detail label="Marked Sent" value={formatDateTime(text(invoice.sentAt))} />}
              {Boolean(invoice.paidAt) && <Detail label="Paid" value={formatDateTime(text(invoice.paidAt))} />}
              {Boolean(invoice.voidedAt) && <Detail label="Voided" value={formatDateTime(text(invoice.voidedAt))} />}
            </div>
          </InvoiceCard>
        </div>
      </div>
      {confirm && (
        <SimpleDialog
          title={confirm.title}
          description={confirm.body}
          onClose={() => setConfirm(null)}
          footer={
            <>
              <InvoiceButton onClick={() => setConfirm(null)}>Cancel</InvoiceButton>
              <InvoiceButton
                tone={confirm.action === "mark-overdue" || confirm.action === "mark-sent" ? "primary" : "danger"}
                disabled={working}
                onClick={() => runConfirmedAction()}
              >
                {working
                  ? "Working..."
                  : confirm.action === "delete"
                    ? "Delete Draft"
                    : confirm.action === "mark-sent"
                      ? "Mark as Sent"
                      : confirm.action === "mark-overdue"
                        ? "Mark Overdue"
                        : "Void Invoice"}
              </InvoiceButton>
            </>
          }
        />
      )}
      {sendOpen && (
        <InvoiceSendModal
          invoice={invoice}
          initialRecipient={defaultRecipient}
          onClose={() => setSendOpen(false)}
          onSent={onChanged}
          onToast={onToast}
        />
      )}
    </section>
  );
}
