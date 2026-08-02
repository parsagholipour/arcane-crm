"use client";

import { useState } from "react";
import { type ScopedCrmData, type RecordData } from "@/lib/crm-types";
import { BaseDialog, Button } from "@/components/ui/crm-primitives";
import { checkboxClass, FieldShell, inputClass, NativeSelect } from "@/features/crm/controls";

export function QuickTextFolderModal({
  onClose,
  onSave
}: {
  onClose: () => void;
  onSave: (values: RecordData) => void | Promise<void>;
}) {
  const [values, setValues] = useState<RecordData>({ name: "Personal Quick Text", sharing: "Private" });
  return (
    <BaseDialog
      open
      title="New Folder"
      onClose={onClose}
      onEnterAction={() => onSave(values)}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => onSave(values)}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <FieldShell label="Folder Name" required>
          <input
            className={inputClass}
            value={String(values.name ?? "")}
            onChange={(event) => setValues({ ...values, name: event.target.value })}
          />
        </FieldShell>
        <FieldShell label="Sharing">
          <NativeSelect
            options={["Private", "Shared with Me", "Public"]}
            value={String(values.sharing ?? "Private")}
            onChange={(value) => setValues({ ...values, sharing: value })}
          />
        </FieldShell>
      </div>
    </BaseDialog>
  );
}
export function MarketingActivationModal({
  user,
  initial,
  onClose,
  onSave
}: {
  user: ScopedCrmData["user"];
  initial?: RecordData;
  onClose: () => void;
  onSave: (values: RecordData) => void | Promise<void>;
}) {
  const [values, setValues] = useState<RecordData>({
    id: initial?.id,
    senderName: initial?.senderName ?? user.name,
    senderEmail: initial?.senderEmail ?? user.email ?? "",
    tracking: initial?.tracking !== false
  });
  return (
    <BaseDialog
      open
      title={initial ? "Edit Marketing Activation" : "Activate Marketing"}
      onClose={onClose}
      onEnterAction={initial ? () => onSave(values) : undefined}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => onSave(values)}>
            {initial ? "Save" : "Activate"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <FieldShell label="Default Sender Name">
          <input
            className={inputClass}
            value={String(values.senderName ?? "")}
            onChange={(event) => setValues({ ...values, senderName: event.target.value })}
          />
        </FieldShell>
        <FieldShell label="Default Sender Email">
          <input
            className={inputClass}
            type="email"
            value={String(values.senderEmail ?? "")}
            onChange={(event) => setValues({ ...values, senderEmail: event.target.value })}
          />
        </FieldShell>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className={checkboxClass}
            checked={Boolean(values.tracking)}
            onChange={(event) => setValues({ ...values, tracking: event.target.checked })}
          />{" "}
          Enable email tracking and analytics
        </label>
      </div>
    </BaseDialog>
  );
}
