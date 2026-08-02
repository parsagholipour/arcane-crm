"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { type ReactNode } from "react";
import { type RecordData } from "@/lib/crm-types";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/api/client";
import { useDialogEnterAction } from "@/components/ui/crm-primitives";

export type Toast = { tone: "success" | "error" | "warning"; message: string } | null;
export const input =
  "min-h-9 w-full rounded border border-[#c9c9c9] bg-white px-3 py-2 text-sm outline-none focus:border-[#0176d3] focus:ring-2 focus:ring-[#0176d3]/20 disabled:bg-[#f3f3f3]";
export const secondary =
  "inline-flex min-h-8 items-center justify-center gap-1 rounded border border-[#c9c9c9] bg-white px-3 py-1 text-xs font-semibold text-brand-700 hover:bg-[#f3f3f3] disabled:opacity-50";
export const primary =
  "inline-flex min-h-8 items-center justify-center gap-1 rounded border border-brand-700 bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50";
export function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}
export function id(record: RecordData) {
  return text(record.id);
}
export function money(value: unknown, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(value ?? 0));
}
export const json = apiRequest<Record<string, unknown>>;
export function Modal({
  title,
  onClose,
  onEnterAction,
  footer,
  children
}: {
  title: string;
  onClose: () => void;
  onEnterAction?: () => unknown;
  footer: ReactNode;
  children: ReactNode;
}) {
  const handleEnterAction = useDialogEnterAction(onEnterAction);
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/40" />
        <Dialog.Content
          onKeyDown={handleEnterAction}
          className="fixed left-1/2 top-1/2 z-[100] max-h-[90vh] w-[calc(100vw-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg bg-white shadow-2xl"
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
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-semibold text-[#444]">{label}</span>
      {children}
    </label>
  );
}
export function Card({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
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
export function Detail({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <dt className="text-xs text-[#706e6b]">{label}</dt>
      <dd>{text(value) || "-"}</dd>
    </div>
  );
}
export function Active({ value }: { value: unknown }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-semibold",
        value ? "bg-[#e4f6e6] text-[#194f25]" : "bg-[#f3f3f3] text-[#514f4d]"
      )}
    >
      {value ? "Active" : "Inactive"}
    </span>
  );
}
export function Header({
  icon,
  eyebrow,
  title,
  badge,
  actions
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  badge: ReactNode;
  actions: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[#e4e7ec] bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-3">
          {icon}
          <div>
            <div className="text-xs text-[#706e6b]">{eyebrow}</div>
            <h1 className="text-2xl font-semibold">{title}</h1>
            <div className="mt-2">{badge}</div>
          </div>
        </div>
        <div className="flex gap-2">{actions}</div>
      </div>
    </div>
  );
}
export function Empty({ value }: { value: string }) {
  return (
    <div className="rounded border border-dashed border-[#d8dde6] p-5 text-center text-sm text-[#706e6b]">{value}</div>
  );
}
