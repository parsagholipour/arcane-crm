"use client";

import { useState } from "react";
import { type RecordData } from "@/lib/crm-types";
import { cn } from "@/lib/utils";
import { apiRequest, jsonBody } from "@/lib/api/client";
import {
  type InvoiceMutationResult,
  type InvoiceToast,
  todayInput,
  money,
  text,
  requiredId,
  SimpleDialog,
  InvoiceButton,
  InvoiceField,
  controlClass
} from "@/components/crm/invoices/primitives";

export const paymentMethods = ["Bank Transfer", "Check", "Cash", "Card (External)", "Other"];
export function InvoicePaymentModal({
  invoice,
  onClose,
  onSaved,
  onToast
}: {
  invoice: RecordData;
  onClose: () => void;
  onSaved: (result: InvoiceMutationResult) => void;
  onToast: (toast: InvoiceToast) => void;
}) {
  const [values, setValues] = useState({
    amount: Number(invoice.balanceDue ?? 0).toFixed(2),
    paymentDate: todayInput(),
    paymentMethod: "Bank Transfer",
    referenceNumber: "",
    notes: ""
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    const amount = Number(values.amount);
    const balance = Number(invoice.balanceDue ?? 0);
    if (!(amount > 0)) return setError("Payment amount must be greater than zero.");
    if (amount > balance) return setError(`Payment cannot exceed ${money(balance, text(invoice.currency) || "USD")}.`);
    setSaving(true);
    try {
      const result = await apiRequest<InvoiceMutationResult>(`/api/invoices/${requiredId(invoice)}/payments`, {
        method: "POST",
        body: jsonBody(values)
      });
      onSaved(result);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "The payment could not be recorded.";
      setError(message);
      onToast({ tone: "error", message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <SimpleDialog
      title="Record Payment"
      description="Record an externally received payment. This does not process or transfer money."
      onClose={onClose}
      footer={
        <>
          <InvoiceButton onClick={onClose}>Cancel</InvoiceButton>
          <InvoiceButton tone="primary" disabled={saving} onClick={() => submit()}>
            {saving ? "Recording..." : "Record Payment"}
          </InvoiceButton>
        </>
      }
    >
      <div className="mb-4 rounded-lg border border-brand-200 bg-brand-50 p-3">
        <div className="text-xs text-[#706e6b]">Current balance</div>
        <div className="text-xl font-semibold text-[#032d60]">
          {money(invoice.balanceDue, text(invoice.currency) || "USD")}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <InvoiceField label="Amount" required error={error}>
          <input
            aria-label="Amount"
            type="number"
            min="0.01"
            step="0.01"
            max={text(invoice.balanceDue)}
            className={controlClass}
            value={values.amount}
            onChange={(event) => {
              setError("");
              setValues({ ...values, amount: event.target.value });
            }}
          />
        </InvoiceField>
        <InvoiceField label="Payment Date" required>
          <input
            aria-label="Payment Date"
            type="date"
            className={controlClass}
            value={values.paymentDate}
            onChange={(event) => setValues({ ...values, paymentDate: event.target.value })}
          />
        </InvoiceField>
        <InvoiceField label="Payment Method" required>
          <select
            aria-label="Payment Method"
            className={controlClass}
            value={values.paymentMethod}
            onChange={(event) => setValues({ ...values, paymentMethod: event.target.value })}
          >
            {paymentMethods.map((method) => (
              <option key={method}>{method}</option>
            ))}
          </select>
        </InvoiceField>
        <InvoiceField label="Reference Number">
          <input
            aria-label="Reference Number"
            className={controlClass}
            value={values.referenceNumber}
            onChange={(event) => setValues({ ...values, referenceNumber: event.target.value })}
          />
        </InvoiceField>
        <div className="md:col-span-2">
          <InvoiceField label="Notes">
            <textarea
              aria-label="Payment Notes"
              className={cn(controlClass, "min-h-20")}
              value={values.notes}
              onChange={(event) => setValues({ ...values, notes: event.target.value })}
            />
          </InvoiceField>
        </div>
      </div>
    </SimpleDialog>
  );
}
