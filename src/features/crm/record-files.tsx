"use client";

import { Download, Edit3, Eye, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { type RecordData } from "@/lib/crm-types";
import { cn } from "@/lib/utils";
import { BaseDialog, Button } from "@/components/ui/crm-primitives";
import { waitForUploadProgress } from "@/features/crm/activity-model";
import { addressValue, formatCell } from "@/features/crm/form-model";
import { requiredId } from "@/features/crm/record-model";

export function FileDropzone({
  title,
  action,
  records,
  attachment,
  onUpload,
  onDelete
}: {
  title: string;
  action: string;
  records: RecordData[];
  attachment: boolean;
  onUpload: (file: File) => Promise<boolean>;
  onDelete: (file: RecordData) => Promise<boolean>;
}) {
  const [dragging, setDragging] = useState(false);
  const [pendingUploads, setPendingUploads] = useState<
    Array<{ id: string; name: string; size: number; status: "Uploading" | "Complete" | "Error" }>
  >([]);
  const [pendingDeletion, setPendingDeletion] = useState<RecordData | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileActionClass =
    "inline-flex min-h-7 items-center gap-1 rounded border border-[#c9c9c9] bg-white px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-[#f3f3f3]";
  function uploadFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach((file) => void uploadFile(file));
  }
  async function uploadFile(file: File) {
    const id = `upload-${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setPendingUploads((current) => [{ id, name: file.name, size: file.size, status: "Uploading" }, ...current]);
    try {
      const uploaded = await onUpload(file);
      if (!uploaded) throw new Error("Upload rejected");
      setPendingUploads((current) => current.map((item) => (item.id === id ? { ...item, status: "Complete" } : item)));
      await waitForUploadProgress(300);
      setPendingUploads((current) => current.filter((item) => item.id !== id));
    } catch {
      setPendingUploads((current) => current.map((item) => (item.id === id ? { ...item, status: "Error" } : item)));
    }
  }
  async function confirmDelete() {
    if (!pendingDeletion) return;
    setDeleting(true);
    const deleted = await onDelete(pendingDeletion);
    setDeleting(false);
    if (deleted) setPendingDeletion(null);
  }
  return (
    <>
      <div className="rounded-lg border border-[#e4e7ec] bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-[#d8dde6] px-3 py-2">
          <h3 className="font-semibold">{title}</h3>
          <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-[#c9c9c9] bg-white px-3 py-1 text-xs hover:bg-[#f3f3f3]">
            <Upload size={13} />
            {action}
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(event) => {
                uploadFiles(event.target.files);
                event.currentTarget.value = "";
              }}
            />
          </label>
        </div>
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            uploadFiles(event.dataTransfer.files);
          }}
          className={cn(
            "m-3 rounded border border-dashed border-[#c9c9c9] p-5 text-center text-sm text-[#706e6b]",
            dragging && "border-brand-500 bg-brand-50 text-brand-700"
          )}
        >
          <div className="font-semibold">Drop Files</div>
          <div>Files are stored securely in this organization.</div>
        </div>
        {(pendingUploads.length > 0 || records.length > 0) && (
          <div className="border-t border-[#d8dde6] p-3">
            {pendingUploads.map((upload) => (
              <div
                key={upload.id}
                className={cn(
                  "mb-2 rounded border p-2 text-sm",
                  upload.status === "Error" ? "border-[#ea001e] bg-[#fff1f1]" : "border-brand-200 bg-brand-50"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span>{upload.name}</span>
                  <span className="text-xs text-[#706e6b]">
                    {upload.status === "Uploading"
                      ? "Uploading…"
                      : upload.status === "Complete"
                        ? "Stored"
                        : "Upload failed"}
                  </span>
                </div>
              </div>
            ))}
            {records.map((record) => {
              const available = Boolean(record.checksum);
              const kind = attachment ? "attachment" : "file";
              const fileUrl = `/api/files/${encodeURIComponent(requiredId(record))}?kind=${kind}`;
              return (
                <div
                  key={requiredId(record)}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-[#eef1f6] py-2 last:border-0"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{String(record.name ?? "File")}</div>
                    <div className="text-xs text-[#706e6b]">
                      {record.size ? `${Math.max(1, Math.round(Number(record.size) / 1024))} KB` : "Unknown size"}
                      {record.contentType ? ` · ${String(record.contentType)}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {available ? (
                      <>
                        <a
                          href={`${fileUrl}&disposition=inline`}
                          target="_blank"
                          rel="noreferrer"
                          className={fileActionClass}
                          aria-label={`Preview ${String(record.name ?? "file")}`}
                        >
                          <Eye size={13} /> Preview
                        </a>
                        <a
                          href={fileUrl}
                          className={fileActionClass}
                          aria-label={`Download ${String(record.name ?? "file")}`}
                        >
                          <Download size={13} /> Download
                        </a>
                      </>
                    ) : (
                      <span className="text-xs text-[#706e6b]">Legacy metadata only</span>
                    )}
                    <button
                      className={fileActionClass}
                      onClick={() => setPendingDeletion(record)}
                      aria-label={`Delete ${String(record.name ?? "file")}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {pendingDeletion && (
        <BaseDialog
          open
          title={`Delete ${String(pendingDeletion.name ?? (attachment ? "attachment" : "file"))}?`}
          onClose={() => !deleting && setPendingDeletion(null)}
          footer={
            <>
              <Button onClick={() => setPendingDeletion(null)} disabled={deleting}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => confirmDelete()} disabled={deleting}>
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            </>
          }
        >
          <p className="text-sm text-[#706e6b]">This permanently removes the stored content and its CRM file record.</p>
        </BaseDialog>
      )}
    </>
  );
}
export function DetailsSections({
  object,
  record,
  onEdit,
  onChangeOwner
}: {
  object: "Account" | "Contact";
  record: RecordData;
  onEdit: () => void;
  onChangeOwner: () => void;
}) {
  const sections =
    object === "Account"
      ? [
          [
            "About",
            [
              "Account Name:name",
              "Website:website",
              "Type:type",
              "Description:description",
              "Parent Account:parentAccountId",
              "Account Owner:ownerName"
            ]
          ],
          ["Get in Touch", ["Phone:phone", "Billing Address:billingAddress", "Shipping Address:shippingAddress"]],
          ["History", ["Created By:createdById", "Last Modified By:updatedById"]]
        ]
      : [
          [
            "About",
            [
              "Name:displayName",
              "Account Name:accountName",
              "Title:title",
              "Reports To:reportsToContactId",
              "Description:description",
              "Contact Owner:ownerName"
            ]
          ],
          ["Get in Touch", ["Phone:phone", "Email:email", "Mailing Address:mailingAddress"]],
          ["History", ["Created By:createdById", "Last Modified By:updatedById"]]
        ];
  return (
    <div className="space-y-4">
      {sections.map(([section, fields]) => (
        <section key={section as string}>
          <h3 className="mb-2 border-b border-[#d8dde6] pb-1 font-semibold">{section as string}</h3>
          <div className="grid gap-x-8 gap-y-2 md:grid-cols-2">
            {(fields as string[]).map((item) => {
              const [label, key] = item.split(":");
              const value = key.endsWith("Address") ? addressValue(record, key.replace("Address", "")) : record[key];
              return (
                <div
                  key={item}
                  className="flex min-h-10 items-start justify-between gap-3 border-b border-[#f3f3f3] py-2"
                >
                  <div>
                    <div className="text-xs text-[#706e6b]">{label}</div>
                    <div className="text-sm">{formatCell(value) || "-"}</div>
                  </div>
                  <button
                    className="rounded p-1 text-[#706e6b] hover:bg-brand-50 hover:text-brand-700"
                    aria-label={label.includes("Owner") ? "Change Owner" : `Edit ${label}`}
                    onClick={label.includes("Owner") ? onChangeOwner : onEdit}
                  >
                    <Edit3 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
