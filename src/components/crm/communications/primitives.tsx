"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import Link from "next/link";
import { type ReactNode } from "react";
import { type RecordData } from "@/lib/crm-types";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/api/client";

export type CommunicationsMutationResult = {
  session?: RecordData;
  videoCall?: RecordData;
  notifications?: RecordData[];
};
export type Toast = { tone: "success" | "error" | "warning"; message: string } | null;
export type ParticipantDraft = {
  contactId: string;
  userId?: string;
  name: string;
  address?: string;
  email?: string;
  role: string;
};
export const inputClass =
  "min-h-9 w-full rounded border border-[#c9c9c9] bg-white px-3 py-2 text-sm outline-none focus:border-[#0176d3] focus:ring-2 focus:ring-[#0176d3]/20 disabled:bg-[#f3f3f3]";
export const secondaryButton =
  "inline-flex min-h-8 items-center justify-center gap-1 rounded border border-[#c9c9c9] bg-white px-3 py-1 text-xs font-semibold text-brand-700 hover:bg-[#f3f3f3] disabled:cursor-not-allowed disabled:opacity-50";
export const primaryButton =
  "inline-flex min-h-8 items-center justify-center gap-1 rounded border border-brand-700 bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50";
export const dangerButton =
  "inline-flex min-h-8 items-center justify-center gap-1 rounded border border-[#ba0517] bg-[#ba0517] px-3 py-1 text-xs font-semibold text-white hover:bg-[#8e030f] disabled:cursor-not-allowed disabled:opacity-50";
export function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}
export function requiredId(record: RecordData) {
  return text(record.id);
}
export function contactLabel(contact: RecordData) {
  return [contact.firstName, contact.lastName].filter(Boolean).join(" ") || text(contact.name || contact.id);
}
export function toDateTimeInput(value: unknown, fallbackMinutes = 0) {
  const date = value ? new Date(text(value)) : new Date(Date.now() + fallbackMinutes * 60_000);
  if (!Number.isFinite(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
export const jsonRequest = apiRequest<Record<string, unknown>>;
export function DialogShell({
  title,
  children,
  footer,
  onClose,
  wide = false
}: {
  title: string;
  children: ReactNode;
  footer: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/40" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-[100] max-h-[90vh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg bg-white shadow-2xl",
            wide ? "max-w-5xl" : "max-w-2xl"
          )}
        >
          <div className="flex items-center justify-between border-b border-[#d8dde6] px-5 py-3">
            <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
            <button className="rounded p-1 hover:bg-[#f3f3f3]" onClick={onClose} aria-label="Close">
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
export function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-semibold text-[#444]">
        {required && <span className="mr-1 text-[#ba0517]">*</span>}
        {label}
      </span>
      {children}
    </label>
  );
}
export function WorkspaceCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-[#e4e7ec] bg-white shadow-card">
      <div className="border-b border-[#d8dde6] px-4 py-3 font-semibold">{title}</div>
      <div className="p-4">{children}</div>
    </section>
  );
}
export function CommunicationsStatusBadge({ status }: { status: unknown }) {
  const value = text(status) || "Unknown";
  const tone = ["Open", "In Progress"].includes(value)
    ? "bg-[#e4f6e6] text-[#194f25]"
    : value === "Waiting" || value === "Scheduled"
      ? "bg-[#fff7e8] text-[#5f4b00]"
      : value === "Closed" || value === "Completed"
        ? "bg-brand-50 text-brand-900"
        : "bg-[#f3f3f3] text-[#514f4d]";
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", tone)}>
      <span className="sr-only">Status: </span>
      {value}
    </span>
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
export function DetailLink({ label, value, href }: { label: string; value: unknown; href: string }) {
  return (
    <div>
      <dt className="text-xs text-[#706e6b]">{label}</dt>
      <dd>
        {href && value ? (
          <Link href={href} className="text-brand-700 hover:underline">
            {text(value)}
          </Link>
        ) : (
          "-"
        )}
      </dd>
    </div>
  );
}
