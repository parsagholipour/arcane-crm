"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import { type RecordData as BaseRecordData } from "@/lib/crm-types";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/api/client";

export type Toast = { tone: "success" | "error" | "warning"; message: string } | null;
export type RecordData = BaseRecordData & {
  description?: string;
  visibleToCustomer?: boolean;
  visibleInInternalApp?: boolean;
  lastReason?: string;
};
export const secondary =
  "inline-flex min-h-8 items-center justify-center gap-1 rounded border border-[#c9c9c9] bg-white px-3 py-1 text-xs font-semibold text-brand-700 hover:bg-[#f3f3f3] disabled:opacity-50";
export const primary =
  "inline-flex min-h-8 items-center justify-center gap-1 rounded border border-brand-700 bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50";
export const danger =
  "inline-flex min-h-8 items-center justify-center gap-1 rounded border border-[#ba0517] bg-[#ba0517] px-3 py-1 text-xs font-semibold text-white hover:bg-[#8e030f]";
export function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}
export function id(record: RecordData) {
  return text(record.id);
}
export function name(record?: RecordData) {
  return record ? [record.firstName, record.lastName].filter(Boolean).join(" ") || text(record.name) : "";
}
export function money(value: unknown) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value ?? 0));
}
export function plain(value: unknown) {
  return text(value)
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();
}
export const json = apiRequest<Record<string, unknown>>;
export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-[#e4e7ec] bg-white shadow-card">
      <div className="border-b border-[#d8dde6] px-4 py-3 font-semibold">{title}</div>
      <div className="p-4">{children}</div>
    </section>
  );
}
export function Detail({ label, value, href }: { label: string; value: unknown; href?: string }) {
  return (
    <div>
      <dt className="text-xs text-[#706e6b]">{label}</dt>
      <dd className="mt-0.5 text-sm">
        {href && value ? (
          <Link className="text-brand-700 hover:underline" href={href}>
            {text(value)}
          </Link>
        ) : (
          text(value) || "-"
        )}
      </dd>
    </div>
  );
}
export function Status({ value }: { value: unknown }) {
  const status = text(value);
  const positive = ["Qualified", "Closed Won", "Published", "Sent", "Working"].includes(status);
  const closed = ["Closed", "Closed Lost", "Archived"].includes(status);
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-semibold",
        positive ? "bg-[#e4f6e6] text-[#194f25]" : closed ? "bg-[#f3f3f3] text-[#514f4d]" : "bg-brand-50 text-brand-900"
      )}
    >
      {status}
    </span>
  );
}
export function Metric({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-lg border border-[#e4e7ec] bg-white p-4 shadow-card">
      <div className="text-xs text-[#706e6b]">{label}</div>
      <div className="mt-1 text-xl font-semibold">{text(value)}</div>
    </div>
  );
}
