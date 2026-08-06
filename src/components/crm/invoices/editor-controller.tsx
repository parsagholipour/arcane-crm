"use client";

import { useMemo, useState } from "react";
import { type ScopedCrmData, type RecordData } from "@/lib/crm-types";
import { ApiError, apiRequest, jsonBody } from "@/lib/api/client";
import {
  requiredId,
  text,
  dateInput,
  todayInput,
  addDays,
  type InvoiceMutationResult,
  type InvoiceToast
} from "@/components/crm/invoices/primitives";

export type InvoiceLineDraft = {
  key: string;
  productId: string;
  productLabel: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discountAmount: string;
  taxRate: string;
};
export const currencies = ["USD", "AED", "EUR", "GBP", "CAD", "AUD"];
export function linePreview(line: InvoiceLineDraft) {
  const quantity = Math.max(0, Number(line.quantity) || 0);
  const unitPrice = Math.max(0, Number(line.unitPrice) || 0);
  const subtotal = Math.round(quantity * unitPrice * 100) / 100;
  const discount = Math.max(0, Number(line.discountAmount) || 0);
  const taxable = Math.max(0, subtotal - discount);
  const tax = Math.round(taxable * Math.max(0, Number(line.taxRate) || 0)) / 100;
  return { subtotal, discount, tax, total: Math.round((taxable + tax) * 100) / 100 };
}
export function emptyLine(index = 0): InvoiceLineDraft {
  return {
    key: `line-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
    productId: "",
    productLabel: "",
    description: "",
    quantity: "1",
    unitPrice: "0.00",
    discountAmount: "0.00",
    taxRate: "0"
  };
}
export function invoiceLines(invoice?: RecordData) {
  const lines = Array.isArray(invoice?.lineItems)
    ? invoice.lineItems.filter(
        (item): item is RecordData => Boolean(item) && typeof item === "object" && !Array.isArray(item)
      )
    : [];
  return lines.map((line, index) => ({
    key: requiredId(line) || `line-existing-${index}`,
    productId: text(line.productId),
    productLabel: text((line.product as RecordData | undefined)?.name),
    description: text(line.description),
    quantity: text(line.quantity || "1"),
    unitPrice: Number(line.unitPrice ?? 0).toFixed(2),
    discountAmount: Number(line.discountAmount ?? 0).toFixed(2),
    taxRate: text(line.taxRate ?? "0")
  }));
}
export function initialHeader(invoice?: RecordData) {
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
export function useInvoiceEditor({
  mode,
  data,
  invoice,
  onClose,
  onSaved,
  onToast
}: {
  mode: "new" | "edit";
  data: ScopedCrmData;
  invoice?: RecordData;
  onClose: () => void;
  onSaved: (result: InvoiceMutationResult) => void;
  onToast: (toast: InvoiceToast) => void;
}) {
  const [initialValues] = useState(() => ({ header: initialHeader(invoice), lines: invoiceLines(invoice) }));
  const [header, setHeader] = useState(initialValues.header);
  const [lines, setLines] = useState<InvoiceLineDraft[]>(initialValues.lines);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const isDirty = JSON.stringify({ header, lines }) !== JSON.stringify(initialValues);
  const opportunities = data.opportunities.filter(
    (opportunity) => !header.accountId || String(opportunity.accountId) === header.accountId
  );
  const preview = useMemo(
    () =>
      lines.reduce(
        (totals, line) => {
          const current = linePreview(line);
          return {
            subtotal: totals.subtotal + current.subtotal,
            discount: totals.discount + current.discount,
            tax: totals.tax + current.tax,
            total: totals.total + current.total
          };
        },
        { subtotal: 0, discount: 0, tax: 0, total: 0 }
      ),
    [lines]
  );
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
      opportunityId: data.opportunities.some(
        (opportunity) => String(opportunity.id) === current.opportunityId && String(opportunity.accountId) === accountId
      )
        ? current.opportunityId
        : "",
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
    setLines((current) => current.map((line) => (line.key === key ? { ...line, [field]: value } : line)));
    setErrors((current) => ({ ...current, [`${key}.${field}`]: "" }));
  }
  function selectProduct(line: InvoiceLineDraft, productId: string) {
    const product = data.products.find((item) => String(item.id) === productId);
    const entries = data.priceBookEntries.filter(
      (entry) =>
        String(entry.productId) === productId &&
        entry.active !== false &&
        String(entry.currency ?? "USD") === header.currency
    );
    const activeEntries = entries.filter((entry) =>
      data.priceBooks.some((book) => String(book.id) === String(entry.priceBookId) && book.active !== false)
    );
    const standardEntry = activeEntries.find((entry) =>
      data.priceBooks.some((book) => String(book.id) === String(entry.priceBookId) && book.isStandard)
    );
    const price = standardEntry?.listPrice ?? activeEntries[0]?.listPrice;
    setLines((current) =>
      current.map((item) =>
        item.key === line.key
          ? {
              ...item,
              productId,
              productLabel: text(product?.name),
              description: productId ? text(product?.description || product?.name) : item.description,
              unitPrice: price === undefined || price === null ? item.unitPrice : Number(price).toFixed(2)
            }
          : item
      )
    );
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
    if (header.issueDate && header.dueDate && header.dueDate < header.issueDate)
      nextErrors.dueDate = "Due date cannot precede issue date.";
    lines.forEach((line, index) => {
      if (!line.description.trim()) nextErrors[`${line.key}.description`] = `Line ${index + 1} needs a description.`;
      if (!(Number(line.quantity) > 0)) nextErrors[`${line.key}.quantity`] = "Quantity must be greater than zero.";
      if (Number(line.unitPrice) < 0) nextErrors[`${line.key}.unitPrice`] = "Unit price cannot be negative.";
      const calculation = linePreview(line);
      if (Number(line.discountAmount) < 0 || Number(line.discountAmount) > calculation.subtotal)
        nextErrors[`${line.key}.discountAmount`] = "Discount cannot exceed the line subtotal.";
      if (Number(line.taxRate) < 0 || Number(line.taxRate) > 100)
        nextErrors[`${line.key}.taxRate`] = "Tax rate must be between 0 and 100.";
    });
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }
  async function save() {
    if (!validate()) return;
    setSaving(true);
    try {
      const result = await apiRequest<InvoiceMutationResult>(
        mode === "edit" ? `/api/invoices/${requiredId(invoice)}` : "/api/invoices",
        {
          method: mode === "edit" ? "PATCH" : "POST",
          body: jsonBody({
            ...header,
            lineItems: lines.map((line, displayOrder) => ({
              productId: line.productId,
              description: line.description,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              discountAmount: line.discountAmount,
              taxRate: line.taxRate,
              displayOrder
            }))
          })
        }
      );
      onSaved(result);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) {
        setErrors((current) => ({ ...current, ...error.fieldErrors }));
      }
      onToast({
        tone: "error",
        message: error instanceof Error ? error.message : "The invoice could not be saved."
      });
    } finally {
      setSaving(false);
    }
  }

  return {
    mode,
    data,
    invoice,
    onClose,
    header,
    lines,
    setLines,
    errors,
    saving,
    confirmDiscard,
    setConfirmDiscard,
    opportunities,
    preview,
    requestClose,
    updateHeader,
    selectAccount,
    updateLine,
    selectProduct,
    moveLine,
    save
  };
}

export type InvoiceEditorModalModel = ReturnType<typeof useInvoiceEditor>;
export type InvoiceEditorModalProps = Parameters<typeof useInvoiceEditor>[0];
