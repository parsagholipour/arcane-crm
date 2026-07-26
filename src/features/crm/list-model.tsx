import { CASE_STATUS, LEAD_STATUS, OPPORTUNITY_STAGE } from "@/lib/crm-metadata";
import { isRecordRecentlyViewed } from "@/lib/recent-records";
import { type CrmObject, type ObjectDefinition, type RecordData } from "@/lib/crm-types";
import { isRecordData } from "@/features/crm/data-model";
import { formatCell } from "@/features/crm/form-model";
import { type KanbanConfig } from "@/features/crm/shared-types";

export const listViewSharingOptions = [
  "Only I can see this list view",
  "All users can see this list view",
  "Share with groups of users"
];
export function columnsForListView(definition: ObjectDefinition, preference?: RecordData) {
  const keys = Array.isArray(preference?.columns)
    ? preference.columns.map(String)
    : definition.columns.map((column) => column.key);
  const columns = keys
    .map((key) => definition.columns.find((column) => column.key === key))
    .filter((column): column is ObjectDefinition["columns"][number] => Boolean(column));
  const widths = columnWidthsForListView(preference);
  return (columns.length > 0 ? columns : definition.columns).map((column) => ({
    ...column,
    width: widths[column.key] ?? column.width
  }));
}
export function columnWidthsForListView(preference?: RecordData): Record<string, string> {
  const source = preference?.columnWidths;
  if (typeof source !== "object" || source === null || Array.isArray(source)) return {};
  return Object.entries(source).reduce<Record<string, string>>((accumulator, [key, value]) => {
    const width = normalizeColumnWidth(value);
    if (width) accumulator[key] = width;
    return accumulator;
  }, {});
}
export function kanbanConfigForObject(object: CrmObject): KanbanConfig | null {
  switch (object) {
    case "Lead":
      return { field: "status", label: "Lead Status", values: picklistKanbanValues(LEAD_STATUS) };
    case "Opportunity":
      return {
        field: "stage",
        label: "Stage",
        values: picklistKanbanValues(OPPORTUNITY_STAGE),
        summaryField: "amount"
      };
    case "Case":
      return { field: "status", label: "Status", values: picklistKanbanValues(CASE_STATUS) };
    default:
      return null;
  }
}
export function picklistKanbanValues(values: string[]) {
  return values.filter((value) => value && value !== "--None--");
}
export function filtersForListView(definition: ObjectDefinition, preference?: RecordData) {
  const allowedFields = new Set(definition.columns.map((column) => column.key));
  if (!Array.isArray(preference?.filters)) return [];
  return preference.filters
    .map((filter) => (isRecordData(filter) ? filter : null))
    .filter((filter): filter is RecordData => {
      if (!filter) return false;
      return allowedFields.has(String(filter.field));
    });
}
export function recordMatchesStandardListView(
  object: CrmObject,
  listView: string,
  record: RecordData,
  recentRecords: RecordData[],
  currentUserId: string
) {
  const status = String(record.status ?? "Draft");
  const isRecent = isRecordRecentlyViewed(object, record, recentRecords);
  if (listView.includes("Recently Viewed") || listView === "Recently Viewed") return isRecent;
  if (object === "Contact") {
    if (listView === "Birthdays This Month") return isDateInCurrentMonth(record.birthDate);
    if (listView === "My Contacts") return record.ownerId === currentUserId;
    if (listView === "New This Week") return isDateInCurrentWeek(record.createdAt);
    return true;
  }
  if (object === "Account") {
    if (listView === "My Accounts") return record.ownerId === currentUserId;
    if (listView === "New This Week") return isDateInCurrentWeek(record.createdAt);
    return true;
  }
  if (object === "Lead") {
    if (listView === "All Open Leads") return !record.convertedAt && status !== "Unqualified";
    if (listView === "My Leads") return record.ownerId === currentUserId;
    if (listView === "Today's Leads") return isDateToday(record.createdAt);
    return true;
  }
  if (object === "Opportunity") {
    if (listView === "Closing Next Month") return isDateInNextMonth(record.closeDate);
    if (listView === "My Opportunities") return record.ownerId === currentUserId;
    return true;
  }
  if (object === "Product2") return listView === "Active Products" ? record.active === true : true;
  if (object === "Pricebook2") return listView === "Active Price Books" ? record.active === true : true;
  if (object === "Case") {
    if (listView === "All Open Cases") return status !== "Closed";
    if (listView === "My Cases") return record.ownerId === currentUserId;
    return true;
  }
  if (object === "Knowledge__kav") {
    const publicationStatus = String(record.publicationStatus ?? "Draft");
    if (listView === "Archived Articles") return publicationStatus === "Archived";
    if (listView === "Draft Articles") return publicationStatus === "Draft";
    if (listView === "Published Articles") return publicationStatus === "Published";
    return true;
  }
  if (object === "ListEmail") return listView === "My List Emails" ? record.createdById === currentUserId : true;
  if (object === "Campaign") {
    if (["Planned", "In Progress", "Completed", "Archived"].includes(listView)) return status === listView;
    return true;
  }
  if (object === "MessagingSession") {
    if (["Open", "Waiting", "Closed"].includes(listView)) return status === listView;
    return true;
  }
  if (object === "VideoCall") {
    if (listView === "Upcoming") return status === "Scheduled";
    if (["In Progress", "Completed", "Cancelled"].includes(listView)) return status === listView;
    return true;
  }
  if (object !== "Invoice") return true;
  if (listView === "Draft") return status === "Draft";
  if (listView === "Outstanding")
    return ["Sent", "Partially Paid", "Overdue"].includes(status) && Number(record.balanceDue ?? 0) > 0;
  if (listView === "Overdue") return status === "Overdue";
  if (listView === "Paid") return status === "Paid";
  return true;
}
export function validRecordDate(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isFinite(date.getTime()) ? date : null;
}
export function isDateToday(value: unknown) {
  const date = validRecordDate(value);
  const today = new Date();
  return Boolean(
    date &&
    date.getUTCFullYear() === today.getUTCFullYear() &&
    date.getUTCMonth() === today.getUTCMonth() &&
    date.getUTCDate() === today.getUTCDate()
  );
}
export function isDateInCurrentWeek(value: unknown) {
  const date = validRecordDate(value);
  if (!date) return false;
  const today = new Date();
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - today.getUTCDay()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return date >= start && date < end;
}
export function isDateInCurrentMonth(value: unknown) {
  const date = validRecordDate(value);
  const today = new Date();
  return Boolean(date && date.getUTCMonth() === today.getUTCMonth());
}
export function isDateInNextMonth(value: unknown) {
  const date = validRecordDate(value);
  if (!date) return false;
  const today = new Date();
  const next = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
  return date.getUTCFullYear() === next.getUTCFullYear() && date.getUTCMonth() === next.getUTCMonth();
}
export function recordMatchesListFilter(record: RecordData, filter: RecordData) {
  const raw = record[String(filter.field)];
  const value = formatCell(raw).toLowerCase();
  const target = String(filter.value ?? "").toLowerCase();
  switch (filter.operator) {
    case "equals":
      return value === target;
    case "not-equals":
      return value !== target;
    case "starts-with":
      return value.startsWith(target);
    case "is-empty":
      return value.length === 0;
    default:
      return value.includes(target);
  }
}
export function chartDataForRecords(records: RecordData[], field: string) {
  const counts = records.reduce<Record<string, number>>((accumulator, record) => {
    const label = formatCell(record[field]) || "Blank";
    accumulator[label] = (accumulator[label] ?? 0) + 1;
    return accumulator;
  }, {});
  return Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 8);
}
export function numberFromRecord(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value === null || value === undefined) return 0;
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}
export function compareRecordValues(left: unknown, right: unknown) {
  const leftEmpty = left === null || left === undefined || left === "";
  const rightEmpty = right === null || right === undefined || right === "";
  if (leftEmpty && rightEmpty) return 0;
  if (leftEmpty) return 1;
  if (rightEmpty) return -1;

  const leftNumber = numericSortValue(left);
  const rightNumber = numericSortValue(right);
  if (leftNumber !== null && rightNumber !== null) return leftNumber - rightNumber;

  const leftDate = dateSortValue(left);
  const rightDate = dateSortValue(right);
  if (leftDate !== null && rightDate !== null) return leftDate - rightDate;

  return formatCell(left).localeCompare(formatCell(right), undefined, { numeric: true, sensitivity: "base" });
}
export function numericSortValue(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/[$,%\s,]/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
export function dateSortValue(value: unknown) {
  if (value instanceof Date) return value.getTime();
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}
export function normalizeColumnWidth(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.trim().replace(/px$/i, ""))
        : Number.NaN;
  if (!Number.isFinite(parsed)) return null;
  return `${Math.max(110, Math.min(520, Math.round(parsed)))}px`;
}
export function parseColumnWidth(value: unknown) {
  const normalized = normalizeColumnWidth(value);
  return normalized ? Number(normalized.replace("px", "")) : 150;
}
export function formatKanbanSummary(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}
