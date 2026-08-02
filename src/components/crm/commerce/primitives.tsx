"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { type ReactNode } from "react";
import { type RecordData as BaseRecordData } from "@/lib/crm-types";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/api/client";

export type Toast = { tone: "success" | "error" | "warning"; message: string } | null;
export type RecordData = BaseRecordData & { notes?: ReactNode };
export const input =
  "min-h-9 w-full rounded border border-[#c9c9c9] bg-white px-3 py-2 text-sm outline-none focus:border-[#0176d3] focus:ring-2 focus:ring-[#0176d3]/20 disabled:bg-[#f3f3f3]";
export const secondary =
  "inline-flex min-h-8 items-center justify-center gap-1 rounded border border-[#c9c9c9] bg-white px-3 py-1 text-xs font-semibold text-brand-700 hover:bg-[#f3f3f3] disabled:cursor-not-allowed disabled:opacity-50";
export const primary =
  "inline-flex min-h-8 items-center justify-center gap-1 rounded border border-brand-700 bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50";
export const danger =
  "inline-flex min-h-8 items-center justify-center gap-1 rounded border border-[#ba0517] bg-[#ba0517] px-3 py-1 text-xs font-semibold text-white hover:bg-[#8e030f] disabled:opacity-50";
export function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}
export function id(value: RecordData) {
  return text(value.id);
}
export function records(value: unknown) {
  return Array.isArray(value) ? (value as RecordData[]) : [];
}
export function contactName(value: RecordData) {
  return [value.firstName, value.lastName].filter(Boolean).join(" ") || text(value.name);
}
export function money(value: unknown, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(value ?? 0));
}
export const json = apiRequest<Record<string, unknown>>;
export function Modal({
  title,
  onClose,
  footer,
  children,
  wide = false
}: {
  title: string;
  onClose: () => void;
  footer: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/40" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-[100] max-h-[92vh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg bg-white shadow-2xl",
            wide ? "max-w-6xl" : "max-w-2xl"
          )}
        >
          <div className="flex items-center justify-between border-b border-[#d8dde6] px-5 py-3">
            <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
            <button className="rounded p-1 hover:bg-[#f3f3f3]" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
          <div className="max-h-[calc(92vh-120px)] overflow-auto p-5">{children}</div>
          <div className="flex justify-end gap-2 border-t border-[#d8dde6] bg-[#f8f9fb] px-5 py-3">{footer}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Field({ label, children, required }: { label: string; children: ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-semibold text-[#444]">
        {label}
        {required && <span className="ml-1 text-[#ba0517]">*</span>}
      </span>
      {children}
    </label>
  );
}
export function Badge({ value }: { value: unknown }) {
  const status = text(value);
  const tone = ["Active", "Confirmed", "Fulfilled", "Delivered"].includes(status)
    ? "bg-[#e4f6e6] text-[#194f25]"
    : ["Draft", "Packed", "Unfulfilled"].includes(status)
      ? "bg-[#fff7e8] text-[#5f4b00]"
      : ["Cancelled", "Archived"].includes(status)
        ? "bg-[#f3f3f3] text-[#514f4d]"
        : "bg-brand-50 text-brand-900";
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", tone)}>
      <span className="sr-only">Status: </span>
      {status}
    </span>
  );
}
export type Mutation = {
  store?: RecordData;
  order?: RecordData;
  inventoryItem?: RecordData;
  inventoryItems?: RecordData[];
  promotion?: RecordData;
  notifications?: RecordData[];
};
export function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-[#e4e7ec] bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-[#d8dde6] px-4 py-3">
        <h2 className="font-semibold">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}
export function Empty({ text: value }: { text: string }) {
  return (
    <div className="col-span-full rounded border border-dashed border-[#d8dde6] p-6 text-center text-sm text-[#706e6b]">
      {value}
    </div>
  );
}
export function Metric({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded bg-[#f8f9fb] p-2">
      <div className="font-semibold text-[#181818]">{text(value)}</div>
      <div className="text-[#706e6b]">{label}</div>
    </div>
  );
}
export function ErrorBox({ value }: { value: string }) {
  return <div className="rounded border border-[#ea001e] bg-[#fff1f1] p-2 text-sm text-[#8e030f]">{value}</div>;
}
