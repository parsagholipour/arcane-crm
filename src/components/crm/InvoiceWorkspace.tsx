"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ArrowDown, ArrowUp, CalendarDays, Download, Edit3, Plus, Printer, Receipt, Send, Trash2, WalletCards, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { BootstrapData, RecordData } from "@/lib/crm-types";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { AsyncButton } from "@/components/crm/AsyncButton";

export type InvoiceMutationResult = { invoice: RecordData; delivery?: RecordData; notifications?: RecordData[] };
export type InvoiceToast = { tone: "success" | "error" | "warning"; message: string } | null;

type InvoiceLineDraft = {
  key: string;
  productId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discountAmount: string;
  taxRate: string;
};

const controlClass = "min-h-9 w-full rounded border border-[#c9c9c9] bg-white px-2.5 py-1.5 text-sm outline-none transition hover:border-[#8e8e8e] focus:border-[#0176d3] focus:shadow-[0_0_0_3px_rgba(1,118,211,0.16)] disabled:bg-[#f3f3f3]";
const currencies = ["USD", "AED", "EUR", "GBP", "CAD", "AUD"];
const paymentMethods = ["Bank Transfer", "Check", "Cash", "Card (External)", "Other"];

function requiredId(record: RecordData | undefined) {
  return record?.id ? String(record.id) : "";
}

function dateInput(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : date.toISOString().slice(0, 10);
}

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function money(value: unknown, currency = "USD") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency, minimumFractionDigits: 2 }).format(Number(value ?? 0));
}

function linePreview(line: InvoiceLineDraft) {
  const quantity = Math.max(0, Number(line.quantity) || 0);
  const unitPrice = Math.max(0, Number(line.unitPrice) || 0);
  const subtotal = Math.round(quantity * unitPrice * 100) / 100;
  const discount = Math.max(0, Number(line.discountAmount) || 0);
  const taxable = Math.max(0, subtotal - discount);
  const tax = Math.round(taxable * Math.max(0, Number(line.taxRate) || 0)) / 100;
  return { subtotal, discount, tax, total: Math.round((taxable + tax) * 100) / 100 };
}

function emptyLine(index = 0): InvoiceLineDraft {
  return { key: `line-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`, productId: "", description: "", quantity: "1", unitPrice: "0.00", discountAmount: "0.00", taxRate: "0" };
}

function invoiceLines(invoice?: RecordData) {
  const lines = Array.isArray(invoice?.lineItems) ? invoice.lineItems.filter((item): item is RecordData => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
  return lines.map((line, index) => ({
    key: requiredId(line) || `line-existing-${index}`,
    productId: text(line.productId),
    description: text(line.description),
    quantity: text(line.quantity || "1"),
    unitPrice: Number(line.unitPrice ?? 0).toFixed(2),
    discountAmount: Number(line.discountAmount ?? 0).toFixed(2),
    taxRate: text(line.taxRate ?? "0")
  }));
}

function initialHeader(invoice?: RecordData) {
  const issueDate = dateInput(invoice?.issueDate) || todayInput();
  return {
    accountId: text(invoice?.accountId),
    opportunityId: text(invoice?.opportunityId),
    issueDate,
    dueDate: dateInput(invoice?.dueDate) || addDays(issueDate, 30),
    currency: text(invoice?.currency) || "USD",
    purchaseOrderNumber: text(invoice?.purchaseOrderNumber),
    billingName: text(invoice?.billingName),
    billingStreet: text(invoice?.billingStreet),
    billingCity: text(invoice?.billingCity),
    billingState: text(invoice?.billingState),
    billingPostalCode: text(invoice?.billingPostalCode),
    billingCountry: text(invoice?.billingCountry),
    notes: text(invoice?.notes),
    terms: text(invoice?.terms)
  };
}

export function InvoiceEditorModal({ mode, data, invoice, onClose, onSaved, onToast }: { mode: "new" | "edit"; data: BootstrapData; invoice?: RecordData; onClose: () => void; onSaved: (result: InvoiceMutationResult) => void; onToast: (toast: InvoiceToast) => void }) {
  const [initialValues] = useState(() => ({ header: initialHeader(invoice), lines: invoiceLines(invoice) }));
  const [header, setHeader] = useState(initialValues.header);
  const [lines, setLines] = useState<InvoiceLineDraft[]>(initialValues.lines);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const isDirty = JSON.stringify({ header, lines }) !== JSON.stringify(initialValues);
  const opportunities = data.opportunities.filter((opportunity) => !header.accountId || String(opportunity.accountId) === header.accountId);
  const preview = useMemo(() => lines.reduce((totals, line) => {
    const current = linePreview(line);
    return { subtotal: totals.subtotal + current.subtotal, discount: totals.discount + current.discount, tax: totals.tax + current.tax, total: totals.total + current.total };
  }, { subtotal: 0, discount: 0, tax: 0, total: 0 }), [lines]);

  function requestClose() {
    if (isDirty) setConfirmDiscard(true);
    else onClose();
  }

  function updateHeader(name: keyof typeof header, value: string) {
    setHeader((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
  }

  function selectAccount(accountId: string) {
    const account = data.accounts.find((item) => String(item.id) === accountId);
    setHeader((current) => ({
      ...current,
      accountId,
      opportunityId: data.opportunities.some((opportunity) => String(opportunity.id) === current.opportunityId && String(opportunity.accountId) === accountId) ? current.opportunityId : "",
      billingName: text(account?.name),
      billingStreet: text(account?.billingStreet),
      billingCity: text(account?.billingCity),
      billingState: text(account?.billingState),
      billingPostalCode: text(account?.billingPostalCode),
      billingCountry: text(account?.billingCountry)
    }));
    setErrors((current) => ({ ...current, accountId: "" }));
  }

  function updateLine(key: string, field: keyof InvoiceLineDraft, value: string) {
    setLines((current) => current.map((line) => line.key === key ? { ...line, [field]: value } : line));
    setErrors((current) => ({ ...current, [`${key}.${field}`]: "" }));
  }

  function selectProduct(line: InvoiceLineDraft, productId: string) {
    const product = data.products.find((item) => String(item.id) === productId);
    const entries = data.priceBookEntries.filter((entry) => String(entry.productId) === productId && entry.active !== false && String(entry.currency ?? "USD") === header.currency);
    const activeEntries = entries.filter((entry) => data.priceBooks.some((book) => String(book.id) === String(entry.priceBookId) && book.active !== false));
    const standardEntry = activeEntries.find((entry) => data.priceBooks.some((book) => String(book.id) === String(entry.priceBookId) && book.isStandard));
    const price = standardEntry?.listPrice ?? activeEntries[0]?.listPrice;
    setLines((current) => current.map((item) => item.key === line.key ? {
      ...item,
      productId,
      description: productId ? text(product?.description || product?.name) : item.description,
      unitPrice: price === undefined || price === null ? item.unitPrice : Number(price).toFixed(2)
    } : item));
  }

  function moveLine(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= lines.length) return;
    setLines((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function validate() {
    const nextErrors: Record<string, string> = {};
    if (!header.accountId) nextErrors.accountId = "Select an Account.";
    if (!header.issueDate) nextErrors.issueDate = "Enter an issue date.";
    if (!header.dueDate) nextErrors.dueDate = "Enter a due date.";
    if (header.issueDate && header.dueDate && header.dueDate < header.issueDate) nextErrors.dueDate = "Due date cannot precede issue date.";
    lines.forEach((line, index) => {
      if (!line.description.trim()) nextErrors[`${line.key}.description`] = `Line ${index + 1} needs a description.`;
      if (!(Number(line.quantity) > 0)) nextErrors[`${line.key}.quantity`] = "Quantity must be greater than zero.";
      if (Number(line.unitPrice) < 0) nextErrors[`${line.key}.unitPrice`] = "Unit price cannot be negative.";
      const calculation = linePreview(line);
      if (Number(line.discountAmount) < 0 || Number(line.discountAmount) > calculation.subtotal) nextErrors[`${line.key}.discountAmount`] = "Discount cannot exceed the line subtotal.";
      if (Number(line.taxRate) < 0 || Number(line.taxRate) > 100) nextErrors[`${line.key}.taxRate`] = "Tax rate must be between 0 and 100.";
    });
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function save() {
    if (!validate()) return;
    setSaving(true);
    const response = await fetch(mode === "edit" ? `/api/invoices/${requiredId(invoice)}` : "/api/invoices", {
      method: mode === "edit" ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...header,
        lineItems: lines.map((line, displayOrder) => ({ ...line, key: undefined, displayOrder }))
      })
    });
    const result = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      const field = text(result.field);
      if (field) setErrors((current) => ({ ...current, [field]: text(result.error) }));
      onToast({ tone: "error", message: text(result.error) || "The invoice could not be saved." });
      return;
    }
    onSaved(result as InvoiceMutationResult);
  }

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) requestClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-[#080707]/55 backdrop-blur-[1px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[91] flex max-h-[94vh] w-[min(98vw,1180px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-white shadow-modal">
          {confirmDiscard ? (
            <div className="p-6">
              <Dialog.Title className="text-xl font-semibold">Discard changes?</Dialog.Title>
              <Dialog.Description className="mt-2 text-sm text-[#444]">You have unsaved invoice changes. Discard them and close?</Dialog.Description>
              <div className="mt-6 flex justify-end gap-2"><InvoiceButton onClick={() => setConfirmDiscard(false)}>Keep Editing</InvoiceButton><InvoiceButton tone="danger" onClick={onClose}>Discard</InvoiceButton></div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-[#d8dde6] px-5 py-4">
                <div><Dialog.Title className="text-xl font-semibold">{mode === "new" ? "New Invoice" : `Edit ${text(invoice?.invoiceNumber)}`}</Dialog.Title><Dialog.Description className="mt-0.5 text-sm text-[#706e6b]">Create and manage customer sales invoices.</Dialog.Description></div>
                <button aria-label="Close invoice editor" onClick={requestClose} className="rounded p-2 text-[#706e6b] hover:bg-[#f3f3f3]"><X size={18} /></button>
              </div>
              <div className="slds-scrollbar flex-1 overflow-auto p-5">
                <section>
                  <SectionTitle>Invoice information</SectionTitle>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <InvoiceField label="Account" required error={errors.accountId}><select aria-label="Account" className={controlClass} value={header.accountId} onChange={(event) => selectAccount(event.target.value)}><option value="">Select an Account</option>{data.accounts.map((account) => <option key={requiredId(account)} value={requiredId(account)}>{text(account.name)}</option>)}</select></InvoiceField>
                    <InvoiceField label="Opportunity"><select aria-label="Opportunity" className={controlClass} value={header.opportunityId} onChange={(event) => updateHeader("opportunityId", event.target.value)}><option value="">No Opportunity</option>{opportunities.map((opportunity) => <option key={requiredId(opportunity)} value={requiredId(opportunity)}>{text(opportunity.name)}</option>)}</select></InvoiceField>
                    <InvoiceField label="Issue Date" required error={errors.issueDate}><input aria-label="Issue Date" type="date" className={controlClass} value={header.issueDate} onChange={(event) => updateHeader("issueDate", event.target.value)} /></InvoiceField>
                    <InvoiceField label="Due Date" required error={errors.dueDate}><input aria-label="Due Date" type="date" className={controlClass} value={header.dueDate} onChange={(event) => updateHeader("dueDate", event.target.value)} /></InvoiceField>
                    <InvoiceField label="Currency"><select aria-label="Currency" className={controlClass} value={header.currency} onChange={(event) => updateHeader("currency", event.target.value)}>{currencies.map((currency) => <option key={currency}>{currency}</option>)}</select></InvoiceField>
                    <InvoiceField label="Purchase Order Number"><input aria-label="Purchase Order Number" className={controlClass} value={header.purchaseOrderNumber} onChange={(event) => updateHeader("purchaseOrderNumber", event.target.value)} /></InvoiceField>
                    <InvoiceField label="Billing Name"><input aria-label="Billing Name" className={controlClass} value={header.billingName} onChange={(event) => updateHeader("billingName", event.target.value)} /></InvoiceField>
                    <InvoiceField label="Billing Country"><input aria-label="Billing Country" className={controlClass} value={header.billingCountry} onChange={(event) => updateHeader("billingCountry", event.target.value)} /></InvoiceField>
                    <div className="md:col-span-2"><InvoiceField label="Billing Street"><input aria-label="Billing Street" className={controlClass} value={header.billingStreet} onChange={(event) => updateHeader("billingStreet", event.target.value)} /></InvoiceField></div>
                    <InvoiceField label="Billing City"><input aria-label="Billing City" className={controlClass} value={header.billingCity} onChange={(event) => updateHeader("billingCity", event.target.value)} /></InvoiceField>
                    <InvoiceField label="Billing State / Province"><input aria-label="Billing State / Province" className={controlClass} value={header.billingState} onChange={(event) => updateHeader("billingState", event.target.value)} /></InvoiceField>
                    <InvoiceField label="Billing Postal Code"><input aria-label="Billing Postal Code" className={controlClass} value={header.billingPostalCode} onChange={(event) => updateHeader("billingPostalCode", event.target.value)} /></InvoiceField>
                  </div>
                </section>

                <section className="mt-7">
                  <div className="mb-3 flex items-center justify-between"><SectionTitle>Line items</SectionTitle><InvoiceButton onClick={() => setLines((current) => [...current, emptyLine(current.length)])}><Plus size={14} /> Add Line Item</InvoiceButton></div>
                  <div className="overflow-x-auto rounded-lg border border-[#d8dde6]">
                    <table className="min-w-[1040px] w-full text-sm">
                      <thead className="bg-[#f3f3f3] text-xs text-[#514f4d]"><tr><th className="px-2 py-2 text-left">Order</th><th className="px-2 py-2 text-left">Product</th><th className="px-2 py-2 text-left">Description</th><th className="px-2 py-2 text-left">Quantity</th><th className="px-2 py-2 text-left">Unit Price</th><th className="px-2 py-2 text-left">Discount</th><th className="px-2 py-2 text-left">Tax %</th><th className="px-2 py-2 text-right">Line Total</th><th className="px-2 py-2 text-right">Action</th></tr></thead>
                      <tbody>{lines.map((line, index) => <tr key={line.key} className="border-t border-[#e5e5e5] align-top">
                        <td className="px-2 py-2"><div className="flex gap-1"><button aria-label={`Move line ${index + 1} up`} disabled={index === 0} onClick={() => moveLine(index, -1)} className="rounded p-1 hover:bg-[#f3f3f3] disabled:opacity-30"><ArrowUp size={14} /></button><button aria-label={`Move line ${index + 1} down`} disabled={index === lines.length - 1} onClick={() => moveLine(index, 1)} className="rounded p-1 hover:bg-[#f3f3f3] disabled:opacity-30"><ArrowDown size={14} /></button></div></td>
                        <td className="w-44 px-2 py-2"><select aria-label={`Line ${index + 1} Product`} className={controlClass} value={line.productId} onChange={(event) => selectProduct(line, event.target.value)}><option value="">No Product</option>{data.products.filter((product) => product.active !== false).map((product) => <option key={requiredId(product)} value={requiredId(product)}>{text(product.name)}</option>)}</select></td>
                        <td className="min-w-64 px-2 py-2"><textarea aria-label={`Line ${index + 1} Description`} className={cn(controlClass, "min-h-16 resize-y")} value={line.description} onChange={(event) => updateLine(line.key, "description", event.target.value)} />{errors[`${line.key}.description`] && <FieldError>{errors[`${line.key}.description`]}</FieldError>}</td>
                        <td className="w-24 px-2 py-2"><input aria-label={`Line ${index + 1} Quantity`} type="number" min="0.0001" step="0.0001" className={controlClass} value={line.quantity} onChange={(event) => updateLine(line.key, "quantity", event.target.value)} />{errors[`${line.key}.quantity`] && <FieldError>{errors[`${line.key}.quantity`]}</FieldError>}</td>
                        <td className="w-28 px-2 py-2"><input aria-label={`Line ${index + 1} Unit Price`} type="number" min="0" step="0.01" className={controlClass} value={line.unitPrice} onChange={(event) => updateLine(line.key, "unitPrice", event.target.value)} />{errors[`${line.key}.unitPrice`] && <FieldError>{errors[`${line.key}.unitPrice`]}</FieldError>}</td>
                        <td className="w-28 px-2 py-2"><input aria-label={`Line ${index + 1} Discount`} type="number" min="0" step="0.01" className={controlClass} value={line.discountAmount} onChange={(event) => updateLine(line.key, "discountAmount", event.target.value)} />{errors[`${line.key}.discountAmount`] && <FieldError>{errors[`${line.key}.discountAmount`]}</FieldError>}</td>
                        <td className="w-24 px-2 py-2"><input aria-label={`Line ${index + 1} Tax Rate`} type="number" min="0" max="100" step="0.01" className={controlClass} value={line.taxRate} onChange={(event) => updateLine(line.key, "taxRate", event.target.value)} />{errors[`${line.key}.taxRate`] && <FieldError>{errors[`${line.key}.taxRate`]}</FieldError>}</td>
                        <td className="whitespace-nowrap px-2 py-4 text-right font-semibold">{money(linePreview(line).total, header.currency)}</td>
                        <td className="px-2 py-3 text-right"><button aria-label={`Remove line ${index + 1}`} onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))} className="rounded p-2 text-[#ba0517] hover:bg-[#fff1f1]"><Trash2 size={15} /></button></td>
                      </tr>)}</tbody>
                    </table>
                    {lines.length === 0 && <div className="p-6 text-center text-sm text-[#706e6b]">Drafts can be saved without line items. Add at least one valid line item before marking the invoice as Sent.</div>}
                  </div>
                  <div className="mt-4 ml-auto w-full max-w-sm space-y-2 rounded-lg bg-[#f8fafc] p-4 text-sm"><TotalRow label="Subtotal" value={money(preview.subtotal, header.currency)} /><TotalRow label="Discounts" value={`-${money(preview.discount, header.currency)}`} /><TotalRow label="Tax" value={money(preview.tax, header.currency)} /><TotalRow label="Preview Total" value={money(preview.total, header.currency)} strong /><p className="pt-1 text-xs text-[#706e6b]">Preview only. The server recalculates all financial totals.</p></div>
                </section>

                <section className="mt-7 grid gap-4 md:grid-cols-2"><InvoiceField label="Notes"><textarea aria-label="Notes" className={cn(controlClass, "min-h-24")} value={header.notes} onChange={(event) => updateHeader("notes", event.target.value)} /></InvoiceField><InvoiceField label="Payment Terms"><textarea aria-label="Payment Terms" className={cn(controlClass, "min-h-24")} value={header.terms} onChange={(event) => updateHeader("terms", event.target.value)} /></InvoiceField></section>
              </div>
              <div className="flex items-center justify-between border-t border-[#d8dde6] bg-[#f8f8f8] px-5 py-3"><span className="text-xs text-[#706e6b]">Saving creates or updates a Draft. It does not email the customer.</span><div className="flex gap-2"><InvoiceButton onClick={requestClose}>Cancel</InvoiceButton><InvoiceButton tone="primary" disabled={saving} onClick={() => save()}>{saving ? "Saving..." : "Save Draft"}</InvoiceButton></div></div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function InvoicePaymentModal({ invoice, onClose, onSaved, onToast }: { invoice: RecordData; onClose: () => void; onSaved: (result: InvoiceMutationResult) => void; onToast: (toast: InvoiceToast) => void }) {
  const [values, setValues] = useState({ amount: Number(invoice.balanceDue ?? 0).toFixed(2), paymentDate: todayInput(), paymentMethod: "Bank Transfer", referenceNumber: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    const amount = Number(values.amount);
    const balance = Number(invoice.balanceDue ?? 0);
    if (!(amount > 0)) return setError("Payment amount must be greater than zero.");
    if (amount > balance) return setError(`Payment cannot exceed ${money(balance, text(invoice.currency) || "USD")}.`);
    setSaving(true);
    const response = await fetch(`/api/invoices/${requiredId(invoice)}/payments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
    const result = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setError(text(result.error) || "The payment could not be recorded.");
      onToast({ tone: "error", message: text(result.error) || "The payment could not be recorded." });
      return;
    }
    onSaved(result as InvoiceMutationResult);
  }

  return <SimpleDialog title="Record Payment" description="Record an externally received payment. This does not process or transfer money." onClose={onClose} footer={<><InvoiceButton onClick={onClose}>Cancel</InvoiceButton><InvoiceButton tone="primary" disabled={saving} onClick={() => submit()}>{saving ? "Recording..." : "Record Payment"}</InvoiceButton></>}>
    <div className="mb-4 rounded-lg border border-brand-200 bg-brand-50 p-3"><div className="text-xs text-[#706e6b]">Current balance</div><div className="text-xl font-semibold text-[#032d60]">{money(invoice.balanceDue, text(invoice.currency) || "USD")}</div></div>
    <div className="grid gap-4 md:grid-cols-2"><InvoiceField label="Amount" required error={error}><input aria-label="Amount" type="number" min="0.01" step="0.01" max={text(invoice.balanceDue)} className={controlClass} value={values.amount} onChange={(event) => { setError(""); setValues({ ...values, amount: event.target.value }); }} /></InvoiceField><InvoiceField label="Payment Date" required><input aria-label="Payment Date" type="date" className={controlClass} value={values.paymentDate} onChange={(event) => setValues({ ...values, paymentDate: event.target.value })} /></InvoiceField><InvoiceField label="Payment Method" required><select aria-label="Payment Method" className={controlClass} value={values.paymentMethod} onChange={(event) => setValues({ ...values, paymentMethod: event.target.value })}>{paymentMethods.map((method) => <option key={method}>{method}</option>)}</select></InvoiceField><InvoiceField label="Reference Number"><input aria-label="Reference Number" className={controlClass} value={values.referenceNumber} onChange={(event) => setValues({ ...values, referenceNumber: event.target.value })} /></InvoiceField><div className="md:col-span-2"><InvoiceField label="Notes"><textarea aria-label="Payment Notes" className={cn(controlClass, "min-h-20")} value={values.notes} onChange={(event) => setValues({ ...values, notes: event.target.value })} /></InvoiceField></div></div>
  </SimpleDialog>;
}

function InvoiceSendModal({ invoice, initialRecipient, onClose, onSent, onToast }: {
  invoice: RecordData;
  initialRecipient: string;
  onClose: () => void;
  onSent: (result: InvoiceMutationResult) => void;
  onToast: (toast: InvoiceToast) => void;
}) {
  const [recipientEmail, setRecipientEmail] = useState(initialRecipient);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail.trim())) return setError("Enter a valid recipient email address.");
    setWorking(true);
    setError("");
    const response = await fetch(`/api/invoices/${requiredId(invoice)}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send", recipientEmail: recipientEmail.trim() })
    });
    const result = await response.json().catch(() => ({}));
    setWorking(false);
    if (!response.ok) {
      const message = text(result.error) || "The invoice email could not be sent.";
      setError(message);
      onToast({ tone: "error", message });
      return;
    }
    onSent(result as InvoiceMutationResult);
    onToast({ tone: "success", message: `Invoice accepted for delivery to ${recipientEmail.trim()}.` });
    onClose();
  }

  return <SimpleDialog title="Send Invoice" description="The invoice PDF will be attached. The invoice becomes Sent after SendGrid accepts the message." onClose={onClose} footer={<><InvoiceButton onClick={onClose}>Cancel</InvoiceButton><InvoiceButton tone="primary" disabled={working} onClick={() => submit()}><Send size={14} /> {working ? "Sending..." : "Send Invoice"}</InvoiceButton></>}>
    <InvoiceField label="Recipient Email" required error={error}><input aria-label="Invoice recipient email" type="email" autoFocus className={controlClass} value={recipientEmail} onChange={(event) => { setError(""); setRecipientEmail(event.target.value); }} /></InvoiceField>
    <p className="mt-3 text-xs text-[#706e6b]">Sender: the verified SendGrid address configured for this CRM.</p>
  </SimpleDialog>;
}

export function InvoiceDetailPage({ initialInvoice, data, onEdit, onChanged, onDeleted, onOpenPayment, onToast }: { initialInvoice: RecordData; data: BootstrapData; onEdit: () => void; onChanged: (result: InvoiceMutationResult) => void; onDeleted: (id: string) => void; onOpenPayment: () => void; onToast: (toast: InvoiceToast) => void }) {
  const router = useRouter();
  const invoice = data.invoices.find((item) => requiredId(item) === requiredId(initialInvoice)) ?? initialInvoice;
  const [confirm, setConfirm] = useState<null | { title: string; body: string; action: "delete" | "mark-sent" | "mark-overdue" | "void" }>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const currency = text(invoice.currency) || "USD";
  const lines = Array.isArray(invoice.lineItems) ? invoice.lineItems.filter((item): item is RecordData => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
  const payments = Array.isArray(invoice.payments) ? invoice.payments.filter((item): item is RecordData => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
  const deliveries = data.emailDeliveries.filter((item) => item.sourceType === "Invoice" && item.sourceId === invoice.id) as Array<RecordData & { lastReason?: string }>;
  const creator = data.users.find((user) => user.id === invoice.createdById);
  const canReceivePayment = ["Sent", "Partially Paid", "Overdue"].includes(text(invoice.status)) && Number(invoice.balanceDue) > 0;
  const canMarkOverdue = ["Sent", "Partially Paid"].includes(text(invoice.status)) && new Date(text(invoice.dueDate)) < new Date(`${todayInput()}T00:00:00.000Z`);
  const invoiceOpportunity = data.opportunities.find((opportunity) => opportunity.id === invoice.opportunityId);
  const opportunityContact = data.contacts.find((contact) => contact.id === invoiceOpportunity?.contactId && text(contact.email));
  const accountContact = data.contacts.find((contact) => contact.accountId === invoice.accountId && text(contact.email));
  const defaultRecipient = text(opportunityContact?.email || accountContact?.email);

  useEffect(() => {
    let active = true;
    void fetch(`/api/invoices/${requiredId(initialInvoice)}`).then(async (response) => {
      if (!response.ok || !active) return;
      const result = await response.json();
      if (active && result.invoice) onChanged({ invoice: result.invoice });
    }).catch(() => undefined);
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialInvoice.id]);

  async function runConfirmedAction() {
    if (!confirm) return;
    setWorking(true);
    if (confirm.action === "delete") {
      const response = await fetch(`/api/invoices/${requiredId(invoice)}`, { method: "DELETE" });
      const result = await response.json().catch(() => ({}));
      setWorking(false);
      if (!response.ok) return onToast({ tone: "error", message: text(result.error) || "The invoice could not be deleted." });
      onDeleted(requiredId(invoice));
      onToast({ tone: "success", message: `${text(invoice.invoiceNumber)} deleted.` });
      router.push("/lightning/o/Invoice/list");
      return;
    }
    const response = await fetch(`/api/invoices/${requiredId(invoice)}/actions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: confirm.action }) });
    const result = await response.json().catch(() => ({}));
    setWorking(false);
    setConfirm(null);
    if (!response.ok) return onToast({ tone: "error", message: text(result.error) || "The invoice action could not be completed." });
    onChanged(result as InvoiceMutationResult);
    onToast({ tone: "success", message: confirm.action === "void" ? "Invoice voided." : confirm.action === "mark-sent" ? "Invoice marked as Sent." : "Invoice marked Overdue." });
  }

  return <section className="space-y-3" aria-label="Invoice detail">
    <div className="rounded-lg border border-[#e4e7ec] bg-white shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-4 p-4">
        <div className="flex items-start gap-3"><div className="flex h-11 w-11 items-center justify-center rounded bg-[#9c5bff] text-white"><Receipt size={23} /></div><div><div className="text-xs text-[#706e6b]">Invoice</div><h1 className="text-2xl font-semibold">{text(invoice.invoiceNumber)}</h1><div className="mt-1"><InvoiceStatusBadge status={text(invoice.status)} /></div></div></div>
        <div className="flex flex-wrap justify-end gap-2">
          {invoice.status === "Draft" && <InvoiceButton onClick={onEdit}><Edit3 size={14} /> Edit Draft</InvoiceButton>}
          {invoice.status === "Draft" && <InvoiceButton tone="danger" onClick={() => setConfirm({ title: "Delete draft invoice?", body: `${text(invoice.invoiceNumber)} and its line items will be permanently deleted.`, action: "delete" })}><Trash2 size={14} /> Delete Draft</InvoiceButton>}
          {invoice.status === "Draft" && <InvoiceButton tone="primary" onClick={() => setConfirm({ title: "Mark invoice as Sent?", body: "Use this after the invoice has been delivered outside the CRM. This records the lifecycle change but does not send email or process money.", action: "mark-sent" })}><Send size={14} /> Mark as Sent</InvoiceButton>}
          {invoice.status === "Draft" && data.emailDeliveryConfigured && <InvoiceButton onClick={() => setSendOpen(true)}><Send size={14} /> Email Invoice</InvoiceButton>}
          {canReceivePayment && <InvoiceButton tone="primary" onClick={onOpenPayment}><WalletCards size={14} /> Record Payment</InvoiceButton>}
          {canMarkOverdue && <InvoiceButton onClick={() => setConfirm({ title: "Mark invoice Overdue?", body: "This invoice is past its due date and will be shown as Overdue.", action: "mark-overdue" })}><CalendarDays size={14} /> Mark Overdue</InvoiceButton>}
          {["Sent", "Partially Paid", "Overdue"].includes(text(invoice.status)) && Number(invoice.amountPaid) === 0 && <InvoiceButton tone="danger" onClick={() => setConfirm({ title: "Void invoice?", body: "Voiding is irreversible. Invoices with payments cannot be voided.", action: "void" })}>Void</InvoiceButton>}
          <InvoiceButton onClick={() => window.open(`/api/invoices/${requiredId(invoice)}/pdf?inline=1`, "_blank", "noopener,noreferrer")}><Printer size={14} /> Print</InvoiceButton>
          <a href={`/api/invoices/${requiredId(invoice)}/pdf`} className="inline-flex min-h-8 items-center gap-1.5 rounded border border-[#c9c9c9] bg-white px-3 py-1.5 text-xs font-semibold hover:bg-[#f3f3f3]"><Download size={14} /> Download PDF</a>
        </div>
      </div>
    </div>

    <div className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
      <div className="space-y-3">
        <InvoiceCard title="Invoice Details"><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"><Detail label="Account" value={invoice.accountName || (invoice.account as RecordData | undefined)?.name} href={invoice.accountId ? `/lightning/r/Account/${text(invoice.accountId)}/view` : undefined} /><Detail label="Opportunity" value={invoice.opportunityName || (invoice.opportunity as RecordData | undefined)?.name || "-"} href={invoice.opportunityId ? `/lightning/r/Opportunity/${text(invoice.opportunityId)}/view` : undefined} /><Detail label="Issue Date" value={formatDate(text(invoice.issueDate))} /><Detail label="Due Date" value={formatDate(text(invoice.dueDate))} /><Detail label="Currency" value={currency} /><Detail label="Purchase Order" value={invoice.purchaseOrderNumber || "-"} /><div className="md:col-span-2"><Detail label="Billing Details" value={[invoice.billingName, invoice.billingStreet, [invoice.billingCity, invoice.billingState, invoice.billingPostalCode].filter(Boolean).join(" "), invoice.billingCountry].filter(Boolean).join(", ")} /></div></div></InvoiceCard>
        <InvoiceCard title={`Line Items (${lines.length})`}><div className="overflow-x-auto"><table className="min-w-[760px] w-full text-sm"><thead className="bg-[#f3f3f3] text-xs text-[#514f4d]"><tr><th className="px-3 py-2 text-left">Description</th><th className="px-3 py-2 text-right">Quantity</th><th className="px-3 py-2 text-right">Unit Price</th><th className="px-3 py-2 text-right">Discount</th><th className="px-3 py-2 text-right">Tax</th><th className="px-3 py-2 text-right">Total</th></tr></thead><tbody>{lines.map((line) => <tr key={requiredId(line)} className="border-t border-[#e5e5e5]"><td className="px-3 py-3"><div>{text(line.description)}</div>{Boolean(line.productId) && <div className="mt-0.5 text-xs text-[#706e6b]">{text((line.product as RecordData | undefined)?.name || "Product")}</div>}</td><td className="px-3 py-3 text-right">{text(line.quantity)}</td><td className="px-3 py-3 text-right">{money(line.unitPrice, currency)}</td><td className="px-3 py-3 text-right">{money(line.discountAmount, currency)}</td><td className="px-3 py-3 text-right">{money(line.taxAmount, currency)} <span className="text-xs text-[#706e6b]">({text(line.taxRate)}%)</span></td><td className="px-3 py-3 text-right font-semibold">{money(line.lineTotal, currency)}</td></tr>)}</tbody></table>{!lines.length && <div className="p-6 text-center text-sm text-[#706e6b]">No line items have been added to this draft.</div>}</div></InvoiceCard>
        <InvoiceCard title="Notes and Terms"><div className="grid gap-6 md:grid-cols-2"><Detail label="Notes" value={invoice.notes || "-"} multiline /><Detail label="Payment Terms" value={invoice.terms || "-"} multiline /></div></InvoiceCard>
        <InvoiceCard title={`Payment History (${payments.length})`}><div className="overflow-x-auto"><table className="min-w-[680px] w-full text-sm"><thead className="bg-[#f3f3f3] text-xs text-[#514f4d]"><tr><th className="px-3 py-2 text-left">Payment Date</th><th className="px-3 py-2 text-left">Method</th><th className="px-3 py-2 text-left">Reference</th><th className="px-3 py-2 text-left">Recorded By</th><th className="px-3 py-2 text-right">Amount</th></tr></thead><tbody>{payments.map((payment) => <tr key={requiredId(payment)} className="border-t border-[#e5e5e5]"><td className="px-3 py-3">{formatDate(text(payment.paymentDate))}</td><td className="px-3 py-3">{text(payment.paymentMethod)}</td><td className="px-3 py-3">{text(payment.referenceNumber) || "-"}</td><td className="px-3 py-3">{data.users.find((user) => user.id === payment.recordedById)?.name ?? text(payment.recordedById)}</td><td className="px-3 py-3 text-right font-semibold">{money(payment.amount, currency)}</td></tr>)}</tbody></table>{!payments.length && <div className="p-6 text-center text-sm text-[#706e6b]">No externally received payments have been recorded.</div>}</div></InvoiceCard>
      </div>
      <div className="space-y-3"><InvoiceCard title="Totals"><div className="space-y-3"><TotalRow label="Subtotal" value={money(invoice.subtotal, currency)} /><TotalRow label="Discounts" value={`-${money(invoice.discountTotal, currency)}`} /><TotalRow label="Tax" value={money(invoice.taxTotal, currency)} /><TotalRow label="Total" value={money(invoice.total, currency)} strong /><TotalRow label="Amount Paid" value={money(invoice.amountPaid, currency)} /><div className="rounded-lg bg-[#032d60] p-4 text-white"><TotalRow label="Balance Due" value={money(invoice.balanceDue, currency)} strong /></div></div></InvoiceCard><InvoiceCard title={`Email Delivery (${deliveries.length})`}><div className="space-y-3">{deliveries.map((delivery) => <div key={requiredId(delivery)} className="border-b border-[#eef1f6] pb-3 text-sm last:border-0"><div className="flex items-center justify-between gap-2"><span className="truncate font-semibold">{text(delivery.recipient)}</span><span className="rounded-full bg-[#f3f3f3] px-2 py-1 text-xs font-semibold">{text(delivery.status)}</span></div><div className="mt-1 text-xs text-[#706e6b]">{formatDateTime(text(delivery.lastEventAt || delivery.acceptedAt))}</div>{delivery.lastReason && <div className="mt-1 text-xs text-[#8e030f]">{text(delivery.lastReason)}</div>}</div>)}{!deliveries.length && <div className="text-sm text-[#706e6b]">No provider email delivery has been attempted. Use Mark as Sent when delivery happened outside the CRM.</div>}</div></InvoiceCard><InvoiceCard title="Record Information"><div className="space-y-4"><Detail label="Created By" value={creator?.name ?? text(invoice.createdById)} /><Detail label="Created" value={formatDateTime(text(invoice.createdAt))} /><Detail label="Last Modified" value={formatDateTime(text(invoice.updatedAt))} />{Boolean(invoice.sentAt) && <Detail label="Marked Sent" value={formatDateTime(text(invoice.sentAt))} />}{Boolean(invoice.paidAt) && <Detail label="Paid" value={formatDateTime(text(invoice.paidAt))} />}{Boolean(invoice.voidedAt) && <Detail label="Voided" value={formatDateTime(text(invoice.voidedAt))} />}</div></InvoiceCard></div>
    </div>
    {confirm && <SimpleDialog title={confirm.title} description={confirm.body} onClose={() => setConfirm(null)} footer={<><InvoiceButton onClick={() => setConfirm(null)}>Cancel</InvoiceButton><InvoiceButton tone={confirm.action === "mark-overdue" || confirm.action === "mark-sent" ? "primary" : "danger"} disabled={working} onClick={() => runConfirmedAction()}>{working ? "Working..." : confirm.action === "delete" ? "Delete Draft" : confirm.action === "mark-sent" ? "Mark as Sent" : confirm.action === "mark-overdue" ? "Mark Overdue" : "Void Invoice"}</InvoiceButton></>} />}
    {sendOpen && <InvoiceSendModal invoice={invoice} initialRecipient={defaultRecipient} onClose={() => setSendOpen(false)} onSent={onChanged} onToast={onToast} />}
  </section>;
}

export function InvoiceStatusBadge({ status }: { status: string }) {
  const style = status === "Paid" ? "bg-[#e8f5e9] text-[#1b5e20] border-[#a5d6a7]" : status === "Overdue" ? "bg-[#fff1f1] text-[#8e030f] border-[#f1aeb5]" : status === "Void" ? "bg-[#ecebea] text-[#444] border-[#c9c7c5]" : status === "Sent" ? "bg-[#eaf5fe] text-[#014486] border-[#90c9f4]" : status === "Partially Paid" ? "bg-[#fff7d6] text-[#5f4b00] border-[#e5c349]" : "bg-[#f3f3f3] text-[#444] border-[#d8dde6]";
  return <span role="status" aria-label={`Invoice status: ${status}`} className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold", style)}>{status}</span>;
}

function SimpleDialog({ title, description, children, footer, onClose }: { title: string; description?: string; children?: ReactNode; footer: ReactNode; onClose: () => void }) {
  return <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-[100] bg-[#080707]/55" /><Dialog.Content className="fixed left-1/2 top-1/2 z-[101] max-h-[90vh] w-[min(94vw,620px)] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-xl bg-white shadow-modal"><div className="flex items-start justify-between border-b border-[#d8dde6] p-4"><div><Dialog.Title className="text-xl font-semibold">{title}</Dialog.Title>{description && <Dialog.Description className="mt-1 text-sm text-[#706e6b]">{description}</Dialog.Description>}</div><button aria-label="Close" onClick={onClose} className="rounded p-1 hover:bg-[#f3f3f3]"><X size={18} /></button></div>{children && <div className="p-4">{children}</div>}<div className="flex justify-end gap-2 border-t border-[#d8dde6] bg-[#f8f8f8] p-3">{footer}</div></Dialog.Content></Dialog.Portal></Dialog.Root>;
}

function InvoiceButton({ children, onClick, tone = "secondary", disabled = false }: { children: ReactNode; onClick: () => unknown; tone?: "primary" | "secondary" | "danger"; disabled?: boolean }) {
  return <AsyncButton disabled={disabled} onClick={onClick} className={cn("inline-flex min-h-8 items-center justify-center gap-1.5 rounded border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50", tone === "primary" ? "border-[#0176d3] bg-[#0176d3] text-white hover:bg-[#014486]" : tone === "danger" ? "border-[#ba0517] bg-white text-[#ba0517] hover:bg-[#fff1f1]" : "border-[#c9c9c9] bg-white text-[#181818] hover:bg-[#f3f3f3]")}>{children}</AsyncButton>;
}

function InvoiceField({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: ReactNode }) {
  return <label className="block text-sm"><span className="mb-1 block text-xs text-[#444]">{required && <span className="text-[#ba0517]">* </span>}{label}</span>{children}{error && <FieldError>{error}</FieldError>}</label>;
}

function FieldError({ children }: { children: ReactNode }) {
  return <span className="mt-1 block text-xs text-[#ba0517]">{children}</span>;
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 border-b border-[#d8dde6] pb-2 text-base font-semibold">{children}</h2>;
}

function InvoiceCard({ title, children }: { title: string; children: ReactNode }) {
  return <section className="overflow-hidden rounded-lg border border-[#e4e7ec] bg-white shadow-card"><h2 className="border-b border-[#d8dde6] px-4 py-3 font-semibold">{title}</h2><div className="p-4">{children}</div></section>;
}

function Detail({ label, value, href, multiline = false }: { label: string; value: unknown; href?: string; multiline?: boolean }) {
  const content = text(value) || "-";
  return <div><div className="mb-1 text-xs text-[#706e6b]">{label}</div>{href ? <Link href={href} className="text-sm text-brand-700 hover:underline">{content}</Link> : <div className={cn("text-sm", multiline && "whitespace-pre-wrap")}>{content}</div>}</div>;
}

function TotalRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className={cn("flex items-center justify-between gap-4", strong && "text-base font-semibold")}><span>{label}</span><span>{value}</span></div>;
}
