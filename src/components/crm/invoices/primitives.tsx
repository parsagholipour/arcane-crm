"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import Link from "next/link";
import { type ReactNode } from "react";
import { type RecordData } from "@/lib/crm-types";
import { cn } from "@/lib/utils";
import { AsyncButton } from "@/components/crm/AsyncButton";
import { useDialogEnterAction } from "@/components/ui/crm-primitives";

export type InvoiceMutationResult = { invoice: RecordData; delivery?: RecordData; notifications?: RecordData[] };
export type InvoiceToast = { tone: "success" | "error" | "warning"; message: string } | null;
export const controlClass =
  "min-h-9 w-full rounded border border-[#c9c9c9] bg-white px-2.5 py-1.5 text-sm outline-none transition hover:border-[#8e8e8e] focus:border-[#0176d3] focus:shadow-[0_0_0_3px_rgba(1,118,211,0.16)] disabled:bg-[#f3f3f3]";
export function requiredId(record: RecordData | undefined) {
  return record?.id ? String(record.id) : "";
}
export function dateInput(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : date.toISOString().slice(0, 10);
}
export function todayInput() {
  return new Date().toISOString().slice(0, 10);
}
export function addDays(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}
export function money(value: unknown, currency = "USD") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency, minimumFractionDigits: 2 }).format(
    Number(value ?? 0)
  );
}
export function InvoiceStatusBadge({ status }: { status: string }) {
  const style =
    status === "Paid"
      ? "bg-[#e8f5e9] text-[#1b5e20] border-[#a5d6a7]"
      : status === "Overdue"
        ? "bg-[#fff1f1] text-[#8e030f] border-[#f1aeb5]"
        : status === "Void"
          ? "bg-[#ecebea] text-[#444] border-[#c9c7c5]"
          : status === "Sent"
            ? "bg-[#eaf5fe] text-[#014486] border-[#90c9f4]"
            : status === "Partially Paid"
              ? "bg-[#fff7d6] text-[#5f4b00] border-[#e5c349]"
              : "bg-[#f3f3f3] text-[#444] border-[#d8dde6]";
  return (
    <span
      role="status"
      aria-label={`Invoice status: ${status}`}
      className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold", style)}
    >
      {status}
    </span>
  );
}
export function SimpleDialog({
  title,
  description,
  children,
  footer,
  onClose,
  onEnterAction
}: {
  title: string;
  description?: string;
  children?: ReactNode;
  footer: ReactNode;
  onClose: () => void;
  onEnterAction?: () => unknown;
}) {
  const handleEnterAction = useDialogEnterAction(onEnterAction);
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-[#080707]/55" />
        <Dialog.Content
          onKeyDown={handleEnterAction}
          className="fixed left-1/2 top-1/2 z-[101] max-h-[90vh] w-[min(94vw,620px)] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-xl bg-white shadow-modal"
        >
          <div className="flex items-start justify-between border-b border-[#d8dde6] p-4">
            <div>
              <Dialog.Title className="text-xl font-semibold">{title}</Dialog.Title>
              {description && (
                <Dialog.Description className="mt-1 text-sm text-[#706e6b]">{description}</Dialog.Description>
              )}
            </div>
            <button aria-label="Close" onClick={onClose} className="rounded p-1 hover:bg-[#f3f3f3]">
              <X size={18} />
            </button>
          </div>
          {children && <div className="p-4">{children}</div>}
          <div className="flex justify-end gap-2 border-t border-[#d8dde6] bg-[#f8f8f8] p-3">{footer}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function InvoiceButton({
  children,
  onClick,
  tone = "secondary",
  disabled = false
}: {
  children: ReactNode;
  onClick: () => unknown;
  tone?: "primary" | "secondary" | "danger";
  disabled?: boolean;
}) {
  return (
    <AsyncButton
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-8 items-center justify-center gap-1.5 rounded border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        tone === "primary"
          ? "border-[#0176d3] bg-[#0176d3] text-white hover:bg-[#014486]"
          : tone === "danger"
            ? "border-[#ba0517] bg-white text-[#ba0517] hover:bg-[#fff1f1]"
            : "border-[#c9c9c9] bg-white text-[#181818] hover:bg-[#f3f3f3]"
      )}
    >
      {children}
    </AsyncButton>
  );
}
export function InvoiceField({
  label,
  required,
  error,
  children
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs text-[#444]">
        {label}
        {required && <span className="ml-1 text-[#ba0517]">*</span>}
      </span>
      {children}
      {error && <FieldError>{error}</FieldError>}
    </label>
  );
}
export function FieldError({ children }: { children: ReactNode }) {
  return <span className="mt-1 block text-xs text-[#ba0517]">{children}</span>;
}
export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 border-b border-[#d8dde6] pb-2 text-base font-semibold">{children}</h2>;
}
export function InvoiceCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border border-[#e4e7ec] bg-white shadow-card">
      <h2 className="border-b border-[#d8dde6] px-4 py-3 font-semibold">{title}</h2>
      <div className="p-4">{children}</div>
    </section>
  );
}
export function Detail({
  label,
  value,
  href,
  multiline = false
}: {
  label: string;
  value: unknown;
  href?: string;
  multiline?: boolean;
}) {
  const content = text(value) || "-";
  return (
    <div>
      <div className="mb-1 text-xs text-[#706e6b]">{label}</div>
      {href ? (
        <Link href={href} className="text-sm text-brand-700 hover:underline">
          {content}
        </Link>
      ) : (
        <div className={cn("text-sm", multiline && "whitespace-pre-wrap")}>{content}</div>
      )}
    </div>
  );
}
export function TotalRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-4", strong && "text-base font-semibold")}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
