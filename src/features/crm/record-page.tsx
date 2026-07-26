"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Tabs from "@radix-ui/react-tabs";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { OBJECT_DEFINITIONS } from "@/lib/crm-metadata";
import { recordTitle } from "@/lib/crm-data";
import { type ScopedCrmData, type CrmObject, type RecordData } from "@/lib/crm-types";
import { BaseDialog, Button, type ToastState } from "@/components/ui/crm-primitives";
import { ActivityPanel } from "@/features/crm/activity";
import { ObjectIcon } from "@/features/crm/controls";
import { addressValue, formatCell } from "@/features/crm/form-model";
import { DetailsSections } from "@/features/crm/record-files";
import { duplicateReason } from "@/features/crm/record-model";
import {
  DuplicatePanel,
  PartnerModal,
  RecordHierarchyDialog,
  RelatedListDialog,
  RelatedLists
} from "@/features/crm/record-related";
import { type ScopedCrmDataUpdater, type FileUploadRequest, type RecordPageDialog } from "@/features/crm/shared-types";

export function RecordPage({
  object,
  record,
  data,
  onCreate,
  onEdit,
  onDelete,
  onChangeOwner,
  onRecordEdit,
  onRecordDelete,
  onSaveActivity,
  onSaveFile,
  onDeleteFile,
  onOpenEvent,
  onDataChange,
  onToast,
  onRefreshData,
  labels,
  campaigns
}: {
  object: "Account" | "Contact";
  record: RecordData;
  data: ScopedCrmData;
  onCreate: (object: CrmObject) => void;
  onEdit: () => void;
  onDelete: () => void;
  onChangeOwner: () => void;
  onRecordEdit: (object: CrmObject, record: RecordData) => void;
  onRecordDelete: (object: CrmObject, record: RecordData) => void;
  onSaveActivity: (activity: RecordData) => Promise<boolean>;
  onSaveFile: (file: FileUploadRequest, attachment?: boolean) => Promise<boolean>;
  onDeleteFile: (file: RecordData, attachment?: boolean) => Promise<boolean>;
  onOpenEvent: () => void;
  onDataChange: ScopedCrmDataUpdater;
  onToast: (toast: ToastState) => void;
  onRefreshData: (successMessage: string) => Promise<boolean>;
  labels: string[];
  campaigns: string[];
}) {
  const definition = OBJECT_DEFINITIONS[object];
  const title = recordTitle(object, record);
  const [dialog, setDialog] = useState<RecordPageDialog | null>(null);
  const keyFields: Array<[string, unknown]> =
    object === "Account"
      ? [
          ["Phone", record.phone],
          ["Website", record.website],
          ["Billing Address", addressValue(record, "billing")],
          ["Account Owner", record.ownerName]
        ]
      : [
          ["Account Name", record.accountName],
          ["Title", record.title],
          ["Phone", record.phone],
          ["Email", record.email]
        ];

  return (
    <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-3">
        <div className="rounded-lg border border-[#e4e7ec] bg-white shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#d8dde6] p-3">
            <div className="flex items-start gap-3">
              <ObjectIcon definition={definition} />
              <div>
                <div className="text-xs text-[#706e6b]">{definition.label}</div>
                <h1 className="text-xl font-semibold">
                  {definition.label} {title}
                </h1>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              <Button onClick={() => setDialog({ type: "hierarchy" })}>
                {object === "Account" ? "View Account Hierarchy" : "View Contact Hierarchy"}
              </Button>
              {object === "Account" && <Button onClick={() => onCreate("Contact")}>New Contact</Button>}
              <Button onClick={() => onCreate("Opportunity")}>New Opportunity</Button>
              <Button onClick={onEdit}>Edit</Button>
              {object === "Contact" ? (
                <Button onClick={onDelete}>Delete</Button>
              ) : (
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button className="inline-flex min-h-8 items-center justify-center gap-1 rounded border border-[#c9c9c9] bg-white px-3 py-1 text-xs font-semibold text-brand-700 transition-colors hover:bg-[#f3f3f3]">
                      Show more actions <ChevronDown size={13} />
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content
                      align="end"
                      className="z-50 rounded border border-[#d8dde6] bg-white p-1 text-sm shadow-popover"
                    >
                      <DropdownMenu.Item
                        onSelect={() => setDialog({ type: "partner" })}
                        className="cursor-pointer rounded px-3 py-2 hover:bg-brand-50"
                      >
                        New Partner
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        onSelect={onChangeOwner}
                        className="cursor-pointer rounded px-3 py-2 hover:bg-brand-50"
                      >
                        Change Owner
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        onSelect={() => window.print()}
                        className="cursor-pointer rounded px-3 py-2 hover:bg-brand-50"
                      >
                        Printable View
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        onSelect={onDelete}
                        className="cursor-pointer rounded px-3 py-2 text-[#ba0517] hover:bg-[#fff1f1]"
                      >
                        Delete Account
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              )}
            </div>
          </div>
          <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-4">
            {keyFields.map(([label, value]) => (
              <div key={label} className="min-h-12">
                <div className="text-xs text-[#706e6b]">{label}</div>
                <div className="truncate text-sm">{formatCell(value) || "-"}</div>
              </div>
            ))}
          </div>
          {(labels.length > 0 || campaigns.length > 0) && (
            <div className="border-t border-[#d8dde6] px-3 py-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold text-[#706e6b]">Workspace tags</span>
                {labels.map((label) => (
                  <span key={label} className="rounded bg-brand-50 px-2 py-1 text-brand-700">
                    {label}
                  </span>
                ))}
                {campaigns.map((campaign) => (
                  <span key={campaign} className="rounded bg-[#f3f3f3] px-2 py-1 text-[#514f4d]">
                    {campaign}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        <Tabs.Root defaultValue="related" className="rounded-lg border border-[#e4e7ec] bg-white shadow-card">
          <Tabs.List className="flex border-b border-[#d8dde6]">
            <Tabs.Trigger
              value="related"
              className="border-b-2 border-transparent px-4 py-3 text-sm data-[state=active]:border-brand-500 data-[state=active]:font-semibold data-[state=active]:text-brand-700"
            >
              Related
            </Tabs.Trigger>
            <Tabs.Trigger
              value="details"
              className="border-b-2 border-transparent px-4 py-3 text-sm data-[state=active]:border-brand-500 data-[state=active]:font-semibold data-[state=active]:text-brand-700"
            >
              Details
            </Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="related" className="space-y-3 p-3">
            <DuplicatePanel
              object={object}
              record={record}
              data={data}
              onReview={(duplicate) => onRecordEdit(object, duplicate)}
              onMerge={(duplicate) => setDialog({ type: "mergeDuplicate", duplicate })}
            />
            <RelatedLists
              object={object}
              record={record}
              data={data}
              onCreate={onCreate}
              onSaveFile={onSaveFile}
              onDeleteFile={onDeleteFile}
              onRecordEdit={onRecordEdit}
              onRecordDelete={onRecordDelete}
              onViewAll={(title, relatedObject, records, fields) =>
                setDialog({ type: "relatedList", title, object: relatedObject, records, fields })
              }
              onNewPartner={() => setDialog({ type: "partner" })}
            />
          </Tabs.Content>
          <Tabs.Content value="details" className="p-3">
            <DetailsSections object={object} record={record} onEdit={onEdit} onChangeOwner={onChangeOwner} />
          </Tabs.Content>
        </Tabs.Root>
      </div>
      <ActivityPanel
        object={object}
        record={record}
        data={data}
        onSaveActivity={onSaveActivity}
        onOpenEvent={onOpenEvent}
        onToast={onToast}
        onRefreshData={onRefreshData}
      />
      {dialog?.type === "hierarchy" && (
        <RecordHierarchyDialog object={object} record={record} data={data} onClose={() => setDialog(null)} />
      )}
      {dialog?.type === "relatedList" && (
        <RelatedListDialog
          title={dialog.title}
          object={dialog.object}
          records={dialog.records}
          fields={dialog.fields}
          onClose={() => setDialog(null)}
          onEdit={(relatedObject, relatedRecord) => {
            setDialog(null);
            if (relatedObject !== "Partner") onRecordEdit(relatedObject, relatedRecord);
          }}
          onDelete={(relatedObject, relatedRecord) => {
            setDialog(null);
            if (relatedObject !== "Partner") onRecordDelete(relatedObject, relatedRecord);
          }}
        />
      )}
      {dialog?.type === "partner" && (
        <PartnerModal
          account={object === "Account" ? record : data.accounts.find((account) => account.id === record.accountId)}
          onClose={() => setDialog(null)}
          onSave={(partner) => {
            onDataChange((previous) => ({ ...previous, partners: [partner, ...previous.partners] }));
            onToast({ tone: "success", message: `Partner "${partner.name}" created.` });
            setDialog(null);
          }}
        />
      )}
      {dialog?.type === "mergeDuplicate" && (
        <BaseDialog
          open
          title={`Merge duplicate ${definition.label}?`}
          onClose={() => setDialog(null)}
          footer={
            <>
              <Button onClick={() => setDialog(null)}>Cancel</Button>
              <Button
                variant="primary"
                onClick={() => {
                  const duplicate = dialog.duplicate;
                  setDialog(null);
                  onRecordDelete(object, duplicate);
                }}
              >
                Review Merge
              </Button>
            </>
          }
        >
          <div className="space-y-2 text-sm">
            <p className="text-[#706e6b]">
              Review the duplicate before merging. The duplicate record will be selected for deletion after
              confirmation.
            </p>
            <div className="rounded border border-[#d8dde6] p-3">
              <div className="font-semibold">{recordTitle(object, dialog.duplicate)}</div>
              <div className="text-xs text-[#706e6b]">{duplicateReason(object, record, dialog.duplicate)}</div>
            </div>
          </div>
        </BaseDialog>
      )}
    </section>
  );
}
