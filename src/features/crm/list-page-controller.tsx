"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { OBJECT_DEFINITIONS } from "@/lib/crm-metadata";
import { type ScopedCrmData, type CrmObject, type RecordData } from "@/lib/crm-types";
import { dataKeyForObject } from "@/lib/crm-data";
import { apiRequest } from "@/lib/api/client";
import { type GenericRecord, type ListResult } from "@/lib/api/contracts";
import { listViewMatchesSearch, normalizeListViewSharing } from "@/features/crm/controls";
import { resourceApi } from "@/lib/api/resources";
import { fieldLabel } from "@/features/crm/form-model";
import {
  columnsForListView,
  columnWidthsForListView,
  compareRecordValues,
  filtersForListView,
  kanbanConfigForObject,
  recordMatchesCountryFilter,
  recordMatchesListFilter,
  recordMatchesStandardListView
} from "@/features/crm/list-model";
import { requiredId } from "@/features/crm/record-model";
import { type ScopedCrmDataUpdater, type ListSortState, type SaveRecordHandler } from "@/features/crm/shared-types";
import { type ToastState } from "@/components/ui/crm-primitives";
import { guidanceItemForObject, isContextualGuidanceVisible } from "@/features/crm/shell-model";
import { useShipmentTrackingSweep } from "@/features/crm/use-shipment-tracking-sweep";
import { isServerSortableListColumn } from "@/lib/record-list-sorting";

export function useListViewController({
  object,
  data,
  records,
  recordLabels,
  campaignMembers,
  initialQuery,
  initialListView,
  onCreate,
  onEdit,
  onDelete,
  onToast,
  onListAction,
  onSaveRecord,
  onDataChange
}: {
  object: CrmObject;
  data: ScopedCrmData;
  records: RecordData[];
  recordLabels: Record<string, string[]>;
  campaignMembers: Record<string, string[]>;
  initialQuery: string;
  initialListView: string;
  onCreate: (object: CrmObject, initialValues?: RecordData) => void;
  onEdit: (object: CrmObject, record: RecordData) => void;
  onDelete: (object: CrmObject, record: RecordData) => void;
  onToast: (toast: ToastState) => void;
  onListAction: (action: string, object: CrmObject, records: RecordData[], selectedIds: string[]) => void;
  onSaveRecord: SaveRecordHandler;
  onDataChange: ScopedCrmDataUpdater;
}) {
  const definition = OBJECT_DEFINITIONS[object];
  const objectPreferences = useMemo(
    () => data.listViewPreferences.filter((item) => item.object === object),
    [data.listViewPreferences, object]
  );
  const pinnedPreference = objectPreferences.find((item) => item.pinned);
  const [listView, setListView] = useState(
    String(initialListView || pinnedPreference?.viewName || definition.defaultList)
  );
  const [display, setDisplay] = useState<"Table" | "Kanban">("Table");
  const [query, setQuery] = useState(initialQuery);
  const [country, setCountry] = useState("");
  const [listViewSearch, setListViewSearch] = useState("");
  const [disabledMessage, setDisabledMessage] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [sortState, setSortState] = useState<ListSortState>(null);
  const [controlDialog, setControlDialog] = useState<string | null>(null);
  const [serverTotal, setServerTotal] = useState(records.length);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [pageSize, setPageSize] = useState(200);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCursors, setPageCursors] = useState<Array<string | null>>([null]);
  const listRequestIdRef = useRef(0);
  useShipmentTrackingSweep(object === "Opportunity", onDataChange);
  const listViews = useMemo(
    () =>
      Array.from(
        new Set([
          definition.defaultList,
          ...definition.listViews,
          ...objectPreferences.map((item) => String(item.viewName))
        ])
      ),
    [definition.defaultList, definition.listViews, objectPreferences]
  );
  const activePreference = objectPreferences.find((item) => item.viewName === listView);
  const activeColumns = columnsForListView(definition, activePreference);
  const sortableColumns = activeColumns
    .filter((column) => isServerSortableListColumn(object, column.key))
    .map((column) => column.key);
  const activeColumnWidths = columnWidthsForListView(activePreference);
  const activeFilters = filtersForListView(definition, activePreference);
  const activeSharing = normalizeListViewSharing(activePreference?.sharing);
  const chartType = String(activePreference?.chartType ?? "Bar");
  const chartField = String(
    activePreference?.chartField ?? activeColumns[0]?.key ?? definition.columns[0]?.key ?? "name"
  );
  const activeDefinition = { ...definition, columns: activeColumns };
  const kanbanConfig = kanbanConfigForObject(object);
  const contextualGuidance = guidanceItemForObject(object, data);
  const showContextualGuidance =
    data.userPreferences[0]?.guidanceEnabled !== false &&
    contextualGuidance &&
    isContextualGuidanceVisible(contextualGuidance);
  const isCustomListView = Boolean(activePreference?.isCustom);
  const isPinned = Boolean(activePreference?.pinned);
  const serverSortState = sortState && sortableColumns.includes(sortState.key) ? sortState : null;
  useEffect(() => {
    setListView(String(initialListView || pinnedPreference?.viewName || definition.defaultList));
    setQuery(initialQuery);
    setCountry("");
    setListViewSearch("");
    setSelected([]);
    setSortState(null);
    setControlDialog(null);
    setServerTotal(records.length);
    setNextCursor(null);
    setPageIndex(0);
    setPageCursors([null]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [object, initialQuery, initialListView]);
  useEffect(() => {
    setPageIndex(0);
    setPageCursors([null]);
    setNextCursor(null);
    const delay = query === initialQuery ? 0 : 250;
    const timer = window.setTimeout(() => void requestListPage(null, 0), delay);
    return () => {
      window.clearTimeout(timer);
      listRequestIdRef.current += 1;
    };
    // Fetching is intentionally keyed to the active server query. Parent callbacks are
    // omitted because their identities change when the scoped data collection changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, object, listView, pageSize, query, serverSortState?.key, serverSortState?.direction]);
  const visibleRecords = useMemo(() => {
    const filteredByCountry = records.filter(
      (record) => object !== "Lead" || recordMatchesCountryFilter(record, country)
    );
    const filteredByStandardView = filteredByCountry.filter((record) =>
      recordMatchesStandardListView(object, listView, record, data.globalSearchRecents, data.user.id)
    );
    const filteredBySavedFilters = filteredByStandardView.filter((record) =>
      activeFilters.every((filter) => recordMatchesListFilter(record, filter))
    );
    const filtered = filteredBySavedFilters.filter((record) =>
      Object.values(record).join(" ").toLowerCase().includes(query.toLowerCase())
    );
    if (!sortState || serverSortState) return filtered;
    return [...filtered].sort((a, b) => {
      const comparison = compareRecordValues(a[sortState.key], b[sortState.key]);
      return sortState.direction === "asc" ? comparison : -comparison;
    });
  }, [
    activeFilters,
    country,
    data.globalSearchRecents,
    data.user.id,
    listView,
    object,
    query,
    records,
    serverSortState,
    sortState
  ]);
  function listRequestUrl(cursor?: string | null) {
    const parameters = new URLSearchParams({ limit: String(pageSize), view: listView, search: query });
    if (object === "Lead" && country) parameters.set("country", country);
    if (cursor) parameters.set("cursor", cursor);
    if (serverSortState) {
      parameters.set("sort", serverSortState.key);
      parameters.set("direction", serverSortState.direction);
    }
    return `/api/records/${object}?${parameters.toString()}`;
  }
  async function requestListPage(cursor: string | null, targetPageIndex: number) {
    const requestId = ++listRequestIdRef.current;
    setListLoading(true);
    try {
      const result = await apiRequest<ListResult<GenericRecord>>(listRequestUrl(cursor));
      if (requestId !== listRequestIdRef.current) return false;
      const key = dataKeyForObject(object);
      onDataChange((previous) => {
        const incoming = result.items as RecordData[];
        return { ...previous, [key]: incoming } as ScopedCrmData;
      });
      setServerTotal(result.total);
      setNextCursor(result.nextCursor);
      setPageIndex(targetPageIndex);
      setPageCursors((current) => {
        const next = targetPageIndex === 0 ? [null] : current.slice(0, targetPageIndex + 1);
        next[targetPageIndex] = cursor;
        return next;
      });
      setSelected([]);
      return true;
    } catch (error) {
      if (requestId === listRequestIdRef.current) {
        onToast({ tone: "error", message: error instanceof Error ? error.message : "The list could not be loaded." });
      }
      return false;
    } finally {
      if (requestId === listRequestIdRef.current) setListLoading(false);
    }
  }
  async function refreshList() {
    if (await requestListPage(pageCursors[pageIndex] ?? null, pageIndex)) {
      onToast({ tone: "success", message: "List refreshed from the CRM." });
    }
  }
  async function nextPage() {
    if (!nextCursor || listLoading) return;
    await requestListPage(nextCursor, pageIndex + 1);
  }
  async function previousPage() {
    if (pageIndex < 1 || listLoading) return;
    const targetPageIndex = pageIndex - 1;
    await requestListPage(pageCursors[targetPageIndex] ?? null, targetPageIndex);
  }
  function changePageSize(value: number) {
    if (![50, 100, 200].includes(value) || value === pageSize) return;
    setPageSize(value);
  }
  const recentListViews = useMemo(
    () => listViews.slice(0, 2).filter((view) => listViewMatchesSearch(view, listViewSearch)),
    [listViewSearch, listViews]
  );
  const otherListViews = useMemo(
    () => listViews.slice(2).filter((view) => listViewMatchesSearch(view, listViewSearch)),
    [listViewSearch, listViews]
  );
  const sortedColumn = sortState
    ? (activeColumns.find((column) => column.key === sortState.key) ??
      definition.columns.find((column) => column.key === sortState.key))
    : activeColumns[0];
  const pageStart = serverTotal === 0 ? 0 : pageIndex * pageSize + 1;
  const pageEnd = serverTotal === 0 ? 0 : Math.min(pageStart + records.length - 1, serverTotal);
  const filteredStatus = visibleRecords.length === records.length ? "" : ` - ${visibleRecords.length} shown`;
  const status = `${pageStart}-${pageEnd} of ${serverTotal} items${filteredStatus} - Sorted by ${sortedColumn?.label ?? "Name"}${sortState ? ` ${sortState.direction === "asc" ? "Ascending" : "Descending"}` : ""}${country ? " - Filtered by Country" : ""}${activeFilters.length ? ` - Filtered by ${activeFilters.map((filter) => fieldLabel(String(filter.field))).join(", ")}` : ""} - Updated a few seconds ago`;
  const totalPages = Math.max(1, Math.ceil(serverTotal / pageSize));
  function applyListViewPreferences(nextPreferences: RecordData[]) {
    onDataChange((previous) => ({
      ...previous,
      listViewPreferences: [
        ...previous.listViewPreferences.filter((item) => item.object !== object),
        ...nextPreferences
      ]
    }));
  }
  function handleAction(action: string) {
    if (action === "New" || action === "New Quick Text" || action === "New Event") onCreate(object);
    else if (action === "Send Email") onCreate("ListEmail");
    else if (action === "Refresh") onToast({ tone: "success", message: "List refreshed." });
    else if (action === "Edit List") setControlDialog("Select Fields to Display");
    else if (action === "Charts" || action === "Filters" || action === "List View Controls") setControlDialog(action);
    else onListAction(action, object, visibleRecords, selected);
  }
  function sortColumn(column: string, direction?: "asc" | "desc") {
    if (visibleRecords.length < 1) {
      setDisabledMessage("Column sort is disabled until the list has at least one row.");
      return;
    }
    if (!sortableColumns.includes(column)) {
      setDisabledMessage("This derived column cannot be sorted across the complete list.");
      return;
    }
    setDisabledMessage("");
    setSortState((current) => {
      if (direction) return { key: column, direction };
      if (!current || current.key !== column) return { key: column, direction: "asc" };
      if (current.direction === "asc") return { key: column, direction: "desc" };
      return null;
    });
  }
  async function saveListViewPreference(values: {
    viewName: string;
    columns: string[];
    columnWidths?: Record<string, string>;
    filters?: RecordData[];
    chartType?: string;
    chartField?: string;
    pinned?: boolean;
    isCustom?: boolean;
    previousViewName?: string;
    sharing?: string;
  }) {
    const response = await resourceApi.saveListView({
      object,
      ...values,
      columnWidths: values.columnWidths ?? activeColumnWidths,
      filters: values.filters ?? activeFilters,
      chartType: values.chartType ?? chartType,
      chartField: values.chartField ?? chartField,
      pinned: values.pinned ?? (values.viewName === listView && isPinned),
      sharing: values.sharing
    });
    if (!Array.isArray(response?.listViewPreferences)) {
      onToast({ tone: "error", message: "List view couldn't be saved." });
      return false;
    }
    applyListViewPreferences(response.listViewPreferences as RecordData[]);
    setListView(values.viewName);
    setControlDialog(null);
    onToast({ tone: "success", message: `List view "${values.viewName}" saved.` });
    return true;
  }
  async function pinListView() {
    const response = await resourceApi.saveListView(
      {
        object,
        viewName: listView,
        columns: activeColumns.map((column) => column.key),
        columnWidths: activeColumnWidths,
        filters: activeFilters,
        chartType,
        chartField,
        isCustom: isCustomListView
      },
      true
    );
    if (!Array.isArray(response?.listViewPreferences)) {
      onToast({ tone: "error", message: "List view couldn't be pinned." });
      return;
    }
    applyListViewPreferences(response.listViewPreferences as RecordData[]);
    onToast({ tone: "success", message: `"${listView}" is now pinned.` });
  }
  async function deleteListViewPreference() {
    const response = await resourceApi.deleteListView({ object, viewName: listView });
    if (!Array.isArray(response?.listViewPreferences)) {
      onToast({ tone: "error", message: "List view couldn't be deleted." });
      return false;
    }
    applyListViewPreferences(response.listViewPreferences as RecordData[]);
    setListView(definition.defaultList);
    setControlDialog(null);
    onToast({ tone: "success", message: `List view "${listView}" deleted.` });
    return true;
  }
  function handleListViewControl(action: string) {
    if (action === "Reset Column Sorting") {
      setSortState(null);
      onToast({ tone: "success", message: "Column sorting reset." });
      return;
    }
    if (action === "Reset Column Widths") {
      void saveListViewPreference({
        viewName: listView,
        columns: activeColumns.map((column) => column.key),
        columnWidths: {},
        isCustom: isCustomListView
      }).then((saved) => {
        if (saved) onToast({ tone: "success", message: "Column widths reset." });
      });
      return;
    }
    setControlDialog(action);
  }
  async function hideColumn(columnKey: string) {
    if (activeColumns.length <= 1) {
      onToast({ tone: "warning", message: "At least one column must remain visible." });
      return;
    }
    const columns = activeColumns.map((column) => column.key).filter((key) => key !== columnKey);
    const saved = await saveListViewPreference({
      viewName: listView,
      columns,
      columnWidths: activeColumnWidths,
      isCustom: isCustomListView
    });
    if (saved) onToast({ tone: "success", message: "Column hidden." });
  }
  async function resizeColumn(columnKey: string, width: number) {
    const nextWidths = { ...activeColumnWidths, [columnKey]: `${Math.max(110, Math.min(520, Math.round(width)))}px` };
    await saveListViewPreference({
      viewName: listView,
      columns: activeColumns.map((column) => column.key),
      columnWidths: nextWidths,
      isCustom: isCustomListView
    });
  }
  async function resetColumnWidth(columnKey: string) {
    const nextWidths = { ...activeColumnWidths };
    delete nextWidths[columnKey];
    const saved = await saveListViewPreference({
      viewName: listView,
      columns: activeColumns.map((column) => column.key),
      columnWidths: nextWidths,
      isCustom: isCustomListView
    });
    if (saved) onToast({ tone: "success", message: "Column width reset." });
  }
  async function moveKanbanRecord(record: RecordData, value: string) {
    const id = requiredId(record);
    if (!kanbanConfig || !id || String(record[kanbanConfig.field] ?? "") === value) return false;
    return onSaveRecord(object, { [kanbanConfig.field]: value }, { id, stayOpen: true });
  }
  const columnSortDisabledReason =
    visibleRecords.length < 1
      ? "Column sort is disabled until the list has at least one row."
      : "None of the displayed columns can be sorted across the complete list.";
  async function updateContextualGuidance(status: string, snoozedUntil?: string | null) {
    if (!contextualGuidance?.id) return false;
    const response = await resourceApi.updateGuidance(String(contextualGuidance.id), {
      status,
      snoozedUntil
    });
    const state = response?.state as RecordData | undefined;
    if (!state?.id) {
      onToast({ tone: "error", message: "Guidance state couldn't be saved." });
      return false;
    }
    onDataChange((previous) => ({
      ...previous,
      guidanceStates: previous.guidanceStates.some((item) => item.id === state.id)
        ? previous.guidanceStates.map((item) => (item.id === state.id ? state : item))
        : [state, ...previous.guidanceStates]
    }));
    return true;
  }
  async function addSampleLeadFromGuidance() {
    if (object !== "Lead") return;
    const suffix = Date.now().toString().slice(-5);
    const saved = await onSaveRecord(
      "Lead",
      {
        firstName: "Avery",
        lastName: `Sample ${suffix}`,
        company: "Sample Lead Co",
        title: "Operations Buyer",
        status: "New",
        rating: "Warm",
        phone: "+1 555 0142",
        email: `avery.sample.${suffix}@example.test`,
        leadSource: "Web",
        ownerId: data.user.id
      },
      { stayOpen: true }
    );
    if (saved) {
      await updateContextualGuidance("DONE", null);
      onToast({ tone: "success", message: "Sample lead added and guidance completed." });
    }
  }
  return {
    object,
    recordLabels,
    campaignMembers,
    onCreate,
    onEdit,
    onDelete,
    onListAction,
    onSaveRecord,
    definition,
    listView,
    setListView,
    display,
    setDisplay,
    query,
    setQuery,
    country,
    setCountry,
    listViewSearch,
    setListViewSearch,
    disabledMessage,
    setDisabledMessage,
    selected,
    setSelected,
    sortState,
    controlDialog,
    setControlDialog,
    activeColumns,
    sortableColumns,
    activeColumnWidths,
    activeFilters,
    activeSharing,
    chartType,
    chartField,
    activeDefinition,
    kanbanConfig,
    contextualGuidance,
    showContextualGuidance,
    isCustomListView,
    isPinned,
    visibleRecords,
    serverTotal,
    nextCursor,
    listLoading,
    pageSize,
    currentPage: pageIndex + 1,
    totalPages,
    canGoPrevious: pageIndex > 0,
    canGoNext: Boolean(nextCursor),
    refreshList,
    previousPage,
    nextPage,
    changePageSize,
    recentListViews,
    otherListViews,
    status,
    handleAction,
    sortColumn,
    saveListViewPreference,
    pinListView,
    deleteListViewPreference,
    handleListViewControl,
    hideColumn,
    resizeColumn,
    resetColumnWidth,
    moveKanbanRecord,
    columnSortDisabledReason,
    updateContextualGuidance,
    addSampleLeadFromGuidance
  };
}

export type ListViewPageModel = ReturnType<typeof useListViewController>;
export type ListViewPageProps = Parameters<typeof useListViewController>[0];
