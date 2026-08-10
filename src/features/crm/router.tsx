"use client";

import dynamic from "next/dynamic";
import { type ScopedCrmData, type CrmObject, type RecordData } from "@/lib/crm-types";
import { type InvoiceMutationResult } from "@/components/crm/InvoiceWorkspace";
import { type CommunicationsMutationResult } from "@/components/crm/CommunicationsWorkspace";
import { type CampaignMutationResult } from "@/components/crm/CampaignWorkspace";
import { type ScreenDescriptor as ScreenState } from "@/lib/api/contracts";
import { LoadingPanel, NotFoundPanel, type ToastState } from "@/components/ui/crm-primitives";
import { requiredId } from "@/features/crm/record-model";
import { type ScopedCrmDataUpdater, type FileUploadRequest, type SaveRecordHandler } from "@/features/crm/shared-types";

const loading = () => <LoadingPanel label="Loading workspace…" />;
const HomePage = dynamic(() => import("@/features/crm/home").then((module) => module.HomePage), { loading });
const MarketingPage = dynamic(() => import("@/features/crm/marketing").then((module) => module.MarketingPage), {
  loading
});
const AnalyticsPage = dynamic(() => import("@/features/crm/analytics").then((module) => module.AnalyticsPage), {
  loading
});
const QuickTextPage = dynamic(() => import("@/features/crm/quick-text").then((module) => module.QuickTextPage), {
  loading
});
const ListViewPage = dynamic(() => import("@/features/crm/list-page").then((module) => module.ListViewPage), {
  loading
});
const RecordPage = dynamic(() => import("@/features/crm/record-page").then((module) => module.RecordPage), { loading });
const YourAccountPage = dynamic(() => import("@/features/crm/account").then((module) => module.YourAccountPage), {
  loading
});
const CommerceWorkspace = dynamic(
  () => import("@/components/crm/CommerceWorkspace").then((module) => module.CommerceWorkspace),
  { loading }
);
const CalendarWorkspace = dynamic(
  () => import("@/components/crm/CalendarWorkspace").then((module) => module.CalendarWorkspace),
  { loading }
);
const InvoiceDetailPage = dynamic(
  () => import("@/components/crm/InvoiceWorkspace").then((module) => module.InvoiceDetailPage),
  { loading }
);
const MessagingSessionDetailPage = dynamic(
  () => import("@/components/crm/CommunicationsWorkspace").then((module) => module.MessagingSessionDetailPage),
  { loading }
);
const VideoCallDetailPage = dynamic(
  () => import("@/components/crm/CommunicationsWorkspace").then((module) => module.VideoCallDetailPage),
  { loading }
);
const CampaignDetailPage = dynamic(
  () => import("@/components/crm/CampaignWorkspace").then((module) => module.CampaignDetailPage),
  { loading }
);
const PriceBookDetailPage = dynamic(
  () => import("@/components/crm/CatalogWorkspace").then((module) => module.PriceBookDetailPage),
  { loading }
);
const ProductDetailPage = dynamic(
  () => import("@/components/crm/CatalogWorkspace").then((module) => module.ProductDetailPage),
  { loading }
);
const KnowledgeDetailPage = dynamic(
  () => import("@/components/crm/RecordDetailWorkspace").then((module) => module.KnowledgeDetailPage),
  { loading }
);
const ListEmailDetailPage = dynamic(
  () => import("@/components/crm/RecordDetailWorkspace").then((module) => module.ListEmailDetailPage),
  { loading }
);
const SalesRecordDetailPage = dynamic(
  () => import("@/components/crm/RecordDetailWorkspace").then((module) => module.SalesRecordDetailPage),
  { loading }
);

export function FeatureScreen({
  screen,
  data,
  getRecords,
  onCreate,
  onEdit,
  onDelete,
  onDeleteRecords,
  onSaveActivity,
  onSaveFile,
  onDeleteFile,
  onOpenEvent,
  onEditEvent,
  onNavigate,
  onToast,
  recordLabels,
  campaignMembers,
  onListAction,
  onQuickTextFolder,
  onMarketingActivation,
  onReportBuilder,
  onSaveRecord,
  onDataChange,
  onInvoiceChanged,
  onInvoiceDeleted,
  onOpenInvoicePayment,
  onCommunicationsChanged,
  onCommunicationsDeleted,
  onCampaignChanged,
  onCampaignDeleted,
  listSearchQuery,
  listViewName,
  analyticsReportName,
  onRefreshData
}: {
  screen: ScreenState;
  data: ScopedCrmData;
  getRecords: (object: CrmObject) => RecordData[];
  onCreate: (object: CrmObject, initialValues?: RecordData) => void;
  onEdit: (object: CrmObject, record: RecordData) => void;
  onDelete: (object: CrmObject, record: RecordData) => void;
  onDeleteRecords: (object: CrmObject, records: RecordData[], onDeleted?: () => void) => void;
  onSaveActivity: (activity: RecordData) => Promise<boolean>;
  onSaveFile: (file: FileUploadRequest, attachment?: boolean) => Promise<boolean>;
  onDeleteFile: (file: RecordData, attachment?: boolean) => Promise<boolean>;
  onOpenEvent: (object: CrmObject, id: string, startDate?: string, startTime?: string, endTime?: string) => void;
  onEditEvent: (record: RecordData, occurrence: { occurrenceStart: string | null; recurring: boolean }) => void;
  onNavigate: (href: string) => void;
  onToast: (toast: ToastState) => void;
  recordLabels: Record<string, string[]>;
  campaignMembers: Record<string, string[]>;
  onListAction: (action: string, object: CrmObject, records: RecordData[], selectedIds: string[]) => void;
  onQuickTextFolder: () => void;
  onMarketingActivation: () => void;
  onReportBuilder: (reportType?: string, record?: RecordData) => void;
  onSaveRecord: SaveRecordHandler;
  onDataChange: ScopedCrmDataUpdater;
  onInvoiceChanged: (result: InvoiceMutationResult) => void;
  onInvoiceDeleted: (id: string) => void;
  onOpenInvoicePayment: (invoice: RecordData) => void;
  onCommunicationsChanged: (result: CommunicationsMutationResult) => void;
  onCommunicationsDeleted: (object: "MessagingSession" | "VideoCall", id: string) => void;
  onCampaignChanged: (result: CampaignMutationResult) => void;
  onCampaignDeleted: (id: string) => void;
  listSearchQuery: string;
  listViewName: string;
  analyticsReportName: string;
  onRefreshData: (successMessage: string) => Promise<boolean>;
}) {
  if (screen.kind === "home")
    return (
      <HomePage
        data={data}
        onReportBuilder={onReportBuilder}
        onDataChange={onDataChange}
        onToast={onToast}
        onRefreshData={onRefreshData}
      />
    );
  if (screen.kind === "marketing")
    return (
      <MarketingPage
        data={data}
        onCreate={onCreate}
        onActivate={onMarketingActivation}
        onDataChange={onDataChange}
        onToast={onToast}
      />
    );
  if (screen.kind === "commerce")
    return <CommerceWorkspace data={data} onDataChange={onDataChange} onToast={onToast} />;
  if (screen.kind === "account") return <YourAccountPage data={data} onDataChange={onDataChange} onToast={onToast} />;
  if (screen.kind === "analytics")
    return (
      <AnalyticsPage
        data={data}
        reportName={analyticsReportName}
        onReportBuilder={onReportBuilder}
        onDataChange={onDataChange}
        onToast={onToast}
        onRefreshData={onRefreshData}
      />
    );
  if (screen.kind === "calendar") {
    return (
      <CalendarWorkspace
        data={data}
        onCreate={(startDate, startTime, endTime) => onOpenEvent("Event", "", startDate, startTime, endTime)}
        onEditEvent={onEditEvent}
        onOpenVideoCall={(record) => onEdit("VideoCall", record)}
        onDataChange={onDataChange}
        onToast={onToast}
        onRefreshData={onRefreshData}
        onNavigate={onNavigate}
      />
    );
  }
  if (screen.kind === "quickText")
    return (
      <QuickTextPage
        data={data}
        onCreate={() => onCreate("QuickText")}
        onCreateFolder={onQuickTextFolder}
        onEdit={(record) => onEdit("QuickText", record)}
        onDelete={(record) => onDelete("QuickText", record)}
        onDataChange={onDataChange}
        onToast={onToast}
      />
    );
  if (screen.kind === "record") {
    const record = getRecords(screen.object).find((item) => item.id === screen.id);
    if (!record) return <NotFoundPanel title="Record not found" body="The requested record could not be found." />;
    if (screen.object === "Invoice") {
      return (
        <InvoiceDetailPage
          initialInvoice={record}
          data={data}
          onEdit={() => onEdit("Invoice", record)}
          onChanged={onInvoiceChanged}
          onDeleted={onInvoiceDeleted}
          onOpenPayment={() => onOpenInvoicePayment(record)}
          onToast={onToast}
        />
      );
    }
    if (screen.object === "MessagingSession") {
      return (
        <MessagingSessionDetailPage
          initial={record}
          data={data}
          onEdit={() => onEdit("MessagingSession", record)}
          onChanged={onCommunicationsChanged}
          onDeleted={(id) => onCommunicationsDeleted("MessagingSession", id)}
          onToast={onToast}
        />
      );
    }
    if (screen.object === "VideoCall") {
      return (
        <VideoCallDetailPage
          initial={record}
          data={data}
          onEdit={() => onEdit("VideoCall", record)}
          onChanged={onCommunicationsChanged}
          onDeleted={(id) => onCommunicationsDeleted("VideoCall", id)}
          onToast={onToast}
        />
      );
    }
    if (screen.object === "Campaign") {
      return (
        <CampaignDetailPage
          initial={record}
          data={data}
          onEdit={() => onEdit("Campaign", record)}
          onChanged={onCampaignChanged}
          onDeleted={onCampaignDeleted}
          onToast={onToast}
        />
      );
    }
    if (screen.object === "Product2") {
      return (
        <ProductDetailPage
          product={record}
          data={data}
          onDataChange={onDataChange}
          onDelete={() => onDelete("Product2", record)}
          onToast={onToast}
        />
      );
    }
    if (screen.object === "Pricebook2") {
      return (
        <PriceBookDetailPage
          priceBook={record}
          data={data}
          onDataChange={onDataChange}
          onDelete={() => onDelete("Pricebook2", record)}
          onToast={onToast}
        />
      );
    }
    if (screen.object === "Lead" || screen.object === "Opportunity" || screen.object === "Case") {
      return (
        <SalesRecordDetailPage
          object={screen.object}
          record={record}
          data={data}
          onEdit={() => onEdit(screen.object, record)}
          onDelete={() => onDelete(screen.object, record)}
          onChangeOwner={() => onListAction("Change Owner", screen.object, [record], [requiredId(record)])}
          onWorkflow={(action) => onListAction(action, screen.object, [record], [requiredId(record)])}
          onDataChange={onDataChange}
          onToast={onToast}
        />
      );
    }
    if (screen.object === "Knowledge__kav") {
      return (
        <KnowledgeDetailPage
          initial={record}
          data={data}
          onEdit={() => onEdit("Knowledge__kav", record)}
          onDelete={() => onDelete("Knowledge__kav", record)}
          onChanged={(article, notifications = []) =>
            onDataChange((previous) => ({
              ...previous,
              knowledgeArticles: previous.knowledgeArticles.map((item) =>
                item.id === article.id ? { ...item, ...article } : item
              ),
              notifications: [
                ...notifications,
                ...previous.notifications.filter((item) => !notifications.some((incoming) => incoming.id === item.id))
              ]
            }))
          }
          onToast={onToast}
        />
      );
    }
    if (screen.object === "ListEmail") {
      return (
        <ListEmailDetailPage
          email={record}
          data={data}
          onEdit={() => onEdit("ListEmail", record)}
          onDelete={() => onDelete("ListEmail", record)}
          onChanged={(email) =>
            onDataChange((previous) => ({
              ...previous,
              listEmails: previous.listEmails.map((item) => (item.id === email.id ? { ...item, ...email } : item))
            }))
          }
          onToast={onToast}
        />
      );
    }
    return (
      <RecordPage
        object={screen.object}
        record={record}
        data={data}
        onCreate={onCreate}
        onEdit={() => onEdit(screen.object, record)}
        onDelete={() => onDelete(screen.object, record)}
        onChangeOwner={() => onListAction("Change Owner", screen.object, [record], [requiredId(record)])}
        onRecordEdit={onEdit}
        onRecordDelete={onDelete}
        onSaveActivity={onSaveActivity}
        onSaveFile={onSaveFile}
        onDeleteFile={onDeleteFile}
        onOpenEvent={() => onOpenEvent(screen.object, requiredId(record))}
        onDataChange={onDataChange}
        onToast={onToast}
        onRefreshData={onRefreshData}
        labels={recordLabels[requiredId(record)] ?? []}
        campaigns={campaignMembers[requiredId(record)] ?? []}
      />
    );
  }

  return (
    <ListViewPage
      object={screen.object}
      data={data}
      records={getRecords(screen.object)}
      recordLabels={recordLabels}
      campaignMembers={campaignMembers}
      initialQuery={listSearchQuery}
      initialListView={listViewName}
      onCreate={onCreate}
      onEdit={onEdit}
      onDelete={onDelete}
      onDeleteRecords={onDeleteRecords}
      onToast={onToast}
      onListAction={onListAction}
      onSaveRecord={onSaveRecord}
      onDataChange={onDataChange}
    />
  );
}
