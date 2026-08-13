"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { type ObjectDefinition, type RecordData } from "@/lib/crm-types";
import { cn } from "@/lib/utils";
import { BaseDialog, Button } from "@/components/ui/crm-primitives";
import { checkboxClass, FieldShell, inputClass, NativeSelect } from "@/features/crm/controls";
import { fieldLabel } from "@/features/crm/form-model";
import { chartDataForRecords } from "@/features/crm/list-model";

export function ListViewPreferenceModal({
  action,
  definition,
  listView,
  activeColumns,
  columnWidths,
  activeFilters,
  records,
  chartType,
  chartField,
  isCustom,
  onClose,
  onSave,
  onDelete
}: {
  action: string;
  definition: ObjectDefinition;
  listView: string;
  activeColumns: string[];
  columnWidths: Record<string, string>;
  activeFilters: RecordData[];
  records: RecordData[];
  chartType: string;
  chartField: string;
  isCustom: boolean;
  onClose: () => void;
  onSave: (values: {
    viewName: string;
    columns: string[];
    columnWidths?: Record<string, string>;
    filters?: RecordData[];
    chartType?: string;
    chartField?: string;
    pinned?: boolean;
    isCustom?: boolean;
    previousViewName?: string;
  }) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
}) {
  const defaultName =
    action === "New" ? `New ${definition.label} List` : action === "Clone" ? `${listView} Clone` : listView;
  const [viewName, setViewName] = useState(defaultName);
  const [columns, setColumns] = useState<string[]>(
    activeColumns.length ? activeColumns : definition.columns.map((column) => column.key)
  );
  const [filters, setFilters] = useState<RecordData[]>(
    activeFilters.length
      ? activeFilters
      : [{ field: definition.columns[0]?.key ?? "name", operator: "contains", value: "" }]
  );
  const [selectedChartType, setSelectedChartType] = useState(chartType);
  const [selectedChartField, setSelectedChartField] = useState(chartField);
  const [error, setError] = useState("");
  const isFieldAction =
    action === "Select Fields to Display" || action === "New" || action === "Clone" || action === "Rename";
  const chartRows = chartDataForRecords(records, selectedChartField);

  function toggleColumn(column: string) {
    setColumns((current) =>
      current.includes(column) ? current.filter((item) => item !== column) : [...current, column]
    );
  }

  async function submit() {
    if ((action === "New" || action === "Clone" || action === "Rename") && !viewName.trim()) {
      setError("Complete this field.");
      return;
    }
    if (columns.length === 0) {
      setError("Select at least one field.");
      return;
    }
    const targetName = action === "Select Fields to Display" ? listView : viewName.trim();
    await onSave({
      viewName: targetName,
      columns,
      columnWidths,
      isCustom: action === "New" || action === "Clone" || (action === "Rename" ? isCustom : isCustom),
      previousViewName: action === "Rename" && isCustom && targetName !== listView ? listView : undefined
    });
  }

  async function saveFilters() {
    const cleanFilters = filters
      .map((filter) => ({
        field: String(filter.field ?? ""),
        operator: String(filter.operator ?? "contains"),
        value: String(filter.value ?? "")
      }))
      .filter((filter) => filter.field && (filter.operator === "is-empty" || filter.value));
    await onSave({ viewName: listView, columns, columnWidths, filters: cleanFilters, isCustom });
  }

  async function saveChart() {
    await onSave({
      viewName: listView,
      columns,
      columnWidths,
      filters: activeFilters,
      chartType: selectedChartType,
      chartField: selectedChartField,
      isCustom
    });
  }

  if (action === "Delete") {
    return (
      <BaseDialog
        open
        title={`Delete ${listView}?`}
        onClose={onClose}
        footer={
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="destructive" onClick={() => onDelete()}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-[#444]">
          This removes the custom list view for you. Records in the list are not deleted.
        </p>
      </BaseDialog>
    );
  }

  if (action === "Filters") {
    return (
      <BaseDialog
        open
        title="Filters"
        onClose={onClose}
        onEnterAction={saveFilters}
        wide
        footer={
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              onClick={() =>
                setFilters([{ field: definition.columns[0]?.key ?? "name", operator: "contains", value: "" }])
              }
            >
              Reset
            </Button>
            <Button variant="primary" onClick={() => saveFilters()}>
              Save Filters
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {filters.map((filter, index) => (
            <div
              key={index}
              className="grid gap-2 rounded border border-[#d8dde6] p-3 md:grid-cols-[1fr_160px_1fr_auto]"
            >
              <NativeSelect
                options={definition.columns.map((column) => ({ value: column.key, label: column.label }))}
                value={String(filter.field ?? "")}
                onChange={(next) =>
                  setFilters((current) =>
                    current.map((item, itemIndex) => (itemIndex === index ? { ...item, field: next } : item))
                  )
                }
              />
              <NativeSelect
                options={[
                  { value: "contains", label: "Contains" },
                  { value: "equals", label: "Equals" },
                  { value: "not-equals", label: "Not equal to" },
                  { value: "starts-with", label: "Starts with" },
                  { value: "is-empty", label: "Is empty" }
                ]}
                value={String(filter.operator ?? "contains")}
                onChange={(next) =>
                  setFilters((current) =>
                    current.map((item, itemIndex) => (itemIndex === index ? { ...item, operator: next } : item))
                  )
                }
              />
              <input
                className={inputClass}
                value={String(filter.value ?? "")}
                disabled={filter.operator === "is-empty"}
                onChange={(event) =>
                  setFilters((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, value: event.target.value } : item
                    )
                  )
                }
                placeholder="Filter value"
              />
              <button
                className="rounded p-2 text-[#706e6b] hover:bg-[#f3f3f3] hover:text-[#ba0517]"
                aria-label="Remove filter"
                onClick={() => setFilters((current) => current.filter((_, itemIndex) => itemIndex !== index))}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <Button
            onClick={() =>
              setFilters((current) => [
                ...current,
                { field: definition.columns[0]?.key ?? "name", operator: "contains", value: "" }
              ])
            }
          >
            Add Filter
          </Button>
        </div>
      </BaseDialog>
    );
  }

  if (action === "Charts") {
    const maxCount = Math.max(1, ...chartRows.map((row) => row.count));
    return (
      <BaseDialog
        open
        title="Charts"
        onClose={onClose}
        onEnterAction={saveChart}
        wide
        footer={
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={() => saveChart()}>
              Save Chart
            </Button>
          </>
        }
      >
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <div className="grid gap-3 self-start rounded border border-[#d8dde6] p-3">
            <FieldShell label="Chart Type">
              <NativeSelect
                options={["Bar", "Donut", "Metric"]}
                value={selectedChartType}
                onChange={setSelectedChartType}
              />
            </FieldShell>
            <FieldShell label="Group By">
              <NativeSelect
                options={definition.columns.map((column) => column.key)}
                value={selectedChartField}
                onChange={setSelectedChartField}
              />
            </FieldShell>
            <div className="text-xs text-[#706e6b]">
              Showing {records.length} record{records.length === 1 ? "" : "s"} after search and filters.
            </div>
          </div>
          <div className="rounded border border-[#d8dde6] p-4">
            <div className="mb-3 font-semibold">
              {definition.plural} by {fieldLabel(selectedChartField)}
            </div>
            {selectedChartType === "Metric" ? (
              <div className="rounded bg-brand-50 p-6 text-center">
                <div className="text-4xl font-semibold text-brand-700">{records.length}</div>
                <div className="text-sm text-[#706e6b]">Total records in current result</div>
              </div>
            ) : (
              <div className="space-y-2">
                {chartRows.map((row) => (
                  <div key={row.label} className="grid grid-cols-[140px_1fr_40px] items-center gap-2 text-sm">
                    <div className="truncate text-[#514f4d]">{row.label}</div>
                    <div className="h-5 rounded bg-[#eef1f6]">
                      <div
                        className={cn("h-5 rounded bg-brand-500", selectedChartType === "Donut" && "rounded-full")}
                        style={{ width: `${Math.max(8, (row.count / maxCount) * 100)}%` }}
                      />
                    </div>
                    <div className="text-right font-semibold">{row.count}</div>
                  </div>
                ))}
                {chartRows.length === 0 && (
                  <div className="rounded border border-dashed border-[#d8dde6] p-6 text-center text-sm text-[#706e6b]">
                    No records match the current filters.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </BaseDialog>
    );
  }

  return (
    <BaseDialog
      open
      title={action === "Select Fields to Display" ? "Select Fields to Display" : `${action} List View`}
      onClose={onClose}
      onEnterAction={submit}
      wide
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => submit()}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        {(action === "New" || action === "Clone" || action === "Rename") && (
          <FieldShell label="List Name" required error={error}>
            <input className={inputClass} value={viewName} onChange={(event) => setViewName(event.target.value)} />
          </FieldShell>
        )}
        {isFieldAction && (
          <div>
            <div className="mb-2 text-sm font-semibold">Visible Fields</div>
            <div className="grid gap-2 md:grid-cols-2">
              {definition.columns.map((column) => (
                <label key={column.key} className="flex items-center gap-2 rounded border border-[#d8dde6] p-2 text-sm">
                  <input
                    type="checkbox"
                    checked={columns.includes(column.key)}
                    onChange={() => toggleColumn(column.key)}
                    className={checkboxClass}
                  />
                  {column.label}
                </label>
              ))}
            </div>
            {error && !(action === "New" || action === "Clone" || action === "Rename") && (
              <p className="mt-2 text-xs text-[#ba0517]">{error}</p>
            )}
          </div>
        )}
      </div>
    </BaseDialog>
  );
}
