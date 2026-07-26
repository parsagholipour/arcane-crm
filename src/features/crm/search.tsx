"use client";

import * as Popover from "@radix-ui/react-popover";
import { Search, X } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { OBJECT_DEFINITIONS } from "@/lib/crm-metadata";
import { recordTitle, routeForRecord } from "@/lib/crm-data";
import { recentSearchHistoryEntries } from "@/lib/recent-records";
import { type ScopedCrmData, type CrmObject, type ObjectDefinition, type RecordData } from "@/lib/crm-types";
import { cn, formatDateTime } from "@/lib/utils";
import { isCrmObject } from "@/features/routing/lightning-route";
import { type ToastState } from "@/components/ui/crm-primitives";
import { reportBuilderFieldLabel } from "@/features/crm/analytics-model";
import { inputBareClass } from "@/features/crm/controls";
import { objectList } from "@/features/crm/data-model";
import { resourceApi } from "@/lib/api/resources";
import { formatCell, groupBy } from "@/features/crm/form-model";
import { canRouteToRecord, requiredId } from "@/features/crm/record-model";
import { listSearchHref, listViewHref, reportHref, reportIdFromTitle } from "@/features/crm/route-model";
import { type ScopedCrmDataUpdater, type SearchResult } from "@/features/crm/shared-types";
import { normalizeSearchText } from "@/features/crm/text-model";

export const reportSearchCatalog = [
  {
    title: "Open Cases for Accounts I Own",
    context: "Report - Cases",
    description: "Support workload by account ownership"
  },
  { title: "My Closed Cases by Close Date", context: "Report - Cases", description: "Closed support volume over time" },
  { title: "My Cases Closed MTD", context: "Report - Cases", description: "Month-to-date case closures" },
  { title: "Pipeline by Stage", context: "Report - Opportunities", description: "Opportunity amount grouped by stage" },
  { title: "Leads by Status", context: "Report - Leads", description: "Lead counts grouped by status" },
  { title: "Contacts by Account", context: "Report - Contacts", description: "Contact coverage grouped by account" },
  { title: "Accounts by Type", context: "Report - Accounts", description: "Account mix grouped by type" }
] as const;
export function SearchOverlay({
  data,
  onNavigate,
  onDataChange,
  onToast
}: {
  data: ScopedCrmData;
  onNavigate: (href: string) => void;
  onDataChange: ScopedCrmDataUpdater;
  onToast: (toast: ToastState) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchIndex = useMemo(() => buildGlobalSearchIndex(data), [data]);
  const recentResults = useMemo(
    () => recentSearchResults(recentSearchHistoryEntries(data.globalSearchRecents)),
    [data.globalSearchRecents]
  );
  const suggestedResults = useMemo(() => buildSuggestedSearches(data), [data]);
  const results = useMemo(() => {
    if (!query.trim()) return searchIndex.slice(0, 8);
    return searchIndex.filter((item) => searchResultMatches(item, query)).slice(0, 30);
  }, [query, searchIndex]);
  const groupedResults = groupBy(results, (item) => item.category);

  async function openSearchResult(item: SearchResult) {
    if (item.category === "Suggested Search") {
      setQuery(item.query ?? item.label);
      return;
    }

    if (item.category !== "Recent") {
      const response = await resourceApi.saveSearchRecent({
        query: query.trim() || item.query || item.label,
        label: item.label,
        context: item.context,
        href: item.href,
        category: item.category
      });
      if (Array.isArray(response?.globalSearchRecents)) {
        onDataChange((previous) => ({
          ...previous,
          globalSearchRecents: response.globalSearchRecents as RecordData[]
        }));
      }
    }
    setOpen(false);
    onNavigate(item.href);
  }

  async function clearSearchRecents() {
    const response = await resourceApi.clearSearchRecents();
    if (Array.isArray(response?.globalSearchRecents)) {
      onDataChange((previous) => ({ ...previous, globalSearchRecents: [] }));
      onToast({ tone: "success", message: "Recent searches cleared." });
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className="mx-auto flex h-8 w-full max-w-xl items-center gap-2 rounded-full border border-[#cfd4dc] bg-[#f2f4f7] px-3.5 text-left text-sm text-[#514f4d] hover:border-[#b5bcc7] hover:bg-white hover:shadow-[0_1px_3px_rgba(16,24,40,0.08)] data-[state=open]:border-brand-500 data-[state=open]:bg-white data-[state=open]:shadow-[0_0_0_3px_rgba(79,70,229,0.14)]"
          aria-label="Search..."
        >
          <Search size={16} className="text-[#706e6b]" />
          <span>Search...</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="center"
          className="z-50 w-[680px] rounded border border-[#c9c9c9] bg-white p-3 shadow-popover"
        >
          <div className="flex items-center gap-2 rounded-md border border-brand-500 px-2 shadow-[0_0_0_3px_rgba(79,70,229,0.12)]">
            <Search size={16} className="text-brand-600" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className={cn(inputBareClass, "h-9")}
              placeholder="Search records, reports, and list views..."
              onKeyDown={(event) => {
                if (event.key === "Enter" && results[0]) void openSearchResult(results[0]);
              }}
            />
            {query && (
              <button
                className="rounded p-1 text-[#706e6b] hover:bg-[#f3f3f3]"
                aria-label="Clear search"
                onClick={() => setQuery("")}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="slds-scrollbar mt-3 max-h-[28rem] overflow-auto">
            {!query.trim() && (
              <>
                {recentResults.length > 0 && (
                  <SearchResultSection
                    title="Recent Searches"
                    actionLabel="Clear"
                    onAction={() => void clearSearchRecents()}
                  >
                    {recentResults.map((item) => (
                      <SearchResultRow key={item.id} item={item} onOpen={openSearchResult} />
                    ))}
                  </SearchResultSection>
                )}
                <SearchResultSection title="Suggested Searches">
                  {suggestedResults.map((item) => (
                    <SearchResultRow key={item.id} item={item} onOpen={openSearchResult} />
                  ))}
                </SearchResultSection>
              </>
            )}
            {query.trim() ? (
              Object.entries(groupedResults).map(([category, items]) => (
                <SearchResultSection key={category} title={category}>
                  {items.map((item) => (
                    <SearchResultRow key={item.id} item={item} onOpen={openSearchResult} />
                  ))}
                </SearchResultSection>
              ))
            ) : (
              <SearchResultSection title="Top Results">
                {results.map((item) => (
                  <SearchResultRow key={item.id} item={item} onOpen={openSearchResult} />
                ))}
              </SearchResultSection>
            )}
            {results.length === 0 && query.trim() && (
              <div className="py-8 text-center text-sm text-[#706e6b]">No results found.</div>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
export function SearchResultSection({
  title,
  actionLabel,
  onAction,
  children
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  return (
    <section className="mb-3">
      <div className="mb-1 flex items-center justify-between gap-2 px-1">
        <div className="text-[11px] font-semibold uppercase text-[#706e6b]">{title}</div>
        {actionLabel && (
          <button className="text-xs font-semibold text-brand-700 hover:underline" onClick={onAction}>
            {actionLabel}
          </button>
        )}
      </div>
      <div className="grid gap-1">{children}</div>
    </section>
  );
}
export function SearchResultRow({
  item,
  onOpen
}: {
  item: SearchResult;
  onOpen: (item: SearchResult) => void | Promise<void>;
}) {
  return (
    <button
      onClick={() => void onOpen(item)}
      className="flex w-full items-center gap-3 rounded px-2 py-2 text-left hover:bg-brand-50"
    >
      <span
        className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded", searchCategoryClass(item.category))}
      >
        <Search size={14} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{item.label}</span>
        <span className="block truncate text-xs text-[#706e6b]">{item.context}</span>
        {item.description && <span className="block truncate text-[11px] text-[#706e6b]">{item.description}</span>}
      </span>
      <span className="shrink-0 rounded bg-[#f3f3f3] px-1.5 py-0.5 text-[11px] text-[#514f4d]">{item.category}</span>
    </button>
  );
}
export function searchCategoryClass(category: SearchResult["category"]) {
  switch (category) {
    case "Record":
      return "bg-brand-50 text-brand-700";
    case "List View":
      return "bg-[#e4f6e6] text-[#194f25]";
    case "Report":
      return "bg-[#fef1e8] text-[#8a3b12]";
    case "Recent":
      return "bg-[#f3f3f3] text-[#514f4d]";
    default:
      return "bg-[#eef4ff] text-[#0b5cab]";
  }
}
export function buildGlobalSearchIndex(data: ScopedCrmData): SearchResult[] {
  const recordResults = objectList.flatMap((object) => {
    const definition = OBJECT_DEFINITIONS[object];
    const records = data[definition.dataKey] as RecordData[];
    return records.map((record) => {
      const label = recordTitle(object, record);
      const contextDetail = searchRecordContext(object, record, definition);
      return {
        id: `record-${object}-${requiredId(record)}`,
        label,
        context: contextDetail,
        href: searchRecordHref(object, record, label),
        category: "Record" as const,
        description: searchRecordDescription(object, record, definition)
      };
    });
  });

  return [
    ...recordResults,
    ...buildListViewSearchResults(data),
    ...reportSearchDefinitions(),
    ...customReportSearchResults(data)
  ];
}
export function buildListViewSearchResults(data: ScopedCrmData): SearchResult[] {
  return objectList.flatMap((object) => {
    const definition = OBJECT_DEFINITIONS[object];
    const customViews = data.listViewPreferences
      .filter((preference) => preference.object === object)
      .map((preference) => String(preference.viewName));
    const views = Array.from(new Set([...definition.listViews, ...customViews]));
    return views.map((viewName) => ({
      id: `list-${object}-${viewName}`,
      label: viewName,
      context: `List View - ${definition.plural}`,
      href: listViewHref(object, viewName),
      category: "List View" as const,
      description: `${definition.label} records`
    }));
  });
}
export function reportSearchDefinitions(): SearchResult[] {
  return reportSearchCatalog.map((report) => ({
    id: `report-${reportIdFromTitle(report.title)}`,
    label: report.title,
    context: report.context,
    href: reportHref(report.title),
    category: "Report" as const,
    description: report.description
  }));
}
export function customReportSearchResults(data: ScopedCrmData): SearchResult[] {
  return data.customReports.map((report) => {
    const object = isCrmObject(String(report.object ?? "")) ? (String(report.object) as CrmObject) : "Lead";
    return {
      id: `custom-report-search-${String(report.id ?? report.name)}`,
      label: String(report.name ?? "Custom Report"),
      context: `${OBJECT_DEFINITIONS[object].plural} Report`,
      href: reportHref(String(report.name ?? "Custom Report")),
      category: "Report" as const,
      description: `Saved custom report grouped by ${reportBuilderFieldLabel(object, String(report.groupField ?? ""))}`
    };
  });
}
export function buildSuggestedSearches(data: ScopedCrmData): SearchResult[] {
  const primaryAccount = data.accounts[0];
  const accountName = String(primaryAccount?.name ?? "Robert");
  return [
    {
      id: "suggest-robert-accounts",
      label: `${accountName} accounts`,
      context: "Suggested Search",
      href: "",
      category: "Suggested Search",
      query: `${accountName} accounts`,
      description: "Find matching account records"
    },
    {
      id: "suggest-customer-accounts",
      label: "accounts with account type customer",
      context: "Suggested Search",
      href: "",
      category: "Suggested Search",
      query: "accounts with account type customer",
      description: "Search account type and list views"
    },
    {
      id: "suggest-robert-contacts",
      label: `${accountName} contacts`,
      context: "Suggested Search",
      href: "",
      category: "Suggested Search",
      query: `${accountName} contacts`,
      description: "Find contacts associated with the account"
    },
    {
      id: "suggest-open-cases",
      label: "open cases",
      context: "Suggested Search",
      href: "",
      category: "Suggested Search",
      query: "open cases",
      description: "Find support case lists and reports"
    }
  ];
}
export function recentSearchResults(recents: RecordData[]): SearchResult[] {
  return recents.map((item) => ({
    id: `recent-${String(item.id)}`,
    label: String(item.label ?? "Recent search"),
    context: String(item.context ?? "Recent Search"),
    href: String(item.href ?? ""),
    category: "Recent",
    query: item.query ? String(item.query) : undefined,
    description: item.updatedAt ? `Last opened ${formatDateTime(String(item.updatedAt))}` : undefined
  }));
}
export function searchResultMatches(item: SearchResult, query: string) {
  const haystack = normalizeSearchText(
    [item.label, item.context, item.description, item.category].filter(Boolean).join(" ")
  );
  return normalizeSearchText(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token) || haystack.includes(token.replace(/s$/, "")));
}
export function searchRecordContext(object: CrmObject, record: RecordData, definition: ObjectDefinition) {
  switch (object) {
    case "Contact":
      return `${definition.label} - ${String(record.accountName ?? "Account")}`;
    case "Lead":
      return `${definition.label} - ${String(record.company ?? "Company")}`;
    case "Opportunity":
      return `${definition.label} - ${String(record.accountName ?? "Account")}`;
    case "Case":
      return `${definition.label} - ${String(record.status ?? "Status")}`;
    case "Product2":
      return `${definition.label} - ${String(record.productCode ?? record.family ?? "Product")}`;
    case "ListEmail":
      return `${definition.label} - ${String(record.status ?? "Draft")}`;
    default:
      return definition.label;
  }
}
export function searchRecordDescription(object: CrmObject, record: RecordData, definition: ObjectDefinition) {
  const columnSummary = definition.columns
    .filter((column) => column.key !== definition.columns[0]?.key)
    .slice(0, 2)
    .map((column) => formatCell(record[column.key]))
    .filter(Boolean)
    .join(" - ");
  if (columnSummary) return columnSummary;
  if (object === "Event") return [formatCell(record.startAt), formatCell(record.endAt)].filter(Boolean).join(" - ");
  return definition.plural;
}
export function searchRecordHref(object: CrmObject, record: RecordData, label: string) {
  if (canRouteToRecord(object)) return routeForRecord(object, requiredId(record));
  return listSearchHref(object, label);
}
