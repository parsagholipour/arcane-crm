import type { Dispatch, SetStateAction } from "react";
import { OBJECT_DEFINITIONS } from "@/lib/crm-metadata";
import { dataKeyForObject, decorateScopedData } from "@/lib/crm-data";
import type { AppKey, AppNavItem, ScopedCrmData, CrmObject, RecordData } from "@/lib/crm-types";
import type { ToastState } from "@/components/ui/crm-primitives";
import { isRecordData, leadConversionResultFromWorkflow, upsertRecordsById } from "@/features/crm/data-model";
import { resourceApi } from "@/lib/api/resources";
import { executeDomainAction, type DomainActionName } from "@/lib/api/domain-actions";
import { defaultRouteForObject, requiredId } from "@/features/crm/record-model";
import type { ModalState } from "@/features/crm/shared-types";
import { cleanNavItem } from "@/features/crm/shell-model";

type NotificationValues = {
  title: string;
  body: string;
  href?: string | null;
  category: string;
};

type WorkflowActionsOptions = {
  data: ScopedCrmData;
  setData: Dispatch<SetStateAction<ScopedCrmData>>;
  setModal: Dispatch<SetStateAction<ModalState | null>>;
  setRecordLabels: Dispatch<SetStateAction<Record<string, string[]>>>;
  setCampaignMembers: Dispatch<SetStateAction<Record<string, string[]>>>;
  showToast: (toast: ToastState) => void;
  closeModal: () => void;
  createAppNotification: (values: NotificationValues) => Promise<RecordData | null>;
};

export function createCrmWorkflowActions({
  data,
  setData,
  setModal,
  setRecordLabels,
  setCampaignMembers,
  showToast,
  closeModal,
  createAppNotification
}: WorkflowActionsOptions) {
  async function persistWorkflow(action: string, object: CrmObject, selectedIds: string[], payload: RecordData) {
    try {
      return await executeDomainAction({
        action: action as DomainActionName,
        object,
        selectedIds,
        values: payload
      });
    } catch (error) {
      showToast({
        tone: "error",
        message: error instanceof Error ? error.message : `${action} couldn't be completed.`
      });
      return null;
    }
  }

  async function applyListAction(action: string, object: CrmObject, selectedIds: string[], payload: RecordData) {
    const key = dataKeyForObject(object);
    const targetIds = selectedIds;
    const workflowResult = await persistWorkflow(action, object, targetIds, payload);
    if (!workflowResult) return;

    if (action === "Assign Label") {
      const label = String(payload.label ?? "Important");
      const labels = Array.isArray(workflowResult.labels)
        ? (workflowResult.labels as RecordData[])
        : targetIds.map((recordId) => ({
            id: `label-${recordId}-${label}`,
            objectType: object,
            recordId,
            label
          }));
      setRecordLabels((current) => {
        const next = { ...current };
        targetIds.forEach((id) => {
          next[id] = Array.from(new Set([...(next[id] ?? []), label]));
        });
        return next;
      });
      setData((previous) => ({
        ...previous,
        recordLabels: [...labels, ...previous.recordLabels]
      }));
      void createAppNotification({
        title: "Label assigned",
        body: `Label "${label}" was assigned to ${targetIds.length} ${OBJECT_DEFINITIONS[object].plural.toLowerCase()}.`,
        href: defaultRouteForObject(object),
        category: "Workflow"
      });
      showToast({
        tone: "success",
        message: `Label "${label}" assigned to ${targetIds.length} record${targetIds.length === 1 ? "" : "s"}.`
      });
      closeModal();
      return;
    }

    if (action === "Add to Campaign") {
      const campaign = String(payload.campaign ?? "Starter Outreach");
      const campaignRecord = isRecordData(workflowResult.campaign) ? workflowResult.campaign : null;
      const memberRecords = Array.isArray(workflowResult.campaignMembers)
        ? (workflowResult.campaignMembers as RecordData[])
        : [];
      setCampaignMembers((current) => {
        const next = { ...current };
        targetIds.forEach((id) => {
          next[id] = Array.from(new Set([...(next[id] ?? []), campaign]));
        });
        return next;
      });
      setData((previous) => ({
        ...previous,
        campaigns: campaignRecord
          ? [campaignRecord, ...previous.campaigns.filter((item) => item.id !== campaignRecord.id)]
          : previous.campaigns,
        campaignMembers: [...memberRecords, ...previous.campaignMembers]
      }));
      void createAppNotification({
        title: "Campaign members added",
        body: `${targetIds.length} ${OBJECT_DEFINITIONS[object].plural.toLowerCase()} added to ${campaign}.`,
        href: defaultRouteForObject(object),
        category: "Marketing"
      });
      showToast({
        tone: "success",
        message: `${targetIds.length} record${targetIds.length === 1 ? "" : "s"} added to ${campaign}.`
      });
      closeModal();
      return;
    }

    if (action === "Convert Lead" && object === "Lead") {
      const selectedLeads = data.leads.filter((lead) => targetIds.includes(requiredId(lead)));
      if (selectedLeads.length === 0) {
        showToast({ tone: "warning", message: "Select at least one lead to convert." });
        closeModal();
        return;
      }
      const conversion = leadConversionResultFromWorkflow(workflowResult);
      setData((previous) =>
        decorateScopedData({
          ...previous,
          accounts: upsertRecordsById(previous.accounts, conversion.accounts),
          contacts: upsertRecordsById(previous.contacts, conversion.contacts),
          opportunities: upsertRecordsById(previous.opportunities, conversion.opportunities),
          leads: upsertRecordsById(previous.leads, conversion.leads)
        })
      );
      const primaryAccount = conversion.accounts[0];
      void createAppNotification({
        title: "Lead converted",
        body: `${selectedLeads.length} lead${selectedLeads.length === 1 ? "" : "s"} converted to account and contact records.`,
        href: primaryAccount
          ? `/lightning/r/Account/${requiredId(primaryAccount)}/view`
          : defaultRouteForObject("Lead"),
        category: "Workflow"
      });
      showToast({
        tone: "success",
        message: `${selectedLeads.length} lead${selectedLeads.length === 1 ? "" : "s"} converted.`
      });
      setModal({
        type: "leadConversionSuccess",
        accounts: conversion.accounts,
        contacts: conversion.contacts,
        opportunities: conversion.opportunities,
        leads: conversion.leads
      });
      return;
    }

    if (action === "Change Owner") {
      const ownerId = String(payload.ownerId ?? data.user.id);
      const ownerName = data.users.find((user) => user.id === ownerId)?.name ?? data.user.name;
      const updatedRecords = Array.isArray(workflowResult.records) ? (workflowResult.records as RecordData[]) : [];
      setData((previous) =>
        decorateScopedData({
          ...previous,
          [key]: (previous[key] as RecordData[]).map((record) => {
            const updatedRecord = updatedRecords.find((item) => item.id === record.id);
            if (updatedRecord) return { ...record, ...updatedRecord };
            if (!targetIds.includes(requiredId(record))) return record;
            return {
              ...record,
              ownerId,
              updatedById: data.user.id,
              updatedAt: new Date().toISOString()
            };
          })
        } as ScopedCrmData)
      );
      void createAppNotification({
        title: "Owner changed",
        body: `${targetIds.length} ${OBJECT_DEFINITIONS[object].plural.toLowerCase()} reassigned to ${ownerName}.`,
        href: defaultRouteForObject(object),
        category: "Workflow"
      });
      showToast({
        tone: "success",
        message: `Owner changed for ${targetIds.length} record${targetIds.length === 1 ? "" : "s"}.`
      });
      closeModal();
      return;
    }

    if (action === "Add to Category" && object === "Product2") {
      const category = String(payload.category ?? "Products").trim() || "Products";
      const updatedRecords = Array.isArray(workflowResult.records) ? (workflowResult.records as RecordData[]) : [];
      setData((previous) =>
        decorateScopedData({
          ...previous,
          products: previous.products.map((record) => {
            const updatedRecord = updatedRecords.find((item) => item.id === record.id);
            if (updatedRecord) return { ...record, ...updatedRecord };
            if (!targetIds.includes(requiredId(record))) return record;
            return { ...record, category, updatedAt: new Date().toISOString() };
          })
        })
      );
      void createAppNotification({
        title: "Products categorized",
        body: `${targetIds.length} product${targetIds.length === 1 ? "" : "s"} assigned to ${category}.`,
        href: defaultRouteForObject("Product2"),
        category: "Workflow"
      });
      showToast({
        tone: "success",
        message: `${targetIds.length} product${targetIds.length === 1 ? "" : "s"} assigned to ${category}.`
      });
      closeModal();
      return;
    }

    if (action === "New Folder") {
      const folder = isRecordData(workflowResult.folder)
        ? workflowResult.folder
        : {
            id: `folder-${Date.now()}`,
            name: payload.name ?? "New Folder",
            ownerId: data.user.id,
            sharing: payload.sharing ?? "Private"
          };
      const folderName = String(folder.name);
      setData((previous) => ({
        ...previous,
        quickTextFolders: [folder, ...previous.quickTextFolders]
      }));
      void createAppNotification({
        title: "Quick Text folder created",
        body: `Folder "${folderName}" is available for quick text content.`,
        href: "/lightning/o/QuickText/home",
        category: "Records"
      });
      showToast({ tone: "success", message: `Quick Text folder "${folderName}" created.` });
      closeModal();
      return;
    }

    if (action === "Create Store") {
      const store = isRecordData(workflowResult.store)
        ? workflowResult.store
        : {
            id: `store-${Date.now()}`,
            name: payload.name ?? "Starter Store",
            status: "Draft",
            createdAt: new Date().toISOString()
          };
      const storeName = String(store.name);
      setData((previous) => ({ ...previous, stores: [store, ...previous.stores] }));
      void createAppNotification({
        title: "Store draft created",
        body: `Store "${storeName}" is ready for commerce setup.`,
        href: "/lightning/app/commerce",
        category: "Marketing"
      });
      showToast({ tone: "success", message: `Store "${storeName}" created as a draft.` });
      closeModal();
      return;
    }

    if (action === "Activate Marketing") {
      const activation = isRecordData(workflowResult.activation) ? workflowResult.activation : null;
      setData((previous) => ({
        ...previous,
        marketingActivations: activation
          ? [activation, ...previous.marketingActivations.filter((item) => item.id !== activation.id)]
          : previous.marketingActivations
      }));
      void createAppNotification({
        title: "Marketing activated",
        body: "Marketing tools are active for this workspace.",
        href: "/lightning/app/marketing",
        category: "Marketing"
      });
      showToast({ tone: "success", message: "Marketing tools activated for this workspace." });
      closeModal();
      return;
    }

    if (["Publish", "Assign", "Archive", "Delete Article", "Delete Draft", "Restore"].includes(action)) {
      setData((previous) => {
        if (action === "Delete Article" || action === "Delete Draft") {
          return {
            ...previous,
            knowledgeArticles: previous.knowledgeArticles.filter((article) => {
              if (!targetIds.includes(requiredId(article))) return true;
              if (action === "Delete Draft") {
                return String(article.publicationStatus ?? "Draft") !== "Draft";
              }
              return false;
            })
          };
        }
        return {
          ...previous,
          knowledgeArticles: previous.knowledgeArticles.map((article) => {
            if (!targetIds.includes(requiredId(article))) return article;
            if (action === "Publish") {
              return {
                ...article,
                publicationStatus: "Published",
                validationStatus: "Validated",
                publishedAt: new Date().toISOString()
              };
            }
            if (action === "Archive") {
              return {
                ...article,
                publicationStatus: "Archived",
                archivedAt: new Date().toISOString(),
                archivedById: data.user.id
              };
            }
            if (action === "Assign") return { ...article, updatedById: payload.assignee ?? data.user.id };
            if (action === "Restore") {
              return {
                ...article,
                publicationStatus: "Draft",
                validationStatus: "Not Validated",
                archivedAt: null,
                archivedById: null
              };
            }
            return article;
          })
        };
      });
      const articleCount = targetIds.length || data.knowledgeArticles.length;
      void createAppNotification({
        title: `Knowledge ${action.toLowerCase()}`,
        body: `${action} completed for ${articleCount} knowledge article${articleCount === 1 ? "" : "s"}.`,
        href: "/lightning/o/Knowledge__kav/list",
        category: "Workflow"
      });
      showToast({
        tone: "success",
        message: `${action} completed for ${articleCount} article${articleCount === 1 ? "" : "s"}.`
      });
      closeModal();
      return;
    }

    if (action === "Merge Cases") {
      const primaryCase = String(payload.primaryCase ?? "");
      setData((previous) => ({
        ...previous,
        cases: previous.cases.map((caseRecord) => {
          const isSelected = targetIds.includes(requiredId(caseRecord));
          if (!isSelected) return caseRecord;
          if (caseRecord.caseNumber === primaryCase || requiredId(caseRecord) === primaryCase) {
            return { ...caseRecord, subject: `${caseRecord.subject ?? "Merged Case"} (merged)` };
          }
          return {
            ...caseRecord,
            status: "Closed",
            closedAt: new Date().toISOString(),
            subject: `Merged into ${primaryCase || "primary case"}`
          };
        })
      }));
      void createAppNotification({
        title: "Cases merged",
        body: `${targetIds.length} cases were merged into ${primaryCase || "the selected primary case"}.`,
        href: "/lightning/o/Case/list?filterName=AllOpenCases",
        category: "Workflow"
      });
      showToast({ tone: "success", message: "Cases merged." });
      closeModal();
      return;
    }

    showToast({ tone: "success", message: `${action} completed.` });
    closeModal();
  }

  async function saveAppNavPreference(app: AppKey, items: AppNavItem[]) {
    const response = await resourceApi.updateNavigationPreference({
      app,
      items: items.map(cleanNavItem)
    });
    const preference = response?.appNavPreference as RecordData | undefined;
    if (!preference?.id) {
      showToast({ tone: "error", message: "Navigation items couldn't be saved." });
      return false;
    }
    setData((previous) => ({
      ...previous,
      appNavPreferences: [
        preference,
        ...previous.appNavPreferences.filter((item) => item.id !== preference.id && item.app !== app)
      ]
    }));
    showToast({ tone: "success", message: "Navigation items saved." });
    closeModal();
    return true;
  }

  async function resetAppNavPreference(app: AppKey) {
    const response = await resourceApi.resetNavigationPreference({ app });
    if (!response?.ok) {
      showToast({ tone: "error", message: "Navigation items couldn't be reset." });
      return false;
    }
    setData((previous) => ({
      ...previous,
      appNavPreferences: previous.appNavPreferences.filter((item) => item.app !== app)
    }));
    showToast({ tone: "success", message: "Navigation items reset." });
    closeModal();
    return true;
  }

  return { applyListAction, saveAppNavPreference, resetAppNavPreference };
}
