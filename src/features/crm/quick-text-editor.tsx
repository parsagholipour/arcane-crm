"use client";

import { useState } from "react";
import { type ScopedCrmData, type RecordData } from "@/lib/crm-types";
import { cn } from "@/lib/utils";
import { BaseDialog, Button } from "@/components/ui/crm-primitives";
import { FieldShell, inputClass, NativeSelect } from "@/features/crm/controls";
import { recordDataShallowEqual, validateRequired } from "@/features/crm/form-model";
import { useUnsavedChangesGuard } from "@/features/crm/record-editors";

export function QuickTextModal({
  data,
  initial,
  onClose,
  onSave
}: {
  data: ScopedCrmData;
  initial?: RecordData;
  onClose: () => void;
  onSave: (values: RecordData) => Promise<boolean>;
}) {
  const [initialValues] = useState<RecordData>(() =>
    initial
      ? { ...initial, channels: Array.isArray(initial.channels) ? initial.channels.map(String) : [] }
      : { category: "Greetings", channels: ["Email"], mergeFields: [] }
  );
  const [values, setValues] = useState<RecordData>(() => initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [mergeError, setMergeError] = useState("");
  const [availableChannel, setAvailableChannel] = useState("");
  const [selectedChannel, setSelectedChannel] = useState("");
  const isDirty = !recordDataShallowEqual(values, initialValues);
  const { requestClose, discardDialog } = useUnsavedChangesGuard(isDirty, onClose);
  const selectedChannels = Array.isArray(values.channels) ? values.channels.map(String) : [];
  const channelOptions = [...new Set(["Email", "Event", "Task", "CaseComment", "Knowledge", ...selectedChannels])];
  const available = channelOptions.filter((item) => !selectedChannels.includes(item));
  async function submit(stayOpen = false) {
    const nextErrors = validateRequired(values, ["name", "message"]);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const ok = await onSave(values);
    if (ok && stayOpen) {
      setValues(initialValues);
      setErrors({});
      setMergeError("");
      setPreviewOpen(false);
    }
  }
  function insertMergeField() {
    const mergeObject = String(values.mergeObject ?? "Choose...");
    const mergeField = String(values.mergeField ?? "Choose...");
    if (mergeObject === "Choose..." || mergeField === "Choose...") {
      setMergeError("Choose a related object and field.");
      return;
    }
    const token = mergeField.includes(".") ? `{!${mergeField}}` : `{!${mergeObject}.${mergeField}}`;
    setMergeError("");
    setValues({
      ...values,
      message: `${values.message ?? ""}${token}`,
      mergeFields: [...(Array.isArray(values.mergeFields) ? values.mergeFields.map(String) : []), token]
    });
  }
  function moveChannel(channel: string, selected: boolean) {
    const channels = new Set(selectedChannels);
    if (selected) channels.add(channel);
    else channels.delete(channel);
    setValues({ ...values, channels: Array.from(channels) });
    setAvailableChannel("");
    setSelectedChannel("");
  }
  if (discardDialog) return discardDialog;
  return (
    <BaseDialog
      open
      title={initial ? `Edit ${String(initial.name ?? "Quick Text")}` : "New Quick Text"}
      onClose={requestClose}
      onEnterAction={() => submit(false)}
      wide
      footer={
        <>
          <Button onClick={() => setPreviewOpen((open) => !open)}>Preview</Button>
          <Button onClick={requestClose}>Cancel</Button>
          {!initial && <Button onClick={() => submit(true)}>Save & New</Button>}
          <Button variant="primary" onClick={() => submit(false)}>
            {initial ? "Update" : "Save"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <FieldShell label="Quick Text Name" required error={errors.name}>
          <input
            className={inputClass}
            value={String(values.name ?? "")}
            onChange={(event) => setValues({ ...values, name: event.target.value })}
          />
        </FieldShell>
        <FieldShell label="Folder">
          <NativeSelect
            options={[
              { value: "", label: "Select Folder" },
              ...data.quickTextFolders.map((folder) => ({ value: String(folder.id), label: String(folder.name) }))
            ]}
            value={String(values.folderId ?? "")}
            onChange={(next) => setValues({ ...values, folderId: next || null })}
            placeholder="Select Folder"
          />
        </FieldShell>
        <FieldShell label="Message" required error={errors.message}>
          <textarea
            className={cn(inputClass, "h-28")}
            value={String(values.message ?? "")}
            onChange={(event) => setValues({ ...values, message: event.target.value })}
          />
        </FieldShell>
        <div className="rounded border border-[#d8dde6] p-3">
          <div className="mb-2 font-semibold">Insert Merge Field</div>
          <p className="mb-2 text-xs text-[#706e6b]">
            A merge field inserts the value of a field for a specific object, for example {"{!Contact.FirstName}"}.
          </p>
          <div className="grid gap-2">
            <NativeSelect
              options={["Choose...", "Contact", "Account", "Lead"]}
              value={String(values.mergeObject ?? "Choose...")}
              onChange={(value) => setValues({ ...values, mergeObject: value })}
            />
            <NativeSelect
              options={["Choose...", "FirstName", "LastName", "Account.Name", "Owner.Name"]}
              value={String(values.mergeField ?? "Choose...")}
              onChange={(value) => setValues({ ...values, mergeField: value })}
            />
            <Button onClick={insertMergeField}>Insert</Button>
            {mergeError && <p className="text-xs text-[#ba0517]">{mergeError}</p>}
          </div>
        </div>
        <FieldShell label="Category">
          <input
            className={inputClass}
            value={String(values.category ?? "Greetings")}
            onChange={(event) => setValues({ ...values, category: event.target.value })}
          />
        </FieldShell>
        <div>
          <div className="mb-1 text-xs font-semibold text-[#444]">Channel</div>
          <p className="mb-2 text-xs text-[#706e6b]">Choose a channel, then move it between the lists.</p>
          <div className="grid grid-cols-[1fr_auto_1fr] gap-2">
            <select
              aria-label="Available Channels"
              size={5}
              className={cn(inputClass, "h-28 p-2")}
              value={availableChannel}
              onChange={(event) => setAvailableChannel(event.target.value)}
            >
              {available.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <div className="flex flex-col justify-center gap-1">
              <button
                type="button"
                className="rounded border border-[#c9c9c9] px-2 py-1 text-xs disabled:opacity-40"
                disabled={!availableChannel}
                onClick={() => moveChannel(availableChannel, true)}
                aria-label="Move selection to Selected"
              >
                ›
              </button>
              <button
                type="button"
                className="rounded border border-[#c9c9c9] px-2 py-1 text-xs disabled:opacity-40"
                disabled={!selectedChannel}
                onClick={() => moveChannel(selectedChannel, false)}
                aria-label="Move selection to Available"
              >
                ‹
              </button>
            </div>
            <select
              aria-label="Selected Channels"
              size={5}
              className={cn(inputClass, "h-28 p-2")}
              value={selectedChannel}
              onChange={(event) => setSelectedChannel(event.target.value)}
            >
              {selectedChannels.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      {previewOpen && (
        <QuickTextPreview
          name={String(values.name ?? "Untitled Quick Text")}
          message={String(values.message ?? "")}
          channels={(values.channels as string[]) ?? []}
          category={String(values.category ?? "Greetings")}
        />
      )}
    </BaseDialog>
  );
}
export function QuickTextPreview({
  name,
  message,
  channels,
  category
}: {
  name: string;
  message: string;
  channels: string[];
  category: string;
}) {
  return (
    <div className="mt-4 rounded-lg border border-[#e4e7ec] bg-white shadow-card">
      <div className="border-b border-[#d8dde6] bg-[#f8f8f8] px-3 py-2 text-sm font-semibold">Preview</div>
      <div className="grid gap-3 p-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{name}</span>
          <span className="rounded bg-brand-50 px-2 py-1 text-xs text-brand-700">{category}</span>
          {channels.map((channel) => (
            <span key={channel} className="rounded bg-[#f3f3f3] px-2 py-1 text-xs">
              {channel}
            </span>
          ))}
        </div>
        <div className="min-h-16 whitespace-pre-wrap rounded border border-[#eef1f6] bg-[#f8fbff] p-3">
          {message || "No message entered."}
        </div>
      </div>
    </div>
  );
}
export function stripRichTextMarkup(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h1|h2|blockquote|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
export function richTextWordCount(value: string) {
  const plainText = stripRichTextMarkup(value);
  if (!plainText) return 0;
  return plainText.split(/\s+/).filter(Boolean).length;
}
export function formatWordCount(count: number) {
  return `${count} word${count === 1 ? "" : "s"}`;
}
