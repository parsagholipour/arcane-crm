import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ListView } from "@/features/crm/list-page-view";
import { type ListViewPageModel } from "@/features/crm/list-page-controller";
import { OBJECT_DEFINITIONS } from "@/lib/crm-metadata";

function loadingLeadListModel(): ListViewPageModel {
  const definition = OBJECT_DEFINITIONS.Lead;
  const activeColumns = definition.columns.map((column) => ({
    ...column,
    width: column.width ?? "150px"
  }));
  const noop = vi.fn();

  return {
    object: "Lead",
    recordLabels: {},
    campaignMembers: {},
    onCreate: noop,
    onEdit: noop,
    onDelete: noop,
    onListAction: noop,
    onSaveRecord: vi.fn().mockResolvedValue(true),
    definition,
    listView: definition.defaultList,
    setListView: noop,
    display: "Table",
    setDisplay: noop,
    query: "",
    setQuery: noop,
    country: "Canada",
    setCountry: noop,
    state: "",
    setState: noop,
    listViewSearch: "",
    setListViewSearch: noop,
    disabledMessage: "",
    setDisabledMessage: noop,
    selected: [],
    setSelected: noop,
    sortState: null,
    controlDialog: null,
    setControlDialog: noop,
    activeColumns,
    sortableColumns: definition.columns.map((column) => column.key),
    activeColumnWidths: {},
    activeFilters: [],
    activeSharing: "Only I can see this list view",
    chartType: "Bar",
    chartField: definition.columns[0].key,
    activeDefinition: { ...definition, columns: activeColumns },
    kanbanConfig: null,
    contextualGuidance: undefined,
    showContextualGuidance: false,
    isCustomListView: false,
    isPinned: false,
    visibleRecords: [],
    serverTotal: 0,
    nextCursor: null,
    listLoading: true,
    pageSize: 200,
    currentPage: 1,
    totalPages: 1,
    canGoPrevious: false,
    canGoNext: false,
    refreshList: vi.fn().mockResolvedValue(undefined),
    previousPage: vi.fn().mockResolvedValue(undefined),
    nextPage: vi.fn().mockResolvedValue(undefined),
    changePageSize: noop,
    recentListViews: [],
    otherListViews: [],
    status: "0-0 of 0 items",
    handleAction: noop,
    sortColumn: noop,
    saveListViewPreference: vi.fn().mockResolvedValue(true),
    pinListView: vi.fn().mockResolvedValue(undefined),
    deleteListViewPreference: vi.fn().mockResolvedValue(true),
    handleListViewControl: noop,
    hideColumn: vi.fn().mockResolvedValue(undefined),
    resizeColumn: vi.fn().mockResolvedValue(undefined),
    resetColumnWidth: vi.fn().mockResolvedValue(undefined),
    moveKanbanRecord: vi.fn().mockResolvedValue(false),
    columnSortDisabledReason: "Column sort is disabled until the list has at least one row.",
    updateContextualGuidance: vi.fn().mockResolvedValue(false),
    addSampleLeadFromGuidance: vi.fn().mockResolvedValue(undefined)
  };
}

describe("ListView loading state", () => {
  it("shows progress and suppresses the empty state while filtered leads load", () => {
    const model = loadingLeadListModel();
    render(<ListView model={model} />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading leads…");
    expect(screen.queryByRole("heading", { name: model.definition.emptyTitle })).not.toBeInTheDocument();
  });
});
