"use client";

import { Send } from "lucide-react";
import { useState } from "react";
import { type RecordData } from "@/lib/crm-types";
import { apiRequest, jsonBody } from "@/lib/api/client";
import {
  type InvoiceMutationResult,
  type InvoiceToast,
  requiredId,
  SimpleDialog,
  InvoiceButton,
  InvoiceField,
  controlClass
} from "@/components/crm/invoices/primitives";

export function InvoiceSendModal({
  invoice,
  initialRecipient,
  onClose,
  onSent,
  onToast
}: {
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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail.trim()))
      return setError("Enter a valid recipient email address.");
    setWorking(true);
    setError("");
    try {
      const result = await apiRequest<InvoiceMutationResult>(`/api/invoices/${requiredId(invoice)}/actions`, {
        method: "POST",
        body: jsonBody({ action: "send", recipientEmail: recipientEmail.trim() })
      });
      onSent(result);
      onToast({
        tone: "success",
        message: `Invoice accepted for delivery to ${recipientEmail.trim()}.`
      });
      onClose();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "The invoice email could not be sent.";
      setError(message);
      onToast({ tone: "error", message });
    } finally {
      setWorking(false);
    }
  }

  return (
    <SimpleDialog
      title="Send Invoice"
      description="The invoice PDF will be attached. The invoice becomes Sent after SendGrid accepts the message."
      onClose={onClose}
      footer={
        <>
          <InvoiceButton onClick={onClose}>Cancel</InvoiceButton>
          <InvoiceButton tone="primary" disabled={working} onClick={() => submit()}>
            <Send size={14} /> {working ? "Sending..." : "Send Invoice"}
          </InvoiceButton>
        </>
      }
    >
      <InvoiceField label="Recipient Email" required error={error}>
        <input
          aria-label="Invoice recipient email"
          type="email"
          autoFocus
          className={controlClass}
          value={recipientEmail}
          onChange={(event) => {
            setError("");
            setRecipientEmail(event.target.value);
          }}
        />
      </InvoiceField>
      <p className="mt-3 text-xs text-[#706e6b]">Sender: the verified SendGrid address configured for this CRM.</p>
    </SimpleDialog>
  );
}
