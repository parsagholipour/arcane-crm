"use client";

import { cn } from "@/lib/utils";
import { OBJECT_DEFINITIONS } from "@/lib/crm-metadata";
import { decorateScopedData, recordTitle } from "@/lib/crm-data";
import { pathnameWithSearch } from "@/features/routing/lightning-route";
import { ToastHost } from "@/components/ui/crm-primitives";
import { ModalHost } from "@/features/crm/modal-host";
import { requiredId, defaultRouteForObject } from "@/features/crm/record-model";
import { FeatureScreen } from "@/features/crm/router";
import { AppNavBar, ConsoleTabs, GlobalHeader, LeftAppRail } from "@/features/crm/shell";
import { resolveRequestedListView } from "@/features/crm/shell-model";
import { type useCrmController } from "@/features/crm/crm-controller";

export function CrmAppView({ controller }: { controller: ReturnType<typeof useCrmController> }) {
  const {
    router,
    pathname,
    searchParams,
    data,
    setData,
    modal,
    setModal,
    toast,
    screen,
    compactDensity,
    showConsoleTabs,
    consoleTabs,
    setConsoleTabs,
    recordLabels,
    campaignMembers,
    showToast,
    getRecords,
    openCreate,
    openEdit,
    applyInvoiceMutation,
    applyCommunicationsMutation,
    removeCommunication,
    applyCampaignMutation,
    closeModal,
    refreshScopedCrmData,
    saveRecord,
    deleteRecord,
    deleteRecords,
    deleteEventOccurrence,
    saveActivity,
    saveFile,
    deleteFile,
    applyListAction,
    saveAppNavPreference,
    resetAppNavPreference
  } = controller;
  return (
    <div className={cn("flex h-screen overflow-hidden bg-canvas text-[#181818]", compactDensity && "text-[13px]")}>
      <LeftAppRail activeApp={screen.activeApp} />
      <div className="flex min-w-0 flex-1 flex-col">
        <GlobalHeader
          data={data}
          pathname={pathnameWithSearch(pathname, searchParams)}
          onNavigate={(href) => router.push(href)}
          onOpenDraft={(draft) =>
            setModal({
              type: "listEmail",
              startingStep: 2,
              layout: "Plain Text",
              initialValues: {
                recipientType: "Leads and Contacts",
                status: "Draft",
                recipients: draft.recipientIds,
                subject: draft.subject,
                body: draft.body,
                scheduleTime: "09:00"
              }
            })
          }
          onDataChange={(updater) => setData((previous) => decorateScopedData(updater(previous)))}
          onToast={showToast}
        />
        <AppNavBar
          data={data}
          activeApp={screen.activeApp}
          pathname={pathname}
          onEditNav={() => setModal({ type: "navEdit", app: screen.activeApp })}
        />
        {showConsoleTabs && (
          <ConsoleTabs
            tabs={consoleTabs}
            activeHref={pathnameWithSearch(pathname, searchParams)}
            onClose={(href) => setConsoleTabs((tabs) => tabs.filter((tab) => tab.href !== href))}
          />
        )}
        <main className="slds-scrollbar min-h-0 flex-1 overflow-auto p-3">
          <div key={pathname} className="crm-screen-enter">
            <FeatureScreen
              screen={screen}
              data={data}
              getRecords={getRecords}
              onCreate={openCreate}
              onEdit={openEdit}
              onDelete={(object, record) =>
                setModal({
                  type: "confirm",
                  title: `Delete ${recordTitle(object, record)}?`,
                  body: "This action can't be undone.",
                  onConfirm: () => {
                    setModal(null);
                    return deleteRecord(object, requiredId(record));
                  }
                })
              }
              onDeleteRecords={(object, records, onDeleted) =>
                setModal({
                  type: "confirm",
                  title: `Delete ${records.length} selected ${(records.length === 1
                    ? OBJECT_DEFINITIONS[object].label
                    : OBJECT_DEFINITIONS[object].plural
                  ).toLowerCase()}?`,
                  body: "This action can't be undone.",
                  onConfirm: async () => {
                    setModal(null);
                    const deletedIds = await deleteRecords(object, records.map(requiredId));
                    if (deletedIds.length) onDeleted?.();
                  }
                })
              }
              onSaveActivity={saveActivity}
              onSaveFile={saveFile}
              onDeleteFile={deleteFile}
              onOpenEvent={(relatedObjectType, relatedRecordId, startDate, startTime, endTime) =>
                setModal({
                  type: "event",
                  mode: "new",
                  relatedObjectType,
                  relatedRecordId,
                  startDate,
                  startTime,
                  endDate: startDate,
                  endTime
                })
              }
              onEditEvent={(record, occurrence) =>
                setModal({
                  type: "event",
                  mode: "edit",
                  record,
                  occurrenceStart: occurrence.occurrenceStart,
                  recurring: occurrence.recurring
                })
              }
              onNavigate={(href) => router.push(href)}
              onToast={showToast}
              recordLabels={recordLabels}
              campaignMembers={campaignMembers}
              onListAction={(action, object, records, selectedIds) =>
                setModal({ type: "listAction", action, object, records, selectedIds })
              }
              onQuickTextFolder={() => setModal({ type: "quickTextFolder" })}
              onMarketingActivation={() =>
                setModal({ type: "marketingActivation", record: data.marketingActivations[0] })
              }
              onReportBuilder={(reportType, record) => setModal({ type: "reportBuilder", reportType, record })}
              onSaveRecord={saveRecord}
              onDataChange={(updater) => setData((previous) => decorateScopedData(updater(previous)))}
              onInvoiceChanged={applyInvoiceMutation}
              onInvoiceDeleted={(id) =>
                setData((previous) =>
                  decorateScopedData({
                    ...previous,
                    invoices: previous.invoices.filter((invoice) => invoice.id !== id)
                  })
                )
              }
              onOpenInvoicePayment={(invoice) => setModal({ type: "invoicePayment", invoice })}
              onCommunicationsChanged={applyCommunicationsMutation}
              onCommunicationsDeleted={removeCommunication}
              onCampaignChanged={applyCampaignMutation}
              onCampaignDeleted={(id) => {
                setData((previous) =>
                  decorateScopedData({
                    ...previous,
                    campaigns: previous.campaigns.filter((campaign) => campaign.id !== id)
                  })
                );
                router.push(defaultRouteForObject("Campaign"));
              }}
              listSearchQuery={searchParams.get("search") ?? ""}
              listViewName={
                screen.kind === "list"
                  ? resolveRequestedListView(screen.object, searchParams.get("filterName"), data.listViewPreferences)
                  : ""
              }
              analyticsReportName={searchParams.get("report") ?? ""}
              onRefreshData={refreshScopedCrmData}
            />
          </div>
        </main>
      </div>
      <ModalHost
        modal={modal}
        data={data}
        recordLabels={recordLabels}
        campaignMembers={campaignMembers}
        onClose={closeModal}
        onSaveRecord={saveRecord}
        onDeleteEvent={deleteEventOccurrence}
        onSaveAppNav={saveAppNavPreference}
        onResetAppNav={resetAppNavPreference}
        onDataChange={(updater) => setData((previous) => decorateScopedData(updater(previous)))}
        onToast={showToast}
        onInvoiceSaved={(result, mode) => {
          applyInvoiceMutation(result);
          setModal(null);
          showToast({
            tone: "success",
            message:
              mode === "new"
                ? `${String(result.invoice.invoiceNumber)} created as a Draft.`
                : mode === "payment"
                  ? "Payment recorded. No money was processed by the CRM."
                  : `${String(result.invoice.invoiceNumber)} updated.`
          });
          router.push(`/lightning/r/Invoice/${String(result.invoice.id)}/view`);
        }}
        onCommunicationsSaved={(result) => {
          applyCommunicationsMutation(result);
          setModal(null);
          const record = result.session ?? result.videoCall;
          if (record?.id)
            router.push(`/lightning/r/${result.session ? "MessagingSession" : "VideoCall"}/${String(record.id)}/view`);
        }}
        onCampaignSaved={(result) => {
          applyCampaignMutation(result);
          setModal(null);
          if (result.campaign?.id) router.push(`/lightning/r/Campaign/${String(result.campaign.id)}/view`);
        }}
        onApplyListAction={(action, object, selectedIds, payload) =>
          applyListAction(action, object, selectedIds, payload)
        }
      />
      <ToastHost toast={toast} />
    </div>
  );
}
