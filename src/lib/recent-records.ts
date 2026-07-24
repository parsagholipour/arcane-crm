import { recordTitle, routeForRecord } from "@/lib/crm-data";
import type { CrmObject, RecordData } from "@/lib/crm-types";

export const RECENT_HISTORY_LIMIT = 200;
export const RECENT_SEARCH_DISPLAY_LIMIT = 8;

const recordObjectLabels: Partial<Record<CrmObject, string>> = {
  Account: "Account",
  Contact: "Contact",
  Lead: "Lead",
  Opportunity: "Opportunity",
  Product2: "Product",
  Pricebook2: "Price Book",
  Case: "Case",
  MessagingSession: "Messaging Session",
  Knowledge__kav: "Knowledge",
  ListEmail: "List Email",
  Campaign: "Campaign",
  Invoice: "Invoice",
  VideoCall: "Video Call"
};

export function recentlyViewedEntryForRecord(object: CrmObject, record: RecordData): RecordData | null {
  const id = String(record.id ?? "").trim();
  const context = recordObjectLabels[object];
  if (!id || !context) return null;

  return {
    label: recordTitle(object, record),
    context,
    href: routeForRecord(object, id),
    category: "Recently Viewed"
  };
}

export function isRecordRecentlyViewed(object: CrmObject, record: RecordData, recentRecords: RecordData[]) {
  const entry = recentlyViewedEntryForRecord(object, record);
  if (!entry) return false;
  return recentRecords.some((recent) => String(recent.href ?? "") === entry.href);
}

export function recentSearchHistoryEntries(recentRecords: RecordData[]) {
  return recentRecords
    .filter((recent) => typeof recent.query === "string" && recent.query.trim().length > 0)
    .slice(0, RECENT_SEARCH_DISPLAY_LIMIT);
}
