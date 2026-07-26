"use client";

import { useInvoiceEditor, type InvoiceEditorModalProps } from "@/components/crm/invoices/editor-controller";
import { InvoiceEditorView } from "@/components/crm/invoices/editor-view";

export function InvoiceEditorModal(props: InvoiceEditorModalProps) {
  const model = useInvoiceEditor(props);
  return <InvoiceEditorView model={model} />;
}
