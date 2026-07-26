"use client";

import { type AppKey, type AppNavItem, type ScopedCrmData, type CrmObject, type RecordData } from "@/lib/crm-types";
import { InvoiceEditorModal, InvoicePaymentModal, type InvoiceMutationResult } from "@/components/crm/InvoiceWorkspace";
import {
  MessagingSessionEditorModal,
  VideoCallEditorModal,
  type CommunicationsMutationResult
} from "@/components/crm/CommunicationsWorkspace";
import { CampaignEditorModal, type CampaignMutationResult } from "@/components/crm/CampaignWorkspace";
import { BaseDialog, Button, type ToastState } from "@/components/ui/crm-primitives";
import { EventModal } from "@/features/crm/event-editor";
import { KnowledgeModal } from "@/features/crm/knowledge-editor";
import { LeadConversionSuccessModal } from "@/features/crm/lead-success";
import { ListActionModal } from "@/features/crm/list-action-modal";
import { ListEmailWizard } from "@/features/crm/list-email-editor";
import { NavEditModal } from "@/features/crm/nav-editor";
import { QuickTextModal } from "@/features/crm/quick-text-editor";
import { GenericRecordModal, ProductWizardModal } from "@/features/crm/record-editors";
import { ReportBuilderModal } from "@/features/crm/report-builder-modal";
import { type ScopedCrmDataUpdater, type ModalState } from "@/features/crm/shared-types";
import { MarketingActivationModal, QuickTextFolderModal } from "@/features/crm/small-modals";

export function ModalHost({
  modal,
  data,
  recordLabels,
  campaignMembers,
  onClose,
  onSaveRecord,
  onDeleteEvent,
  onSaveAppNav,
  onResetAppNav,
  onDataChange,
  onToast,
  onInvoiceSaved,
  onCommunicationsSaved,
  onCampaignSaved,
  onApplyListAction
}: {
  modal: ModalState | null;
  data: ScopedCrmData;
  recordLabels: Record<string, string[]>;
  campaignMembers: Record<string, string[]>;
  onClose: () => void;
  onSaveRecord: (
    object: CrmObject,
    values: RecordData,
    options?: { id?: string; stayOpen?: boolean }
  ) => Promise<boolean>;
  onDeleteEvent: (record: RecordData, scope: "single" | "all", occurrenceStart: string | null) => void;
  onSaveAppNav: (app: AppKey, items: AppNavItem[]) => Promise<boolean>;
  onResetAppNav: (app: AppKey) => Promise<boolean>;
  onDataChange: ScopedCrmDataUpdater;
  onToast: (toast: ToastState) => void;
  onInvoiceSaved: (result: InvoiceMutationResult, mode: "new" | "edit" | "payment") => void;
  onCommunicationsSaved: (result: CommunicationsMutationResult) => void;
  onCampaignSaved: (result: CampaignMutationResult) => void;
  onApplyListAction: (action: string, object: CrmObject, selectedIds: string[], payload: RecordData) => Promise<void>;
}) {
  if (!modal) return null;
  if (modal.type === "confirm") {
    return (
      <BaseDialog
        open
        title={modal.title}
        onClose={onClose}
        footer={
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="destructive" onClick={modal.onConfirm}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-[#444]">{modal.body}</p>
      </BaseDialog>
    );
  }
  if (modal.type === "invoice")
    return (
      <InvoiceEditorModal
        mode={modal.mode}
        data={data}
        invoice={modal.record}
        onClose={onClose}
        onSaved={(result) => onInvoiceSaved(result, modal.mode)}
        onToast={onToast}
      />
    );
  if (modal.type === "invoicePayment")
    return (
      <InvoicePaymentModal
        invoice={modal.invoice}
        onClose={onClose}
        onSaved={(result) => onInvoiceSaved(result, "payment")}
        onToast={onToast}
      />
    );
  if (modal.type === "messaging")
    return (
      <MessagingSessionEditorModal
        data={data}
        initial={modal.record}
        onClose={onClose}
        onSaved={onCommunicationsSaved}
        onToast={onToast}
      />
    );
  if (modal.type === "videoCall")
    return (
      <VideoCallEditorModal
        data={data}
        initial={modal.record}
        onClose={onClose}
        onSaved={onCommunicationsSaved}
        onToast={onToast}
      />
    );
  if (modal.type === "campaign")
    return (
      <CampaignEditorModal
        data={data}
        initial={modal.record}
        onClose={onClose}
        onSaved={onCampaignSaved}
        onToast={onToast}
      />
    );
  if (modal.type === "navEdit")
    return <NavEditModal app={modal.app} data={data} onClose={onClose} onSave={onSaveAppNav} onReset={onResetAppNav} />;
  if (modal.type === "product")
    return <ProductWizardModal data={data} onClose={onClose} onSave={(values) => onSaveRecord("Product2", values)} />;
  if (modal.type === "event") {
    return (
      <EventModal
        data={data}
        record={modal.record}
        occurrenceStart={modal.occurrenceStart}
        recurring={modal.recurring}
        relatedObjectType={modal.relatedObjectType}
        relatedRecordId={modal.relatedRecordId}
        startDate={modal.startDate}
        startTime={modal.startTime}
        endDate={modal.endDate}
        endTime={modal.endTime}
        onClose={onClose}
        onSave={(values, options) => onSaveRecord("Event", values, options)}
        onDelete={(record, scope) => onDeleteEvent(record, scope, modal.occurrenceStart ?? null)}
      />
    );
  }
  if (modal.type === "quickText")
    return (
      <QuickTextModal
        data={data}
        initial={modal.record}
        onClose={onClose}
        onSave={(values) => onSaveRecord("QuickText", values, { id: modal.record?.id })}
      />
    );
  if (modal.type === "knowledge")
    return (
      <KnowledgeModal
        initial={modal.record}
        onClose={onClose}
        onSave={(values) => onSaveRecord("Knowledge__kav", values, { id: modal.record?.id })}
      />
    );
  if (modal.type === "listEmail")
    return (
      <ListEmailWizard
        data={data}
        initialValues={modal.initialValues}
        startingStep={modal.startingStep}
        initialLayout={modal.layout}
        onClose={onClose}
        onSave={(values) => onSaveRecord("ListEmail", values, { id: modal.record?.id })}
      />
    );
  if (modal.type === "listAction")
    return (
      <ListActionModal
        modal={modal}
        data={data}
        recordLabels={recordLabels}
        campaignMembers={campaignMembers}
        onClose={onClose}
        onSaveRecord={onSaveRecord}
        onApply={onApplyListAction}
      />
    );
  if (modal.type === "leadConversionSuccess") return <LeadConversionSuccessModal modal={modal} onClose={onClose} />;
  if (modal.type === "quickTextFolder")
    return (
      <QuickTextFolderModal
        onClose={onClose}
        onSave={(values) => onApplyListAction("New Folder", "QuickText", [], values)}
      />
    );
  if (modal.type === "marketingActivation")
    return (
      <MarketingActivationModal
        user={data.user}
        initial={modal.record}
        onClose={onClose}
        onSave={(values) => onApplyListAction("Activate Marketing", "ListEmail", [], values)}
      />
    );
  if (modal.type === "reportBuilder")
    return (
      <ReportBuilderModal
        reportType={modal.reportType}
        initial={modal.record}
        data={data}
        onClose={onClose}
        onDataChange={onDataChange}
        onToast={onToast}
      />
    );
  return (
    <GenericRecordModal
      mode={modal.mode}
      object={modal.object}
      data={data}
      record={modal.record}
      onClose={onClose}
      onSave={(values, stayOpen) => onSaveRecord(modal.object, values, { id: modal.record?.id, stayOpen })}
    />
  );
}
