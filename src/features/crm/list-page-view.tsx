"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  ChevronDown,
  ChevronsUpDown,
  Columns3,
  Edit3,
  Filter,
  LayoutDashboard,
  Pin,
  Plus,
  RefreshCw,
  Search
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, ToolbarButton } from "@/components/ui/crm-primitives";
import { GuidanceCard, inputBareClass, inputClass, ListViewControlsMenu, ObjectIcon } from "@/features/crm/controls";
import { DataGrid, EmptyState } from "@/features/crm/data-grid";
import { KanbanBoard, KanbanUnavailable } from "@/features/crm/kanban";
import { LeadCountryFilter } from "@/features/crm/lead-country-filter";
import { ListViewPreferenceModal } from "@/features/crm/list-preferences";
import { requiredId } from "@/features/crm/record-model";
import { type ListViewPageModel } from "@/features/crm/list-page-controller";

export function ListView({ model }: { model: ListViewPageModel }) {
  const {
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
    listLoading,
    pageSize,
    currentPage,
    totalPages,
    canGoPrevious,
    canGoNext,
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
  } = model;

  return (
    <section className="space-y-3">
      <div className="rounded-lg border border-[#e4e7ec] bg-white shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#d8dde6] p-3">
          <div className="flex items-start gap-3">
            <ObjectIcon definition={definition} />
            <div>
              <div className="text-xs text-[#706e6b]">{definition.plural}</div>
              <div className="flex items-center gap-2">
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button
                      className="flex items-center gap-1 text-xl font-semibold text-[#181818]"
                      aria-label={`Select a List View: ${definition.plural}`}
                    >
                      {listView} <ChevronDown size={16} />
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content className="z-50 w-72 rounded border border-[#d8dde6] bg-white p-2 shadow-popover">
                      <input
                        className={cn(inputClass, "mb-2")}
                        placeholder="Search lists..."
                        value={listViewSearch}
                        onChange={(event) => setListViewSearch(event.target.value)}
                      />
                      <div className="px-2 py-1 text-xs font-semibold uppercase text-[#706e6b]">Recent List Views</div>
                      {recentListViews.map((view) => (
                        <DropdownMenu.Item
                          key={view}
                          onSelect={() => setListView(view)}
                          className="cursor-pointer rounded px-2 py-2 text-sm hover:bg-brand-50"
                        >
                          {view}
                        </DropdownMenu.Item>
                      ))}
                      <div className="px-2 py-1 text-xs font-semibold uppercase text-[#706e6b]">All Other Lists</div>
                      {otherListViews.map((view) => (
                        <DropdownMenu.Item
                          key={view}
                          onSelect={() => setListView(view)}
                          className="cursor-pointer rounded px-2 py-2 text-sm hover:bg-brand-50"
                        >
                          {view}
                        </DropdownMenu.Item>
                      ))}
                      {recentListViews.length === 0 && otherListViews.length === 0 && (
                        <div className="px-2 py-3 text-sm text-[#706e6b]">No list views found.</div>
                      )}
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
                <button
                  className="flex h-7 w-7 items-center justify-center rounded text-brand-700 hover:bg-brand-50"
                  aria-label={isPinned ? "This list is pinned." : "Pin this list view."}
                  onClick={() => void pinListView()}
                >
                  <Pin size={15} fill={isPinned ? "currentColor" : "none"} />
                </button>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-1">
            {definition.actions
              .filter((action) => action !== "Assign Label" || selected.length > 0)
              .map((action) => (
                <Button
                  key={action}
                  variant={
                    action === "New" || action === "New Quick Text" || action === "New Event" ? "primary" : "secondary"
                  }
                  onClick={() => handleAction(action)}
                >
                  {action === "New" && <Plus size={14} />}
                  {object === "Invoice" && action === "New" ? "New Invoice" : action}
                </Button>
              ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 p-3">
          <div className="text-xs text-[#706e6b]">{status}</div>
          <div className="flex items-center gap-2">
            {object === "Lead" && <LeadCountryFilter value={country} onChange={setCountry} />}
            <div className="flex h-8 items-center rounded border border-[#c9c9c9] bg-white px-2">
              <Search size={14} className="text-[#706e6b]" />
              <input
                name={definition.searchInputName}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className={cn(inputBareClass, "w-56")}
                placeholder="Search this list..."
              />
            </div>
            <ListViewControlsMenu
              object={object}
              listView={listView}
              isCustom={isCustomListView}
              onAction={handleListViewControl}
            />
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  className="flex h-8 items-center gap-1 rounded border border-[#c9c9c9] px-2 text-xs hover:bg-[#f3f3f3]"
                  aria-label="Select list display"
                >
                  <Columns3 size={14} />
                  {display}
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content className="z-50 rounded border border-[#d8dde6] bg-white p-1 shadow-popover">
                  {["Table", "Kanban"].map((mode) => (
                    <DropdownMenu.Item
                      key={mode}
                      onSelect={() => setDisplay(mode as "Table" | "Kanban")}
                      className="cursor-pointer rounded px-3 py-2 text-sm hover:bg-brand-50"
                    >
                      {mode}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
            <ToolbarButton label="Refresh" icon={RefreshCw} onClick={() => void refreshList()} />
            <ToolbarButton
              label="Column sort"
              icon={ChevronsUpDown}
              disabled={visibleRecords.length < 1 || sortableColumns.length < 1}
              disabledReason={columnSortDisabledReason}
              onDisabled={() => setDisabledMessage(columnSortDisabledReason)}
              onClick={() => sortColumn(sortableColumns[0] ?? "name")}
            />
            <ToolbarButton
              label="Edit List"
              icon={Edit3}
              onClick={() => setControlDialog("Select Fields to Display")}
            />
            <ToolbarButton label="Charts" icon={LayoutDashboard} onClick={() => setControlDialog("Charts")} />
            <ToolbarButton label="Filters" icon={Filter} onClick={() => setControlDialog("Filters")} />
          </div>
        </div>
        {disabledMessage && (
          <div className="mx-3 mb-2 rounded border border-[#f1c40f] bg-[#fff7d6] px-3 py-2 text-xs text-[#5f4b00]">
            {disabledMessage}
          </div>
        )}
        {definition.disabledInlineEditMessage && (
          <div className="mx-3 mb-2 rounded border border-[#d8dde6] bg-[#f8f8f8] px-3 py-2 text-xs text-[#706e6b]">
            {definition.disabledInlineEditMessage}
          </div>
        )}
        {display === "Kanban" && kanbanConfig ? (
          <KanbanBoard
            definition={activeDefinition}
            records={visibleRecords}
            config={kanbanConfig}
            onMove={moveKanbanRecord}
            onEdit={onEdit}
            onDelete={onDelete}
            onChangeOwner={(record) => onListAction("Change Owner", object, [record], [requiredId(record)])}
            onConvertLead={(record) => onListAction("Convert Lead", object, [record], [requiredId(record)])}
          />
        ) : display === "Kanban" ? (
          <KanbanUnavailable definition={definition} records={visibleRecords} />
        ) : (
          <DataGrid
            definition={activeDefinition}
            records={visibleRecords}
            selected={selected}
            recordLabels={recordLabels}
            campaignMembers={campaignMembers}
            onSelect={setSelected}
            sortState={sortState}
            sortableColumns={sortableColumns}
            onSort={sortColumn}
            onHideColumn={(columnKey) => void hideColumn(columnKey)}
            onResizeColumn={(columnKey, width) => void resizeColumn(columnKey, width)}
            onResetColumnWidth={(columnKey) => void resetColumnWidth(columnKey)}
            onInlineSave={(record, key, value) =>
              onSaveRecord(object, { [key]: value }, { id: requiredId(record), stayOpen: true })
            }
            onEdit={onEdit}
            onDelete={onDelete}
            onChangeOwner={(record) => onListAction("Change Owner", object, [record], [requiredId(record)])}
            onConvertLead={(record) => onListAction("Convert Lead", object, [record], [requiredId(record)])}
          />
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#d8dde6] bg-[#f8f9fb] p-3">
          <label className="flex items-center gap-2 text-xs text-[#706e6b]">
            Rows per page
            <select
              aria-label="Rows per page"
              className="h-8 rounded border border-[#c9c9c9] bg-white px-2 text-xs text-[#181818]"
              disabled={listLoading}
              value={pageSize}
              onChange={(event) => changePageSize(Number(event.target.value))}
            >
              {[50, 100, 200].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <div className="text-xs text-[#706e6b]">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex gap-2">
            <Button disabled={!canGoPrevious || listLoading} onClick={previousPage}>
              Previous
            </Button>
            <Button disabled={!canGoNext || listLoading} onClick={nextPage}>
              {listLoading ? "Loading…" : "Next"}
            </Button>
          </div>
        </div>
      </div>
      {visibleRecords.length === 0 && <EmptyState definition={definition} onCreate={() => onCreate(object)} />}
      {showContextualGuidance && (
        <GuidanceCard
          title={String(contextualGuidance?.title ?? "Add a lead")}
          body={String(
            contextualGuidance?.body ??
              "First enter and save a few details about the lead. You can add a sample lead, snooze this guidance, drag it, or dismiss it."
          )}
          onSnooze={() =>
            void updateContextualGuidance("SNOOZED", new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())
          }
          onDismiss={() => void updateContextualGuidance("DISMISSED", null)}
          onComplete={object === "Lead" ? () => void addSampleLeadFromGuidance() : undefined}
        />
      )}
      {controlDialog && (
        <ListViewPreferenceModal
          action={controlDialog}
          definition={definition}
          listView={listView}
          activeColumns={activeColumns.map((column) => column.key)}
          columnWidths={activeColumnWidths}
          activeFilters={activeFilters}
          records={visibleRecords}
          chartType={chartType}
          chartField={chartField}
          activeSharing={activeSharing}
          isCustom={isCustomListView}
          onClose={() => setControlDialog(null)}
          onSave={saveListViewPreference}
          onDelete={deleteListViewPreference}
          onControlAction={handleListViewControl}
        />
      )}
    </section>
  );
}
