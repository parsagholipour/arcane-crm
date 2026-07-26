"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { OBJECT_DEFINITIONS } from "@/lib/crm-metadata";
import { recordTitle, routeForRecord } from "@/lib/crm-data";
import { type ScopedCrmData, type CrmObject, type RecordData } from "@/lib/crm-types";
import { cn } from "@/lib/utils";
import { BaseDialog, Button } from "@/components/ui/crm-primitives";
import { FieldShell, inputClass, NativeSelect } from "@/features/crm/controls";
import { isRecordData } from "@/features/crm/data-model";
import { resourceApi } from "@/lib/api/resources";
import { fieldLabel, formatCell } from "@/features/crm/form-model";
import { FileDropzone } from "@/features/crm/record-files";
import {
  accountHierarchyRows,
  canRouteToRecord,
  contactHierarchyRows,
  duplicateReason,
  potentialDuplicates,
  relatedRecordTitle,
  requiredId
} from "@/features/crm/record-model";
import { type FileUploadRequest, type RelatedListObject } from "@/features/crm/shared-types";

export function RelatedLists({
  object,
  record,
  data,
  onCreate,
  onSaveFile,
  onDeleteFile,
  onRecordEdit,
  onRecordDelete,
  onViewAll,
  onNewPartner
}: {
  object: "Account" | "Contact";
  record: RecordData;
  data: ScopedCrmData;
  onCreate: (object: CrmObject) => void;
  onSaveFile: (file: FileUploadRequest, attachment?: boolean) => Promise<boolean>;
  onDeleteFile: (file: RecordData, attachment?: boolean) => Promise<boolean>;
  onRecordEdit: (object: CrmObject, record: RecordData) => void;
  onRecordDelete: (object: CrmObject, record: RecordData) => void;
  onViewAll: (title: string, object: RelatedListObject, records: RecordData[], fields: string[]) => void;
  onNewPartner: () => void;
}) {
  const contacts = object === "Account" ? data.contacts.filter((contact) => contact.accountId === record.id) : [];
  const opportunities = data.opportunities.filter(
    (opportunity) => opportunity.accountId === record.id || opportunity.contactId === record.id
  );
  const cases = data.cases.filter(
    (caseRecord) => caseRecord.accountId === record.id || caseRecord.contactId === record.id
  );
  const partners = object === "Account" ? data.partners.filter((partner) => partner.accountId === record.id) : [];
  const files = data.files.filter((file) => file.relatedObjectType === object && file.relatedRecordId === record.id);
  const attachments = data.attachments.filter(
    (file) => file.relatedObjectType === object && file.relatedRecordId === record.id
  );

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {object === "Account" && (
        <RelatedListCard
          title={`Contacts (${contacts.length})`}
          action="New"
          onAction={() => onCreate("Contact")}
          records={contacts}
          fields={["title", "email", "phone"]}
          viewAll="View All Contacts"
          object="Contact"
          onViewAll={onViewAll}
          onEdit={onRecordEdit}
          onDelete={onRecordDelete}
        />
      )}
      <RelatedListCard
        title={`Opportunities (${opportunities.length})`}
        action="New"
        onAction={() => onCreate("Opportunity")}
        records={opportunities}
        fields={["stage", "amount", "closeDate"]}
        object="Opportunity"
        onViewAll={onViewAll}
        onEdit={onRecordEdit}
        onDelete={onRecordDelete}
      />
      <RelatedListCard
        title={`Cases (${cases.length})`}
        action="New"
        onAction={() => onCreate("Case")}
        records={cases}
        fields={["status", "priority", "subject"]}
        object="Case"
        onViewAll={onViewAll}
        onEdit={onRecordEdit}
        onDelete={onRecordDelete}
      />
      {object === "Account" && (
        <RelatedListCard
          title={`Partners (${partners.length})`}
          action="New"
          onAction={onNewPartner}
          records={partners}
          fields={["role"]}
          viewAll={partners.length > 0 ? "View All Partners" : undefined}
          object="Partner"
          onViewAll={onViewAll}
        />
      )}
      <FileDropzone
        title={`Files (${files.length})`}
        action="Add Files"
        records={files}
        attachment={false}
        onUpload={(file) => onSaveFile({ file, relatedObjectType: object, relatedRecordId: requiredId(record) })}
        onDelete={(file) => onDeleteFile(file)}
      />
      <FileDropzone
        title={`Notes & Attachments (${attachments.length})`}
        action="Upload Files"
        records={attachments}
        attachment
        onUpload={(file) => onSaveFile({ file, relatedObjectType: object, relatedRecordId: requiredId(record) }, true)}
        onDelete={(file) => onDeleteFile(file, true)}
      />
    </div>
  );
}
export function RelatedListCard({
  title,
  action,
  onAction,
  records,
  fields,
  object,
  viewAll,
  onViewAll,
  onEdit,
  onDelete
}: {
  title: string;
  action: string;
  onAction: () => void;
  records: RecordData[];
  fields: string[];
  object: RelatedListObject;
  viewAll?: string;
  onViewAll: (title: string, object: RelatedListObject, records: RecordData[], fields: string[]) => void;
  onEdit?: (object: CrmObject, record: RecordData) => void;
  onDelete?: (object: CrmObject, record: RecordData) => void;
}) {
  const viewAllLabel =
    viewAll ??
    (records.length > 0
      ? `View All ${object === "Partner" ? "Partners" : OBJECT_DEFINITIONS[object].plural}`
      : undefined);
  return (
    <div className="rounded-lg border border-[#e4e7ec] bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-[#d8dde6] px-3 py-2">
        <h3 className="font-semibold">{title}</h3>
        <Button onClick={onAction}>{action}</Button>
      </div>
      <div className="p-3">
        {records.length === 0 ? (
          <p className="text-sm text-[#706e6b]">No records to show.</p>
        ) : (
          <div className="space-y-2">
            {records.map((record) => (
              <div key={requiredId(record)} className="rounded border border-[#d8dde6] p-2">
                <div className="flex items-center justify-between gap-2">
                  {object !== "Partner" && canRouteToRecord(object) ? (
                    <Link
                      href={routeForRecord(object, requiredId(record))}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      {relatedRecordTitle(object, record)}
                    </Link>
                  ) : (
                    <button
                      className="font-medium text-brand-700 hover:underline"
                      onClick={() => object !== "Partner" && onEdit?.(object, record)}
                    >
                      {relatedRecordTitle(object, record)}
                    </button>
                  )}
                  <RelatedRowActions object={object} record={record} onEdit={onEdit} onDelete={onDelete} />
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-[#706e6b]">
                  {fields.map((field) => (
                    <div key={field}>
                      <div>{fieldLabel(field)}</div>
                      <div className="truncate text-[#181818]">{formatCell(record[field]) || "-"}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {viewAllLabel && (
              <button
                className="text-sm text-brand-700 hover:underline"
                onClick={() => onViewAll(viewAllLabel, object, records, fields)}
              >
                {viewAllLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
export function RelatedRowActions({
  object,
  record,
  onEdit,
  onDelete
}: {
  object: RelatedListObject;
  record: RecordData;
  onEdit?: (object: CrmObject, record: RecordData) => void;
  onDelete?: (object: CrmObject, record: RecordData) => void;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button aria-label="Show Actions" className="rounded p-1 hover:bg-[#f3f3f3]">
          <MoreHorizontal size={16} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          className="z-50 rounded border border-[#d8dde6] bg-white p-1 text-sm shadow-popover"
        >
          {object !== "Partner" && canRouteToRecord(object) && (
            <DropdownMenu.Item asChild className="cursor-pointer rounded px-3 py-2 hover:bg-brand-50">
              <Link href={routeForRecord(object, requiredId(record))}>Open</Link>
            </DropdownMenu.Item>
          )}
          {object !== "Partner" && (
            <DropdownMenu.Item
              onSelect={() => onEdit?.(object, record)}
              className="cursor-pointer rounded px-3 py-2 hover:bg-brand-50"
            >
              Edit
            </DropdownMenu.Item>
          )}
          {object !== "Partner" && (
            <DropdownMenu.Item
              onSelect={() => onDelete?.(object, record)}
              className="cursor-pointer rounded px-3 py-2 text-[#ba0517] hover:bg-[#fff1f1]"
            >
              Delete
            </DropdownMenu.Item>
          )}
          {object === "Partner" && (
            <DropdownMenu.Item disabled className="rounded px-3 py-2 data-[disabled]:text-[#a8a8a8]">
              Partner details are managed from the account
            </DropdownMenu.Item>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
export function DuplicatePanel({
  object,
  record,
  data,
  onReview,
  onMerge
}: {
  object: "Account" | "Contact";
  record: RecordData;
  data: ScopedCrmData;
  onReview: (record: RecordData) => void;
  onMerge: (record: RecordData) => void;
}) {
  const duplicates = potentialDuplicates(object, record, data);
  if (duplicates.length === 0) {
    return (
      <div className="rounded border border-[#d8dde6] bg-[#f8f8f8] p-3 text-sm">
        We found no potential duplicates of this {OBJECT_DEFINITIONS[object].label}.
      </div>
    );
  }
  return (
    <div className="rounded border border-[#f1c40f] bg-[#fff7d6] p-3 text-sm">
      <div className="mb-2 font-semibold">Potential duplicates found</div>
      <div className="space-y-2">
        {duplicates.map((duplicate) => (
          <div
            key={requiredId(duplicate)}
            className="flex flex-wrap items-center justify-between gap-2 rounded border border-[#e5c349] bg-white p-2"
          >
            <div>
              <div className="font-medium">{recordTitle(object, duplicate)}</div>
              <div className="text-xs text-[#706e6b]">{duplicateReason(object, record, duplicate)}</div>
            </div>
            <div className="flex gap-1">
              <Button onClick={() => onReview(duplicate)}>Review</Button>
              <Button variant="primary" onClick={() => onMerge(duplicate)}>
                Merge
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
export function RecordHierarchyDialog({
  object,
  record,
  data,
  onClose
}: {
  object: "Account" | "Contact";
  record: RecordData;
  data: ScopedCrmData;
  onClose: () => void;
}) {
  const rows = object === "Account" ? accountHierarchyRows(record, data) : contactHierarchyRows(record, data);
  return (
    <BaseDialog
      open
      title={object === "Account" ? "Account Hierarchy" : "Contact Hierarchy"}
      onClose={onClose}
      wide
      footer={<Button onClick={onClose}>Close</Button>}
    >
      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.id}
            className={cn(
              "rounded-lg border border-[#e4e7ec] bg-white p-3 shadow-card",
              row.current && "border-brand-500 bg-brand-50"
            )}
          >
            <div className="flex items-center justify-between gap-2" style={{ paddingLeft: row.depth * 24 }}>
              <div>
                <div className="font-semibold">{row.label}</div>
                <div className="text-xs text-[#706e6b]">{row.meta}</div>
              </div>
              {row.href ? (
                <Link href={row.href} className="text-sm text-brand-700 hover:underline">
                  Open
                </Link>
              ) : (
                <span className="text-xs text-[#706e6b]">Current</span>
              )}
            </div>
          </div>
        ))}
        {rows.length === 1 && (
          <div className="rounded border border-dashed border-[#d8dde6] p-4 text-sm text-[#706e6b]">
            No parent or child records are linked yet.
          </div>
        )}
      </div>
    </BaseDialog>
  );
}
export function RelatedListDialog({
  title,
  object,
  records,
  fields,
  onClose,
  onEdit,
  onDelete
}: {
  title: string;
  object: RelatedListObject;
  records: RecordData[];
  fields: string[];
  onClose: () => void;
  onEdit: (object: RelatedListObject, record: RecordData) => void;
  onDelete: (object: RelatedListObject, record: RecordData) => void;
}) {
  return (
    <BaseDialog open title={title} onClose={onClose} wide footer={<Button onClick={onClose}>Close</Button>}>
      <div className="overflow-auto">
        <table className="w-full min-w-[620px] border border-[#d8dde6] text-sm">
          <thead className="bg-[#f3f3f3]">
            <tr>
              <th className="border border-[#d8dde6] px-2 py-2 text-left">Name</th>
              {fields.map((field) => (
                <th key={field} className="border border-[#d8dde6] px-2 py-2 text-left">
                  {fieldLabel(field)}
                </th>
              ))}
              <th className="border border-[#d8dde6] px-2 py-2 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={requiredId(record)}>
                <td className="border border-[#d8dde6] px-2 py-2">
                  {object !== "Partner" && canRouteToRecord(object) ? (
                    <Link href={routeForRecord(object, requiredId(record))} className="text-brand-700 hover:underline">
                      {relatedRecordTitle(object, record)}
                    </Link>
                  ) : (
                    <button className="text-brand-700 hover:underline" onClick={() => onEdit(object, record)}>
                      {relatedRecordTitle(object, record)}
                    </button>
                  )}
                </td>
                {fields.map((field) => (
                  <td key={field} className="border border-[#d8dde6] px-2 py-2">
                    {formatCell(record[field]) || "-"}
                  </td>
                ))}
                <td className="border border-[#d8dde6] px-2 py-2">
                  <RelatedRowActions
                    object={object}
                    record={record}
                    onEdit={(relatedObject, relatedRecord) => onEdit(relatedObject, relatedRecord)}
                    onDelete={(relatedObject, relatedRecord) => onDelete(relatedObject, relatedRecord)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BaseDialog>
  );
}
export function PartnerModal({
  account,
  onClose,
  onSave
}: {
  account?: RecordData;
  onClose: () => void;
  onSave: (partner: RecordData) => void;
}) {
  const [values, setValues] = useState<RecordData>({ name: "", role: "Technology Partner" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!account?.id) {
      setError("Choose an account before creating a partner.");
      return;
    }
    if (!String(values.name ?? "").trim()) {
      setError("Complete this field.");
      return;
    }
    setSaving(true);
    const response = await resourceApi.createPartner({
      accountId: account.id,
      name: String(values.name).trim(),
      role: values.role
    });
    const partner = isRecordData(response?.partner)
      ? response.partner
      : {
          id: `partner-${Date.now()}`,
          accountId: account.id,
          name: String(values.name).trim(),
          role: values.role,
          createdAt: new Date().toISOString()
        };
    setSaving(false);
    onSave(partner);
  }

  return (
    <BaseDialog
      open
      title="New Partner"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => submit()}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <FieldShell label="Account">
          <input className={inputClass} value={String(account?.name ?? "No account selected")} readOnly />
        </FieldShell>
        <FieldShell label="Partner Name" required error={error}>
          <input
            className={inputClass}
            value={String(values.name ?? "")}
            onChange={(event) => {
              setError("");
              setValues({ ...values, name: event.target.value });
            }}
          />
        </FieldShell>
        <FieldShell label="Role">
          <NativeSelect
            options={[
              "Technology Partner",
              "Implementation Partner",
              "Reseller",
              "Referral Partner",
              "Strategic Partner"
            ]}
            value={String(values.role ?? "Technology Partner")}
            onChange={(role) => setValues({ ...values, role })}
          />
        </FieldShell>
      </div>
    </BaseDialog>
  );
}
