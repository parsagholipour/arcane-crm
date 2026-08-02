"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { type ReactNode } from "react";
import { type RecordData } from "@/lib/crm-types";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/api/client";
import { useDialogEnterAction } from "@/components/ui/crm-primitives";

export type CampaignMutationResult = { campaign?: RecordData; notifications?: RecordData[] };
export type Toast = { tone: "success" | "error" | "warning"; message: string } | null;
export const inputClass =
  "min-h-9 w-full rounded border border-[#c9c9c9] bg-white px-3 py-2 text-sm outline-none focus:border-[#0176d3] focus:ring-2 focus:ring-[#0176d3]/20 disabled:bg-[#f3f3f3]";
export const secondaryButton =
  "inline-flex min-h-8 items-center justify-center gap-1 rounded border border-[#c9c9c9] bg-white px-3 py-1 text-xs font-semibold text-brand-700 hover:bg-[#f3f3f3] disabled:cursor-not-allowed disabled:opacity-50";
export const primaryButton =
  "inline-flex min-h-8 items-center justify-center gap-1 rounded border border-brand-700 bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50";
export const dangerButton =
  "inline-flex min-h-8 items-center justify-center gap-1 rounded border border-[#ba0517] bg-[#ba0517] px-3 py-1 text-xs font-semibold text-white hover:bg-[#8e030f]";
export function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}
export function id(record: RecordData) {
  return text(record.id);
}
export function contactName(record: RecordData) {
  return [record.firstName, record.lastName].filter(Boolean).join(" ") || text(record.name || record.id);
}
export const jsonRequest = apiRequest<Record<string, unknown>>;
export function Modal({
  title,
  onClose,
  onEnterAction,
  children,
  footer,
  wide = false
}: {
  title: string;
  onClose: () => void;
  onEnterAction?: () => unknown;
  children: ReactNode;
  footer: ReactNode;
  wide?: boolean;
}) {
  const handleEnterAction = useDialogEnterAction(onEnterAction);
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/40" />
        <Dialog.Content
          onKeyDown={handleEnterAction}
          className={cn(
            "fixed left-1/2 top-1/2 z-[100] max-h-[90vh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg bg-white shadow-2xl",
            wide ? "max-w-5xl" : "max-w-2xl"
          )}
        >
          <div className="flex items-center justify-between border-b border-[#d8dde6] px-5 py-3">
            <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
            <button className="rounded p-1 hover:bg-[#f3f3f3]" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
          <div className="max-h-[calc(90vh-120px)] overflow-auto p-5">{children}</div>
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
export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-[#e4e7ec] bg-white shadow-card">
      <div className="border-b border-[#d8dde6] px-4 py-3 font-semibold">{title}</div>
      <div className="p-4">{children}</div>
    </section>
  );
}
export function Detail({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <dt className="text-xs text-[#706e6b]">{label}</dt>
      <dd>{text(value) || "-"}</dd>
    </div>
  );
}
export function CampaignStatusBadge({ status }: { status: unknown }) {
  const value = text(status) || "Planned";
  const tone =
    value === "In Progress"
      ? "bg-[#e4f6e6] text-[#194f25]"
      : value === "Completed"
        ? "bg-brand-50 text-brand-900"
        : value === "Planned"
          ? "bg-[#fff7e8] text-[#5f4b00]"
          : "bg-[#f3f3f3] text-[#514f4d]";
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", tone)}>
      <span className="sr-only">Status: </span>
      {value}
    </span>
  );
}
