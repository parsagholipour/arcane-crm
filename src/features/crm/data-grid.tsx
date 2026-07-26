"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, ChevronsUpDown, Edit3, Eye, MoreHorizontal, PanelLeft, Plus, Target, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { recordTitle, routeForRecord } from "@/lib/crm-data";
import { type CrmObject, type ObjectDefinition, type RecordData } from "@/lib/crm-types";
import { cn } from "@/lib/utils";
import { InvoiceStatusBadge } from "@/components/crm/InvoiceWorkspace";
import { CommunicationsStatusBadge } from "@/components/crm/CommunicationsWorkspace";
import { CampaignStatusBadge } from "@/components/crm/CampaignWorkspace";
import { Button } from "@/components/ui/crm-primitives";
import { checkboxClass, inputClass } from "@/features/crm/controls";
import { formatListCell } from "@/features/crm/form-model";
import { parseColumnWidth } from "@/features/crm/list-model";
import {
  canChangeOwnerFromRow,
  canDeleteFromRow,
  canEditFromRow,
  canRouteToRecord,
  inlineEditableFieldForColumn,
  requiredId
} from "@/features/crm/record-model";
import { type InlineEditingCell, type ListSortState } from "@/features/crm/shared-types";

export function DataGrid({
  definition,
  records,
  selected,
  sortState,
  recordLabels = {},
  campaignMembers = {},
  onSelect,
  onSort,
  onHideColumn,
  onResizeColumn,
  onResetColumnWidth,
  onInlineSave,
  onEdit,
  onDelete,
  onChangeOwner,
  onConvertLead
}: {
  definition: ObjectDefinition;
  records: RecordData[];
  selected: string[];
  sortState?: ListSortState;
  recordLabels?: Record<string, string[]>;
  campaignMembers?: Record<string, string[]>;
  onSelect: (selected: string[]) => void;
  onSort: (column: string, direction?: "asc" | "desc") => void;
  onHideColumn?: (column: string) => void;
  onResizeColumn?: (column: string, width: number) => void;
  onResetColumnWidth?: (column: string) => void;
  onInlineSave?: (record: RecordData, key: string, value: string) => Promise<boolean>;
  onEdit: (object: CrmObject, record: RecordData) => void;
  onDelete: (object: CrmObject, record: RecordData) => void;
  onChangeOwner?: (record: RecordData) => void;
  onConvertLead?: (record: RecordData) => void;
}) {
  const allSelected = records.length > 0 && selected.length === records.length;
  const [editingCell, setEditingCell] = useState<InlineEditingCell>(null);
  const cancelInlineEditRef = useRef(false);

  async function commitInlineEdit() {
    if (cancelInlineEditRef.current) {
      cancelInlineEditRef.current = false;
      return;
    }
    if (!editingCell || !onInlineSave) return;
    const record = records.find((item) => requiredId(item) === editingCell.recordId);
    if (!record) {
      setEditingCell(null);
      return;
    }
    const currentValue = String(record[editingCell.key] ?? "");
    if (editingCell.value === currentValue) {
      setEditingCell(null);
      return;
    }
    const saved = await onInlineSave(record, editingCell.key, editingCell.value);
    if (saved) setEditingCell(null);
  }

  function startInlineEdit(record: RecordData, column: ObjectDefinition["columns"][number]) {
    const key = inlineEditableFieldForColumn(definition.object, column.key);
    if (!key || !onInlineSave) {
      onEdit(definition.object, record);
      return;
    }
    setEditingCell({ recordId: requiredId(record), key, value: String(record[key] ?? "") });
  }

  function startColumnResize(column: ObjectDefinition["columns"][number], event: ReactPointerEvent<HTMLButtonElement>) {
    if (!onResizeColumn) return;
    const resizeColumn: NonNullable<typeof onResizeColumn> = onResizeColumn;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = parseColumnWidth(column.width);
    const pointerId = event.pointerId;
    const target = event.currentTarget;
    target.setPointerCapture(pointerId);

    function move(moveEvent: PointerEvent) {
      const nextWidth = startWidth + moveEvent.clientX - startX;
      target.style.setProperty("--resize-preview-width", `${Math.max(110, Math.min(520, nextWidth))}px`);
    }

    function up(upEvent: PointerEvent) {
      if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      resizeColumn(column.key, startWidth + upEvent.clientX - startX);
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-t border-[#d8dde6] text-sm">
        <thead className="bg-[#f3f3f3] text-xs text-[#514f4d]">
          <tr>
            <th className="w-10 border-r border-[#d8dde6] px-3 py-2 text-left">
              <input
                className={checkboxClass}
                type="checkbox"
                checked={allSelected}
                onChange={(event) => onSelect(event.target.checked ? records.map((record) => requiredId(record)) : [])}
                aria-label={`Select all ${definition.plural}`}
              />
            </th>
            {definition.columns.map((column) => (
              <th
                key={column.key}
                className="border-r border-[#d8dde6] px-3 py-2 text-left"
                style={{ minWidth: column.width ?? "150px", width: column.width ?? "150px" }}
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    className="flex items-center gap-1 font-semibold hover:text-brand-700"
                    onClick={() => onSort(column.key)}
                  >
                    {column.label}
                    <ChevronsUpDown size={12} className={cn(sortState?.key === column.key && "text-brand-700")} />
                  </button>
                  <div className="flex items-center gap-1">
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger asChild>
                        <button
                          aria-label={`Show ${column.label} column actions`}
                          className="rounded p-1 hover:bg-white"
                        >
                          <ChevronDown size={12} />
                        </button>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.Content className="z-50 rounded border border-[#d8dde6] bg-white p-1 text-sm shadow-popover">
                          <DropdownMenu.Item
                            onSelect={() => onSort(column.key, "asc")}
                            className="cursor-pointer rounded px-3 py-2 hover:bg-brand-50"
                          >
                            Sort Ascending
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            onSelect={() => onSort(column.key, "desc")}
                            className="cursor-pointer rounded px-3 py-2 hover:bg-brand-50"
                          >
                            Sort Descending
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            onSelect={() => onResetColumnWidth?.(column.key)}
                            className="cursor-pointer rounded px-3 py-2 hover:bg-brand-50"
                          >
                            Reset Column Width
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            disabled={definition.columns.length <= 1}
                            onSelect={() => onHideColumn?.(column.key)}
                            className="cursor-pointer rounded px-3 py-2 hover:bg-brand-50 data-[disabled]:cursor-not-allowed data-[disabled]:text-[#a8a8a8]"
                          >
                            Hide Column
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                    <button
                      aria-label={`Resize ${column.label} column`}
                      className="grid-resize-handle h-5 w-1 rounded bg-[#dddbda] hover:bg-brand-500 focus:bg-brand-500 focus:outline-none"
                      onPointerDown={(event) => startColumnResize(column, event)}
                    />
                  </div>
                </div>
              </th>
            ))}
            <th className="w-16 px-3 py-2 text-left">Action</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr
              key={requiredId(record)}
              className="border-t border-[#e9edf2] bg-white transition-colors duration-100 hover:bg-brand-50/50"
            >
              <td className="border-r border-[#eef1f6] px-3 py-2">
                <input
                  className={checkboxClass}
                  type="checkbox"
                  checked={selected.includes(requiredId(record))}
                  onChange={(event) =>
                    onSelect(
                      event.target.checked
                        ? [...selected, requiredId(record)]
                        : selected.filter((id) => id !== requiredId(record))
                    )
                  }
                  aria-label={`Select ${recordTitle(definition.object, record)}`}
                />
              </td>
              {definition.columns.map((column, columnIndex) => {
                const sourceKey = inlineEditableFieldForColumn(definition.object, column.key);
                const editing = Boolean(
                  sourceKey && editingCell?.recordId === requiredId(record) && editingCell.key === sourceKey
                );
                const value = formatListCell(definition.object, record, column.key);
                const labels = recordLabels[requiredId(record)] ?? [];
                const campaigns = campaignMembers[requiredId(record)] ?? [];
                return (
                  <td
                    key={column.key}
                    className="border-r border-[#eef1f6] px-3 py-2"
                    style={{ minWidth: column.width ?? "150px", width: column.width ?? "150px" }}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        {editing ? (
                          <input
                            autoFocus
                            className={cn(inputClass, "min-h-7 py-1 text-xs")}
                            value={editingCell?.value ?? ""}
                            onChange={(event) =>
                              setEditingCell((current) =>
                                current ? { ...current, value: event.target.value } : current
                              )
                            }
                            onBlur={() => void commitInlineEdit()}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                event.currentTarget.blur();
                              }
                              if (event.key === "Escape") {
                                event.preventDefault();
                                cancelInlineEditRef.current = true;
                                setEditingCell(null);
                                event.currentTarget.blur();
                              }
                            }}
                          />
                        ) : definition.object === "Invoice" && column.key === "status" ? (
                          <InvoiceStatusBadge status={String(record.status ?? "Draft")} />
                        ) : (definition.object === "MessagingSession" || definition.object === "VideoCall") &&
                          column.key === "status" ? (
                          <CommunicationsStatusBadge status={record.status} />
                        ) : definition.object === "Campaign" && column.key === "status" ? (
                          <CampaignStatusBadge status={record.status} />
                        ) : column.link && canRouteToRecord(definition.object) ? (
                          <Link
                            href={routeForRecord(definition.object, requiredId(record))}
                            className="truncate text-brand-700 hover:underline"
                          >
                            {value || "-"}
                          </Link>
                        ) : (
                          <span className="truncate">{value || "-"}</span>
                        )}
                        {column.editable && (
                          <button
                            aria-label={`Edit ${column.label}`}
                            className="ml-auto rounded p-1 text-[#706e6b] hover:bg-white hover:text-brand-700"
                            onClick={() => startInlineEdit(record, column)}
                          >
                            <Edit3 size={12} />
                          </button>
                        )}
                      </div>
                      {columnIndex === 0 && (labels.length > 0 || campaigns.length > 0) && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {labels.map((label) => (
                            <span
                              key={`label-${label}`}
                              className="rounded bg-brand-50 px-1.5 py-0.5 text-[11px] text-brand-700"
                            >
                              {label}
                            </span>
                          ))}
                          {campaigns.map((campaign) => (
                            <span
                              key={`campaign-${campaign}`}
                              className="rounded bg-[#f3f3f3] px-1.5 py-0.5 text-[11px] text-[#514f4d]"
                            >
                              {campaign}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                );
              })}
              <td className="px-3 py-2">
                <RowActions
                  object={definition.object}
                  record={record}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onChangeOwner={onChangeOwner}
                  onConvertLead={onConvertLead}
                />
              </td>
            </tr>
          ))}
          {records.length === 0 && (
            <tr>
              <td colSpan={definition.columns.length + 2} className="h-24 text-center text-sm text-[#706e6b]">
                Nothing to see here
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
export function RowActions({
  object,
  record,
  onEdit,
  onDelete,
  onChangeOwner,
  onConvertLead
}: {
  object: CrmObject;
  record: RecordData;
  onEdit: (object: CrmObject, record: RecordData) => void;
  onDelete: (object: CrmObject, record: RecordData) => void;
  onChangeOwner?: (record: RecordData) => void;
  onConvertLead?: (record: RecordData) => void;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="rounded p-1 text-[#706e6b] hover:bg-[#f3f3f3]" aria-label="Show Actions">
          <MoreHorizontal size={16} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          className="z-50 min-w-36 rounded border border-[#d8dde6] bg-white p-1 shadow-popover"
        >
          {canRouteToRecord(object) && (
            <DropdownMenu.Item asChild>
              <Link
                href={routeForRecord(object, requiredId(record))}
                className="flex items-center gap-2 rounded px-3 py-2 text-sm hover:bg-brand-50"
              >
                <Eye size={14} /> View
              </Link>
            </DropdownMenu.Item>
          )}
          {canEditFromRow(object) && (object !== "Invoice" || record.status === "Draft") && (
            <DropdownMenu.Item
              onSelect={() => onEdit(object, record)}
              className="flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm hover:bg-brand-50"
            >
              <Edit3 size={14} /> Edit
            </DropdownMenu.Item>
          )}
          {canDeleteFromRow(object) && (object !== "Invoice" || record.status === "Draft") && (
            <DropdownMenu.Item
              onSelect={() => onDelete(object, record)}
              className="flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm text-[#ba0517] hover:bg-[#fff1f1]"
            >
              <Trash2 size={14} /> Delete
            </DropdownMenu.Item>
          )}
          {canChangeOwnerFromRow(object) && onChangeOwner && (
            <DropdownMenu.Item
              onSelect={() => onChangeOwner(record)}
              className="flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm hover:bg-brand-50"
            >
              Change Owner
            </DropdownMenu.Item>
          )}
          {object === "Lead" && onConvertLead && !record.convertedAt && (
            <DropdownMenu.Item
              onSelect={() => onConvertLead(record)}
              className="flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm hover:bg-brand-50"
            >
              <Target size={14} /> Convert
            </DropdownMenu.Item>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
export function EmptyState({ definition, onCreate }: { definition: ObjectDefinition; onCreate: () => void }) {
  return (
    <div className="rounded-lg border border-[#e4e7ec] bg-white p-8 text-center shadow-card">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <PanelLeft size={28} />
      </div>
      <h2 className="text-lg font-semibold">{definition.emptyTitle ?? "Nothing to see here"}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-[#706e6b]">
        {definition.emptyBody ?? "There's nothing in your list yet. Try adding a new record."}
      </p>
      {definition.supportsNew && (
        <Button className="mt-4" variant="primary" onClick={onCreate}>
          <Plus size={14} /> New
        </Button>
      )}
    </div>
  );
}
