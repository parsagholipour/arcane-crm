"use client";

import { type CalendarItem } from "@/lib/calendar";
import { type ScopedCrmData, type RecordData } from "@/lib/crm-types";

export type Toast = { tone: "success" | "error" | "warning"; message: string };
export type ViewMode = "Day" | "Week" | "Month" | "Agenda";
export type CalendarSourceDialogState = { type: "new" } | { type: "edit"; source: RecordData } | null;
export type ScopePrompt =
  { item: CalendarItem; action: "move"; startAt: Date; endAt: Date } | { item: CalendarItem; action: "delete" } | null;
export const input =
  "min-h-9 w-full rounded border border-[#c9c9c9] bg-white px-3 py-2 text-sm outline-none focus:border-[#0176d3] focus:ring-2 focus:ring-[#0176d3]/20 disabled:bg-[#f3f3f3]";
export const secondary =
  "inline-flex min-h-8 items-center justify-center gap-1 rounded border border-[#c9c9c9] bg-white px-3 py-1 text-xs font-semibold text-brand-700 hover:bg-[#f3f3f3] disabled:opacity-50";
export const primary =
  "inline-flex min-h-8 items-center justify-center gap-1 rounded border border-brand-700 bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50";
export const checkbox = "h-4 w-4 shrink-0 rounded border border-[#c9c9c9] accent-brand-600";
export const VIEW_MODES: ViewMode[] = ["Day", "Week", "Month", "Agenda"];
export const HOUR_HEIGHT = 48;
export const DAY_COLUMN_HEIGHT = HOUR_HEIGHT * 24;
export const AGENDA_HORIZON_DAYS = 30;
export const CALENDAR_SOURCE_COLORS = [
  { label: "Indigo", value: "#4f46e5" },
  { label: "Green", value: "#2e844a" },
  { label: "Red", value: "#ba0517" },
  { label: "Gold", value: "#f3b451" },
  { label: "Gray", value: "#706e6b" }
];
export const SHOW_TIME_AS_FILTERS = ["All", "Busy", "Free", "Tentative", "Out of Office"];
export function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}
export function recordId(record: RecordData) {
  return text(record.id);
}
export function calendarSourceType(source: RecordData) {
  return text(source.type ?? "My") === "Other" ? "Other" : "My";
}
export type CalendarWorkspaceProps = {
  data: ScopedCrmData;
  onCreate: (startDate: string, startTime: string, endTime: string, allDay?: boolean) => void;
  onEditEvent: (record: RecordData, occurrence: { occurrenceStart: string | null; recurring: boolean }) => void;
  onOpenVideoCall: (record: RecordData) => void;
  onDataChange: (updater: (previous: ScopedCrmData) => ScopedCrmData) => void;
  onToast: (toast: Toast) => void;
  onRefreshData: (successMessage: string) => Promise<boolean>;
  onNavigate: (href: string) => void;
};
