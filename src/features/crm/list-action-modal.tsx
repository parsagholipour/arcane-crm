"use client";

import { useState } from "react";
import { OBJECT_DEFINITIONS } from "@/lib/crm-metadata";
import { recordTitle } from "@/lib/crm-data";
import { type ScopedCrmData, type CrmObject, type RecordData } from "@/lib/crm-types";
import { cn } from "@/lib/utils";
import { BaseDialog, Button } from "@/components/ui/crm-primitives";
import { FieldShell, inputClass, NativeSelect } from "@/features/crm/controls";
import {
  formatCell,
  importColumnsLabel,
  importPayloadForObject,
  importSampleForObject
} from "@/features/crm/form-model";
import { LeadConversionDialog } from "@/features/crm/lead-conversion";
import { requiredId } from "@/features/crm/record-model";
import { type ModalState } from "@/features/crm/shared-types";

export function ListActionModal({
  modal,
  data,
  recordLabels,
  campaignMembers,
  onClose,
  onSaveRecord,
  onApply
}: {
  modal: Extract<ModalState, { type: "listAction" }>;
  data: ScopedCrmData;
  recordLabels: Record<string, string[]>;
  campaignMembers: Record<string, string[]>;
  onClose: () => void;
  onSaveRecord: (
    object: CrmObject,
    values: RecordData,
    options?: { id?: string; stayOpen?: boolean }
  ) => Promise<boolean>;
  onApply: (action: string, object: CrmObject, selectedIds: string[], payload: RecordData) => Promise<void>;
}) {
  const [values, setValues] = useState<RecordData>({
    campaign: "Starter Outreach",
    label: "Important",
    ownerId: data.user.id,
    articleAction: modal.action
  });
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    action: "Delete Article" | "Delete Draft";
    title: string;
    body: string;
    confirmLabel: string;
  } | null>(null);
  const selectedRecords =
    modal.selectedIds.length > 0
      ? modal.records.filter((record) => modal.selectedIds.includes(requiredId(record)))
      : modal.action === "Printable View"
        ? modal.records
        : [];
  const effectiveSelectedIds =
    modal.selectedIds.length > 0 ? modal.selectedIds : selectedRecords.map(requiredId).filter(Boolean);
  const targetCount = selectedRecords.length;
  const title = `${modal.action} ${OBJECT_DEFINITIONS[modal.object].plural}`;

  function openKnowledgeDeleteConfirmation(action: "Delete Article" | "Delete Draft") {
    const targetLabel =
      selectedRecords.length === 1
        ? `"${recordTitle("Knowledge__kav", selectedRecords[0])}"`
        : `${selectedRecords.length} knowledge article${selectedRecords.length === 1 ? "" : "s"}`;
    setConfirmAction({
      action,
      title: action === "Delete Draft" ? `Delete draft ${targetLabel}?` : `Delete ${targetLabel}?`,
      body:
        action === "Delete Draft"
          ? "Only selected draft articles will be deleted. Published and archived articles remain untouched."
          : "This permanently deletes the selected knowledge article records. This action can't be undone.",
      confirmLabel: action
    });
  }

  if (confirmAction) {
    return (
      <BaseDialog
        open
        title={confirmAction.title}
        onClose={onClose}
        footer={
          <>
            <Button onClick={() => setConfirmAction(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => onApply(confirmAction.action, modal.object, effectiveSelectedIds, values)}
            >
              {confirmAction.confirmLabel}
            </Button>
          </>
        }
      >
        <p className="text-sm text-[#444]">{confirmAction.body}</p>
      </BaseDialog>
    );
  }

  async function runImport() {
    setImporting(true);
    const rows = importText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    for (const row of rows) {
      const payload = importPayloadForObject(modal.object, row, data);
      if (payload) await onSaveRecord(modal.object, payload, { stayOpen: true });
    }
    setImporting(false);
    onClose();
  }

  if (modal.action === "Import") {
    const sample = importSampleForObject(modal.object);
    const rows = importText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    return (
      <BaseDialog
        open
        title={title}
        onClose={onClose}
        wide
        footer={
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={() => runImport()}>
              {importing ? "Importing..." : "Import"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-[#706e6b]">
            Intentional reduced import: only these columns are read —{" "}
            <span className="font-medium text-[#181818]">{importColumnsLabel(modal.object)}</span>. Other form fields
            use New Object defaults. Paste one record per line.
          </p>
          <div className="rounded border border-[#d8dde6] bg-[#f8f8f8] p-2 text-xs text-[#706e6b]">
            Example: {sample}
          </div>
          <textarea
            className={cn(inputClass, "h-36")}
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            placeholder={sample}
          />
          <div className="rounded border border-[#d8dde6] p-3">
            <div className="mb-2 font-semibold">Preview ({rows.length})</div>
            {rows.length === 0 ? (
              <p className="text-sm text-[#706e6b]">No rows ready to import.</p>
            ) : (
              rows.slice(0, 5).map((row, index) => (
                <div key={`${row}-${index}`} className="text-sm">
                  {index + 1}. {row}
                </div>
              ))
            )}
          </div>
        </div>
      </BaseDialog>
    );
  }

  if (modal.action === "Printable View") {
    return (
      <BaseDialog
        open
        title="Printable View"
        onClose={onClose}
        wide
        footer={
          <>
            <Button onClick={() => window.print()}>Print</Button>
            <Button onClick={onClose}>Close</Button>
          </>
        }
      >
        <div className="mb-3 text-sm text-[#706e6b]">
          {OBJECT_DEFINITIONS[modal.object].plural} - {targetCount} records
        </div>
        <table className="w-full border border-[#d8dde6] text-sm">
          <thead className="bg-[#f3f3f3]">
            <tr>
              {OBJECT_DEFINITIONS[modal.object].columns.slice(0, 5).map((column) => (
                <th key={column.key} className="border border-[#d8dde6] px-2 py-1 text-left">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {selectedRecords.map((record) => (
              <tr key={requiredId(record)}>
                {OBJECT_DEFINITIONS[modal.object].columns.slice(0, 5).map((column) => (
                  <td key={column.key} className="border border-[#d8dde6] px-2 py-1">
                    {formatCell(record[column.key]) || "-"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </BaseDialog>
    );
  }

  if (modal.action === "Merge Cases") {
    return (
      <BaseDialog
        open
        title="Merge Cases"
        onClose={onClose}
        footer={
          <>
            <Button onClick={onClose}>Cancel</Button>
            {targetCount >= 2 && (
              <Button
                variant="primary"
                onClick={() => onApply(modal.action, modal.object, effectiveSelectedIds, values)}
              >
                Merge Cases
              </Button>
            )}
          </>
        }
      >
        {targetCount < 2 ? (
          <p className="text-sm text-[#706e6b]">
            Select at least two cases from the list to merge. The current list has {targetCount} selected case
            {targetCount === 1 ? "" : "s"}.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-[#706e6b]">
              Choose a primary case. Related activities and files remain associated with the surviving case.
            </p>
            <NativeSelect
              options={selectedRecords.map((record) => String(record.caseNumber ?? record.subject ?? record.id))}
              value={String(values.primaryCase ?? selectedRecords[0]?.caseNumber ?? "")}
              onChange={(value) => setValues({ ...values, primaryCase: value })}
            />
          </div>
        )}
      </BaseDialog>
    );
  }

  if (modal.object === "Lead" && ["Show more actions", "Convert Lead"].includes(modal.action)) {
    return (
      <LeadConversionDialog
        title={modal.action === "Convert Lead" ? "Convert Lead" : "Show More Actions: Leads"}
        leads={selectedRecords}
        selectedIds={effectiveSelectedIds}
        data={data}
        onClose={onClose}
        onApply={onApply}
      />
    );
  }

  if (["Publish", "Assign", "Archive", "Delete Article", "Show more actions"].includes(modal.action)) {
    const targetLabel = `${targetCount} selected article record${targetCount === 1 ? "" : "s"}`;
    return (
      <BaseDialog
        open
        title={title}
        onClose={onClose}
        footer={
          modal.action === "Show more actions" ? (
            <>
              <Button onClick={onClose}>Close</Button>
            </>
          ) : (
            <>
              <Button onClick={onClose}>Cancel</Button>
              <Button
                variant={modal.action === "Delete Article" ? "destructive" : "primary"}
                disabled={targetCount === 0}
                onClick={() =>
                  modal.action === "Delete Article"
                    ? openKnowledgeDeleteConfirmation("Delete Article")
                    : onApply(modal.action, modal.object, effectiveSelectedIds, values)
                }
              >
                {modal.action}
              </Button>
            </>
          )
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-[#706e6b]">{targetLabel} will be affected.</p>
          {modal.action === "Assign" && (
            <FieldShell label="Assign To">
              <select
                className={inputClass}
                value={String(values.assigneeId ?? data.user.id)}
                onChange={(event) => setValues({ ...values, assigneeId: event.target.value })}
              >
                {data.users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </FieldShell>
          )}
          {modal.action === "Archive" && (
            <FieldShell label="Archive Reason">
              <textarea
                className={inputClass}
                value={String(values.reason ?? "")}
                onChange={(event) => setValues({ ...values, reason: event.target.value })}
              />
            </FieldShell>
          )}
          {modal.action === "Delete Article" && (
            <div className="rounded border border-[#ba0517] bg-[#fff1f1] p-3 text-sm text-[#8e030f]">
              Delete Article requires a confirmation step before any records are removed.
            </div>
          )}
          {modal.action === "Show more actions" && (
            <div className="space-y-3">
              <div className="rounded border border-[#d8dde6] p-3">
                <div className="font-semibold">Delete Draft</div>
                <p className="mt-1 text-sm text-[#706e6b]">
                  Delete selected articles that are still drafts. Published and archived articles remain untouched.
                </p>
                <div className="mt-2">
                  <Button
                    variant="destructive"
                    disabled={targetCount === 0}
                    onClick={() => openKnowledgeDeleteConfirmation("Delete Draft")}
                  >
                    Delete Draft
                  </Button>
                </div>
              </div>
              <div className="rounded border border-[#d8dde6] p-3">
                <div className="font-semibold">Restore</div>
                <p className="mt-1 text-sm text-[#706e6b]">
                  Move archived selected articles back to Draft and clear archive metadata.
                </p>
                <div className="mt-2">
                  <Button
                    disabled={targetCount === 0}
                    onClick={() => onApply("Restore", modal.object, effectiveSelectedIds, values)}
                  >
                    Restore
                  </Button>
                </div>
              </div>
              <div className="rounded border border-[#d8dde6] p-3">
                <FieldShell label="New Owner">
                  <select
                    className={inputClass}
                    value={String(values.ownerId ?? data.user.id)}
                    onChange={(event) => setValues({ ...values, ownerId: event.target.value })}
                  >
                    {data.users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </FieldShell>
                <div className="mt-2">
                  <Button
                    disabled={targetCount === 0}
                    onClick={() => onApply("Change Owner", modal.object, effectiveSelectedIds, values)}
                  >
                    Change Owner
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </BaseDialog>
    );
  }

  return (
    <BaseDialog
      open
      title={title}
      onClose={onClose}
      onEnterAction={
        targetCount === 0 ? undefined : () => onApply(modal.action, modal.object, effectiveSelectedIds, values)
      }
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={targetCount === 0}
            onClick={() => onApply(modal.action, modal.object, effectiveSelectedIds, values)}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-[#706e6b]">
          {targetCount} selected record{targetCount === 1 ? "" : "s"}. Select records in the list before applying a bulk
          action.
        </p>
        {modal.action === "Add to Campaign" && (
          <>
            <FieldShell label="Campaign">
              <input
                className={inputClass}
                value={String(values.campaign ?? "")}
                onChange={(event) => setValues({ ...values, campaign: event.target.value })}
              />
            </FieldShell>
            <FieldShell label="Member Status">
              <NativeSelect
                options={["Sent", "Responded", "Planned"]}
                value={String(values.status ?? "Sent")}
                onChange={(value) => setValues({ ...values, status: value })}
              />
            </FieldShell>
            <div className="rounded border border-[#d8dde6] p-2 text-xs text-[#706e6b]">
              Existing campaign memberships: {Object.values(campaignMembers).flat().length}
            </div>
          </>
        )}
        {modal.action === "Assign Label" && (
          <>
            <FieldShell label="Label">
              <input
                className={inputClass}
                value={String(values.label ?? "")}
                onChange={(event) => setValues({ ...values, label: event.target.value })}
              />
            </FieldShell>
            <div className="rounded border border-[#d8dde6] p-2 text-xs text-[#706e6b]">
              Existing labels in this session: {Object.values(recordLabels).flat().join(", ") || "None"}
            </div>
          </>
        )}
        {modal.action === "Change Owner" && (
          <FieldShell label="New Owner">
            <select
              className={inputClass}
              value={String(values.ownerId ?? data.user.id)}
              onChange={(event) => setValues({ ...values, ownerId: event.target.value })}
            >
              {data.users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </FieldShell>
        )}
        {modal.action === "Add to Category" && (
          <FieldShell label="Category">
            <input
              className={inputClass}
              value={String(values.category ?? "Products")}
              onChange={(event) => setValues({ ...values, category: event.target.value })}
            />
          </FieldShell>
        )}
      </div>
    </BaseDialog>
  );
}
