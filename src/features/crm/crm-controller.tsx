"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { OBJECT_DEFINITIONS } from "@/lib/crm-metadata";
import { dataKeyForObject, decorateScopedData, routeForRecord } from "@/lib/crm-data";
import { recentlyViewedEntryForRecord } from "@/lib/recent-records";
import { type ScopedCrmData, type CrmObject, type RecordData } from "@/lib/crm-types";
import { type InvoiceMutationResult } from "@/components/crm/InvoiceWorkspace";
import { type CommunicationsMutationResult } from "@/components/crm/CommunicationsWorkspace";
import { type CampaignMutationResult } from "@/components/crm/CampaignWorkspace";
import { isCrmObject, parseLightningRoute } from "@/features/routing/lightning-route";
import { type ToastState } from "@/components/ui/crm-primitives";
import { campaignMembersFromData, enrichLocalRecord, isRecordData, labelsFromData } from "@/features/crm/data-model";
import { defaultRouteForObject, objectFromObjectRoute, requiredId } from "@/features/crm/record-model";
import { notificationForSavedRecord } from "@/features/crm/record-mutations";
import { type ConsoleTab, type FileUploadRequest, type ModalState } from "@/features/crm/shared-types";
import { screenToTab } from "@/features/crm/shell-model";
import { createCrmWorkflowActions } from "@/features/crm/workflow-actions";
import { crmQueryKeys } from "@/lib/query/core";
import { apiRequest, jsonBody } from "@/lib/api/client";
import { resourceApi } from "@/lib/api/resources";

export function useCrmController(initialData: ScopedCrmData) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [data, setData] = useState<ScopedCrmData>(() => decorateScopedData(initialData));
  const [modal, setModal] = useState<ModalState | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const toastTimerRef = useRef<number | null>(null);
  const recentlyViewedRecordRef = useRef("");
  const previousOrganizationIdRef = useRef(initialData.organization.id);
  const [consoleTabs, setConsoleTabs] = useState<ConsoleTab[]>([]);
  const [recordLabels, setRecordLabels] = useState<Record<string, string[]>>(() =>
    labelsFromData(initialData.recordLabels)
  );
  const [campaignMembers, setCampaignMembers] = useState<Record<string, string[]>>(() =>
    campaignMembersFromData(initialData.campaignMembers, initialData.campaigns)
  );

  const screen = useMemo(() => parseLightningRoute(pathname, searchParams), [pathname, searchParams]);
  const activePreferences = data.userPreferences[0] ?? {
    displayDensity: "Comfy",
    guidanceEnabled: true,
    consoleTabsEnabled: true
  };
  const compactDensity = activePreferences.displayDensity === "Compact";
  const showConsoleTabs = activePreferences.consoleTabsEnabled !== false;

  useEffect(() => {
    setData(decorateScopedData(initialData));
    setRecordLabels(labelsFromData(initialData.recordLabels));
    setCampaignMembers(campaignMembersFromData(initialData.campaignMembers, initialData.campaigns));
  }, [initialData]);

  useEffect(() => {
    const previousOrganizationId = previousOrganizationIdRef.current;
    if (previousOrganizationId === data.organization.id) return;
    queryClient.removeQueries({ queryKey: crmQueryKeys.all(previousOrganizationId) });
    previousOrganizationIdRef.current = data.organization.id;
  }, [data.organization.id, queryClient]);

  useEffect(() => {
    const tab = screenToTab(screen, pathname, searchParams);
    setConsoleTabs((tabs) => {
      if (tabs.some((item) => item.href === tab.href)) return tabs;
      return [...tabs.slice(-7), tab];
    });
  }, [pathname, screen, searchParams]);

  useEffect(() => {
    if (screen.kind !== "record") {
      recentlyViewedRecordRef.current = "";
      return;
    }

    const key = `${screen.object}:${screen.id}`;
    const record = getRecords(screen.object).find((item) => item.id === screen.id);
    if (!record || recentlyViewedRecordRef.current === key) return;
    recentlyViewedRecordRef.current = key;
    void saveRecentlyViewedRecord(screen.object, record);
    // Record data is available in the initial Bootstrap payload whenever the route changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  useEffect(() => {
    const segments = pathname.split("/").filter(Boolean);
    if (segments[0] !== "lightning") return;
    if (segments[1] === "o" && isCrmObject(segments[2]) && segments[3] === "new") {
      openCreate(segments[2]);
    }
    if (segments[1] === "r" && isCrmObject(segments[2]) && segments[4] === "edit") {
      const record = getRecords(segments[2]).find((item) => item.id === segments[3]);
      if (record) openEdit(segments[2], record);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  function showToast(next: ToastState) {
    setToast(next);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3200);
  }

  function getRecords(object: CrmObject) {
    return data[dataKeyForObject(object)] as RecordData[];
  }

  function openCreate(object: CrmObject) {
    if (object === "Invoice") setModal({ type: "invoice", mode: "new" });
    else if (object === "Campaign") setModal({ type: "campaign", mode: "new" });
    else if (object === "MessagingSession") setModal({ type: "messaging", mode: "new" });
    else if (object === "VideoCall") setModal({ type: "videoCall", mode: "new" });
    else if (object === "Product2") setModal({ type: "product" });
    else if (object === "Event") setModal({ type: "event" });
    else if (object === "QuickText") setModal({ type: "quickText" });
    else if (object === "Knowledge__kav") setModal({ type: "knowledge" });
    else if (object === "ListEmail") setModal({ type: "listEmail" });
    else setModal({ type: "record", mode: "new", object });
  }

  function openEdit(object: CrmObject, record: RecordData) {
    if (object === "Invoice" && record.status !== "Draft") {
      showToast({ tone: "warning", message: "Only Draft invoices can be edited." });
      if (pathname.endsWith("/edit")) router.push(`/lightning/r/Invoice/${requiredId(record)}/view`);
    } else if (object === "Invoice") setModal({ type: "invoice", mode: "edit", record });
    else if (object === "MessagingSession") setModal({ type: "messaging", mode: "edit", record });
    else if (object === "VideoCall") setModal({ type: "videoCall", mode: "edit", record });
    else if (object === "Campaign") setModal({ type: "campaign", mode: "edit", record });
    else if (object === "Event") setModal({ type: "event", mode: "edit", record });
    else if (object === "QuickText") setModal({ type: "quickText", record });
    else if (object === "Knowledge__kav") setModal({ type: "knowledge", record });
    else if (object === "ListEmail" && record.status !== "Draft")
      showToast({ tone: "warning", message: "Sent or scheduled list emails cannot be edited." });
    else if (object === "ListEmail")
      setModal({
        type: "listEmail",
        record,
        initialValues: record,
        startingStep: 1,
        layout: String(record.layoutType ?? "Sales")
      });
    else setModal({ type: "record", mode: "edit", object, record });
  }

  function applyInvoiceMutation(result: InvoiceMutationResult) {
    if (!result.invoice?.id) return;
    void saveRecentlyViewedRecord("Invoice", result.invoice);
    setData((previous) => {
      const invoice = result.invoice;
      const invoices = previous.invoices.some((item) => item.id === invoice.id)
        ? previous.invoices.map((item) => (item.id === invoice.id ? { ...item, ...invoice } : item))
        : [invoice, ...previous.invoices];
      const incomingNotifications = Array.isArray(result.notifications) ? result.notifications : [];
      const incomingIds = new Set(incomingNotifications.map((item) => item.id));
      const incomingDelivery = result.delivery;
      const emailDeliveries = incomingDelivery?.id
        ? [incomingDelivery, ...previous.emailDeliveries.filter((item) => item.id !== incomingDelivery.id)]
        : previous.emailDeliveries;
      return decorateScopedData({
        ...previous,
        invoices,
        emailDeliveries,
        notifications: [...incomingNotifications, ...previous.notifications.filter((item) => !incomingIds.has(item.id))]
      });
    });
  }

  function applyCommunicationsMutation(result: CommunicationsMutationResult) {
    if (result.session?.id) void saveRecentlyViewedRecord("MessagingSession", result.session);
    if (result.videoCall?.id) void saveRecentlyViewedRecord("VideoCall", result.videoCall);
    setData((previous) => {
      const incomingNotifications = Array.isArray(result.notifications) ? result.notifications : [];
      const incomingIds = new Set(incomingNotifications.map((item) => item.id));
      const next = {
        ...previous,
        notifications: [...incomingNotifications, ...previous.notifications.filter((item) => !incomingIds.has(item.id))]
      };
      if (result.session?.id) {
        next.messagingSessions = previous.messagingSessions.some((item) => item.id === result.session!.id)
          ? previous.messagingSessions.map((item) =>
              item.id === result.session!.id ? { ...item, ...result.session } : item
            )
          : [result.session, ...previous.messagingSessions];
      }
      if (result.videoCall?.id) {
        next.videoCalls = previous.videoCalls.some((item) => item.id === result.videoCall!.id)
          ? previous.videoCalls.map((item) =>
              item.id === result.videoCall!.id ? { ...item, ...result.videoCall } : item
            )
          : [result.videoCall, ...previous.videoCalls];
      }
      return decorateScopedData(next);
    });
  }

  function removeCommunication(object: "MessagingSession" | "VideoCall", id: string) {
    const key = object === "MessagingSession" ? "messagingSessions" : "videoCalls";
    setData((previous) => decorateScopedData({ ...previous, [key]: previous[key].filter((item) => item.id !== id) }));
    router.push(defaultRouteForObject(object));
  }

  function applyCampaignMutation(result: CampaignMutationResult) {
    if (!result.campaign?.id) return;
    void saveRecentlyViewedRecord("Campaign", result.campaign);
    setData((previous) => {
      const campaigns = previous.campaigns.some((item) => item.id === result.campaign!.id)
        ? previous.campaigns.map((item) => (item.id === result.campaign!.id ? { ...item, ...result.campaign } : item))
        : [result.campaign!, ...previous.campaigns];
      const notifications = Array.isArray(result.notifications) ? result.notifications : [];
      const notificationIds = new Set(notifications.map((item) => item.id));
      return decorateScopedData({
        ...previous,
        campaigns,
        notifications: [...notifications, ...previous.notifications.filter((item) => !notificationIds.has(item.id))]
      });
    });
  }

  function closeModal() {
    setModal(null);
    if (pathname.endsWith("/new")) {
      const object = objectFromObjectRoute(pathname);
      router.push(defaultRouteForObject(object ?? (screen.kind === "list" ? screen.object : "Lead")));
    }
    if (pathname.endsWith("/edit")) {
      router.push(pathname.replace("/edit", "/view"));
    }
  }

  async function createAppNotification(values: {
    title: string;
    body: string;
    href?: string | null;
    category: string;
  }) {
    const response = await resourceApi.createNotification(values);
    if (Array.isArray(response?.notifications)) {
      setData((previous) => ({ ...previous, notifications: response.notifications as RecordData[] }));
      return null;
    }
    const notification = response?.notification as RecordData | undefined;
    if (!notification?.id) return null;
    setData((previous) => ({
      ...previous,
      notifications: [notification, ...previous.notifications.filter((item) => item.id !== notification.id)]
    }));
    return notification;
  }

  async function refreshScopedCrmData(successMessage: string) {
    await queryClient.invalidateQueries({ queryKey: crmQueryKeys.all(data.organization.id) });
    router.refresh();
    if (successMessage) showToast({ tone: "success", message: successMessage });
    return true;
  }

  async function saveRecentlyViewedRecord(object: CrmObject, record: RecordData) {
    const values = recentlyViewedEntryForRecord(object, record);
    if (!values) return;
    const response = await resourceApi.saveSearchRecent(values);
    if (!Array.isArray(response?.globalSearchRecents)) return;
    setData((previous) => ({ ...previous, globalSearchRecents: response.globalSearchRecents as RecordData[] }));
  }

  async function saveRecord(object: CrmObject, values: RecordData, options: { id?: string; stayOpen?: boolean } = {}) {
    const key = dataKeyForObject(object);
    const method = options.id ? "PATCH" : "POST";
    const url = options.id ? `/api/records/${object}/${options.id}` : `/api/records/${object}`;
    let json: RecordData;
    try {
      json = await apiRequest<RecordData>(url, { method, body: jsonBody(values) });
    } catch (error) {
      showToast({
        tone: "error",
        message: error instanceof Error ? error.message : "The record couldn't be saved."
      });
      return false;
    }

    const responseRecord = isRecordData(json.record) ? json.record : {};
    const record = enrichLocalRecord(
      object,
      { ...values, ...responseRecord, id: options.id ?? responseRecord.id },
      data.user.id
    );
    setData((previous) => {
      const records = previous[key] as RecordData[];
      const nextRecords = options.id
        ? records.map((item) => (item.id === options.id ? { ...item, ...record } : item))
        : [record, ...records];
      const nextData = { ...previous, [key]: nextRecords } as ScopedCrmData;

      if (object === "Product2") {
        const priceBook = responseRecord.priceBook as RecordData | null | undefined;
        const priceBookEntry = responseRecord.priceBookEntry as RecordData | null | undefined;

        if (priceBook?.id) {
          nextData.priceBooks = previous.priceBooks.some((item) => item.id === priceBook.id)
            ? previous.priceBooks.map((item) => (item.id === priceBook.id ? { ...item, ...priceBook } : item))
            : [priceBook, ...previous.priceBooks];
        }

        if (priceBookEntry?.id) {
          nextData.priceBookEntries = previous.priceBookEntries.some((item) => item.id === priceBookEntry.id)
            ? previous.priceBookEntries.map((item) =>
                item.id === priceBookEntry.id ? { ...item, ...priceBookEntry } : item
              )
            : [priceBookEntry, ...previous.priceBookEntries];
        }
      }

      return decorateScopedData(nextData);
    });

    if (!options.id) await saveRecentlyViewedRecord(object, record);
    await queryClient.invalidateQueries({
      queryKey: [...crmQueryKeys.all(data.organization.id), "records", object]
    });
    void createAppNotification(
      notificationForSavedRecord(object, record, Boolean(options.id), values, Boolean(json.delivery))
    );
    showToast(
      json.warning
        ? { tone: "warning", message: String(json.warning) }
        : { tone: "success", message: String(json.message ?? `${OBJECT_DEFINITIONS[object].label} saved.`) }
    );
    if (!options.stayOpen) closeModal();
    return true;
  }

  async function deleteRecord(object: CrmObject, id: string) {
    const url =
      object === "Invoice"
        ? `/api/invoices/${id}`
        : object === "MessagingSession"
          ? `/api/messaging-sessions/${id}`
          : object === "VideoCall"
            ? `/api/video-calls/${id}`
            : object === "Campaign"
              ? `/api/campaigns/${id}`
              : `/api/records/${object}/${id}`;
    try {
      await apiRequest<RecordData>(url, { method: "DELETE" });
    } catch (error) {
      showToast({
        tone: "error",
        message: error instanceof Error ? error.message : "The record couldn't be deleted."
      });
      return;
    }

    const key = dataKeyForObject(object);
    setData((previous) =>
      decorateScopedData({
        ...previous,
        [key]: (previous[key] as RecordData[]).filter((record) => record.id !== id)
      } as ScopedCrmData)
    );
    void createAppNotification({
      title: `${OBJECT_DEFINITIONS[object].label} deleted`,
      body: `${OBJECT_DEFINITIONS[object].label} ${id} was removed from the workspace.`,
      category: "Records"
    });
    await queryClient.invalidateQueries({
      queryKey: [...crmQueryKeys.all(data.organization.id), "records", object]
    });
    showToast({ tone: "success", message: `${OBJECT_DEFINITIONS[object].label} deleted.` });
    router.push(defaultRouteForObject(object));
  }

  /** Delete from the event modal, which can target one occurrence of a series instead of the whole thing. */
  async function deleteEventOccurrence(record: RecordData, scope: "single" | "all", occurrenceStart: string | null) {
    const id = requiredId(record);
    if (!id) return;
    const params = new URLSearchParams({ scope });
    if (occurrenceStart) params.set("occurrenceStart", occurrenceStart);
    let json: RecordData;
    try {
      json = await apiRequest<RecordData>(`/api/records/Event/${id}?${params.toString()}`, {
        method: "DELETE"
      });
    } catch (error) {
      showToast({
        tone: "error",
        message: error instanceof Error ? error.message : "The event couldn't be deleted."
      });
      return;
    }
    closeModal();
    if (scope === "all")
      setData((previous) =>
        decorateScopedData({ ...previous, events: previous.events.filter((item) => item.id !== id) })
      );
    showToast({ tone: "success", message: String(json.message ?? "Event deleted.") });
    await refreshScopedCrmData("");
  }

  async function saveActivity(activity: RecordData) {
    let json: RecordData;
    try {
      json = await apiRequest<RecordData>("/api/activity", {
        method: "POST",
        body: jsonBody(activity)
      });
    } catch (error) {
      showToast({
        tone: "error",
        message: error instanceof Error ? error.message : "The activity couldn't be saved."
      });
      return false;
    }
    const record = json.record ?? { ...activity, id: `${activity.type}-${Date.now()}` };
    setData((previous) => {
      const key = activity.type === "email" ? "emailActivities" : activity.type === "call" ? "callActivities" : "tasks";
      return {
        ...previous,
        [key]: [record, ...(previous[key] as RecordData[])]
      } as ScopedCrmData;
    });
    void createAppNotification({
      title:
        activity.type === "email"
          ? activity.emailAction === "send"
            ? "Email sent"
            : "Email activity logged"
          : activity.type === "call"
            ? "Call logged"
            : "Task created",
      body: String(activity.subject ?? activity.notes ?? "Activity was added to the timeline."),
      href:
        activity.relatedObjectType && activity.relatedRecordId
          ? routeForRecord(String(activity.relatedObjectType) as CrmObject, String(activity.relatedRecordId))
          : undefined,
      category: "Activity"
    });
    showToast({
      tone: "success",
      message:
        activity.type === "email"
          ? activity.emailAction === "send"
            ? "Email accepted for delivery."
            : "Email activity logged."
          : activity.type === "call"
            ? "Call logged."
            : "Task created."
    });
    return true;
  }

  async function saveFile(upload: FileUploadRequest, attachment = false) {
    const payload = new FormData();
    payload.set("file", upload.file);
    payload.set("attachment", String(attachment));
    payload.set("relatedObjectType", upload.relatedObjectType);
    payload.set("relatedRecordId", upload.relatedRecordId);
    let json: RecordData;
    try {
      json = await apiRequest<RecordData>("/api/files", { method: "POST", body: payload });
    } catch (error) {
      showToast({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : attachment
              ? "The attachment couldn't be uploaded."
              : "The file couldn't be uploaded."
      });
      return false;
    }
    const record = json.record as RecordData;
    setData((previous) => ({
      ...previous,
      [attachment ? "attachments" : "files"]: [
        record,
        ...(previous[attachment ? "attachments" : "files"] as RecordData[])
      ]
    }));
    void createAppNotification({
      title: attachment ? "Attachment uploaded" : "File uploaded",
      body: String(record.name ?? "A file was added to the workspace."),
      href: routeForRecord(upload.relatedObjectType, upload.relatedRecordId),
      category: "Files"
    });
    showToast({ tone: "success", message: attachment ? "Attachment uploaded." : "File uploaded." });
    return true;
  }

  async function deleteFile(file: RecordData, attachment = false) {
    try {
      await apiRequest<RecordData>(
        `/api/files/${encodeURIComponent(requiredId(file))}?kind=${attachment ? "attachment" : "file"}`,
        { method: "DELETE" }
      );
    } catch (error) {
      showToast({
        tone: "error",
        message: error instanceof Error ? error.message : "The file couldn't be deleted."
      });
      return false;
    }
    setData((previous) => ({
      ...previous,
      [attachment ? "attachments" : "files"]: (previous[attachment ? "attachments" : "files"] as RecordData[]).filter(
        (item) => item.id !== file.id
      )
    }));
    showToast({ tone: "success", message: attachment ? "Attachment deleted." : "File deleted." });
    return true;
  }

  const { applyListAction, saveAppNavPreference, resetAppNavPreference } = createCrmWorkflowActions({
    data,
    setData,
    setModal,
    setRecordLabels,
    setCampaignMembers,
    showToast,
    closeModal,
    createAppNotification
  });

  return {
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
    deleteEventOccurrence,
    saveActivity,
    saveFile,
    deleteFile,
    applyListAction,
    saveAppNavPreference,
    resetAppNavPreference
  };
}
