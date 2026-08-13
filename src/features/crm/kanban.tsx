"use client";

import { GripVertical } from "lucide-react";
import { useMemo, useState } from "react";
import { recordTitle } from "@/lib/crm-data";
import { type CrmObject, type ObjectDefinition, type RecordData } from "@/lib/crm-types";
import { cn } from "@/lib/utils";
import { NativeSelect } from "@/features/crm/controls";
import { RowActions } from "@/features/crm/data-grid";
import { formatCell, groupBy } from "@/features/crm/form-model";
import { formatKanbanSummary, numberFromRecord } from "@/features/crm/list-model";
import { requiredId } from "@/features/crm/record-model";
import { type KanbanConfig } from "@/features/crm/shared-types";

export function KanbanBoard({
  definition,
  records,
  config,
  onMove,
  onEdit,
  onDelete,
  onChangeOwner,
  onConvertLead
}: {
  definition: ObjectDefinition;
  records: RecordData[];
  config: KanbanConfig;
  onMove: (record: RecordData, value: string) => Promise<boolean>;
  onEdit: (object: CrmObject, record: RecordData) => void;
  onDelete: (object: CrmObject, record: RecordData) => void;
  onChangeOwner?: (record: RecordData) => void;
  onConvertLead?: (record: RecordData) => void;
}) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const titleColumn = definition.columns[0]?.key;
  const detailColumns = definition.columns
    .filter((column) => column.key !== titleColumn && column.key !== config.field)
    .slice(0, 3);
  const groupedRecords = useMemo(
    () => groupBy(records, (record) => String(record[config.field] ?? "")),
    [config.field, records]
  );
  const ungroupedRecords = records.filter((record) => !config.values.includes(String(record[config.field] ?? "")));
  const columns = [
    ...config.values.map((value) => ({
      key: value,
      label: value,
      value,
      records: groupedRecords[value] ?? [],
      acceptsDrop: true
    })),
    ...(ungroupedRecords.length > 0
      ? [{ key: "__none__", label: `No ${config.label}`, value: "", records: ungroupedRecords, acceptsDrop: false }]
      : [])
  ];

  async function commitMove(record: RecordData, value: string) {
    const id = requiredId(record);
    if (!id || movingId) return;
    setMovingId(id);
    try {
      await onMove(record, value);
    } finally {
      setMovingId(null);
    }
  }

  function handleDrop(value: string, acceptsDrop: boolean) {
    if (!acceptsDrop || !draggedId) return;
    const record = records.find((item) => requiredId(item) === draggedId);
    if (record) void commitMove(record, value);
    setDraggedId(null);
  }

  if (records.length === 0) {
    return (
      <div className="border-t border-[#d8dde6] p-8 text-center text-sm text-[#706e6b]">
        No records match this list view.
      </div>
    );
  }

  return (
    <div className="slds-scrollbar flex min-h-[28rem] gap-3 overflow-x-auto border-t border-[#d8dde6] bg-[#f3f3f3] p-3">
      {columns.map((column) => {
        const summary = config.summaryField
          ? column.records.reduce((total, record) => total + numberFromRecord(record[config.summaryField!]), 0)
          : null;
        return (
          <section
            key={column.key}
            className={cn(
              "flex w-72 shrink-0 flex-col rounded-lg border border-[#e4e7ec] bg-[#f8f9fb] shadow-card transition-shadow duration-150",
              draggedId && column.acceptsDrop && "ring-2 ring-brand-400/70 ring-offset-1"
            )}
            onDragOver={(event) => {
              if (column.acceptsDrop) event.preventDefault();
            }}
            onDrop={() => handleDrop(column.value, column.acceptsDrop)}
            aria-label={`${column.label} ${config.label}`}
          >
            <div className="flex min-h-12 items-center justify-between gap-2 border-b border-[#d8dde6] bg-white px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-[#181818]">{column.label}</div>
                <div className="text-xs text-[#706e6b]">
                  {column.records.length} {column.records.length === 1 ? "record" : "records"}
                </div>
              </div>
              {summary !== null && (
                <div className="shrink-0 text-xs font-semibold text-[#2e844a]">{formatKanbanSummary(summary)}</div>
              )}
            </div>
            <div className="slds-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto p-2" role="list">
              {column.records.map((record) => {
                const id = requiredId(record);
                const currentValue = String(record[config.field] ?? "");
                const isMoving = movingId === id;
                return (
                  <article
                    key={id}
                    role="listitem"
                    draggable={!isMoving}
                    onDragStart={() => setDraggedId(id)}
                    onDragEnd={() => setDraggedId(null)}
                    className={cn(
                      "cursor-grab rounded-md border border-[#e4e7ec] bg-white p-2 shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card-hover active:cursor-grabbing",
                      draggedId === id && "rotate-1 scale-[1.02] opacity-70 shadow-card-hover",
                      isMoving && "opacity-70"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <GripVertical size={14} className="mt-0.5 shrink-0 text-[#706e6b]" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-brand-700">
                          {recordTitle(definition.object, record)}
                        </div>
                        <div className="mt-1 space-y-1">
                          {detailColumns.map((columnDefinition) => (
                            <div
                              key={columnDefinition.key}
                              className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2 text-xs"
                            >
                              <span className="truncate text-[#706e6b]">{columnDefinition.label}</span>
                              <span className="truncate text-[#181818]">
                                {formatCell(record[columnDefinition.key]) || "-"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <RowActions
                        object={definition.object}
                        record={record}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onChangeOwner={onChangeOwner}
                        onConvertLead={onConvertLead}
                      />
                    </div>
                    <label className="mt-3 block text-xs text-[#706e6b]">
                      {config.label}
                      <NativeSelect
                        className="mt-1"
                        value={currentValue}
                        disabled={isMoving}
                        options={[
                          ...(!config.values.includes(currentValue)
                            ? [{ value: currentValue, label: currentValue || `No ${config.label}` }]
                            : []),
                          ...config.values
                        ]}
                        onChange={(next) => void commitMove(record, next)}
                        aria-label={`Move ${recordTitle(definition.object, record)} by ${config.label}`}
                      />
                    </label>
                  </article>
                );
              })}
              {column.records.length === 0 && (
                <div className="flex h-24 items-center justify-center rounded border border-dashed border-[#c9c9c9] bg-white/70 text-xs text-[#706e6b]">
                  Drop records here
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
