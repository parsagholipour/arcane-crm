"use client";

import { useEffect, useRef, useState, type ElementType } from "react";
import { type AiEmailDraft } from "@/lib/ai-types";
import { BRAND } from "@/lib/brand";
import { type ScopedCrmData, type RecordData } from "@/lib/crm-types";
import { type ToastState } from "@/components/ui/crm-primitives";
import { resourceApi } from "@/lib/api/resources";
import { apiRequest, jsonBody } from "@/lib/api/client";
import {
  type AgentforceMessageMetadata,
  type ScopedCrmDataUpdater,
  type HelpArticle,
  type SetupShortcut,
  type UtilityKind
} from "@/features/crm/shared-types";
import { buildGuidanceItems, buildNotificationPreferences } from "@/features/crm/shell-model";
import {
  buildHelpArticleStateMap,
  buildSetupShortcutStateMap,
  helpArticleCatalog,
  helpArticleMatchesQuery,
  notificationCategories,
  setupShortcutCatalog,
  setupShortcutMatchesQuery
} from "@/features/crm/utilities-model";

export type HeaderUtilityProps = {
  icon: ElementType;
  label: string;
  kind: UtilityKind;
  data: ScopedCrmData;
  pathname: string;
  onNavigate: (href: string) => void;
  onOpenDraft: (draft: AiEmailDraft) => void;
  onDataChange: ScopedCrmDataUpdater;
  onToast: (toast: ToastState) => void;
};

export function useHeaderUtility({ kind, data, pathname, onNavigate, onDataChange, onToast }: HeaderUtilityProps) {
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantError, setAssistantError] = useState("");
  const assistantScrollRef = useRef<HTMLDivElement | null>(null);
  const [assistantMessages, setAssistantMessages] = useState<Array<RecordData>>(() =>
    data.agentforceMessages.length > 0
      ? data.agentforceMessages
      : [
          {
            id: "local-agent-welcome",
            role: "assistant",
            text: "I can analyze CRM records, draft follow-up email copy, suggest next actions, and navigate the workspace. I will never change data without you."
          }
        ]
  );
  const [helpQuery, setHelpQuery] = useState("");
  const [helpView, setHelpView] = useState<"All" | "Saved" | "Recent">("All");
  const [helpArticleStates, setHelpArticleStates] = useState<Array<RecordData>>(() => data.helpArticleStates);
  const [settingsQuery, setSettingsQuery] = useState("");
  const [settingsView, setSettingsView] = useState<"All" | "Pinned" | "Recent">("All");
  const [setupShortcutStates, setSetupShortcutStates] = useState<Array<RecordData>>(() => data.setupShortcutStates);
  const initialPreferences = data.userPreferences[0] ?? {
    displayDensity: "Comfy",
    guidanceEnabled: true,
    consoleTabsEnabled: true,
    timezone: "Asia/Dubai",
    locale: "en-US"
  };
  const [density, setDensity] = useState(String(initialPreferences.displayDensity ?? "Comfy"));
  const [guidanceEnabled, setGuidanceEnabled] = useState(Boolean(initialPreferences.guidanceEnabled ?? true));
  const [consoleTabsEnabled, setConsoleTabsEnabled] = useState(Boolean(initialPreferences.consoleTabsEnabled ?? true));
  const [timezone, setTimezone] = useState(String(initialPreferences.timezone ?? "Asia/Dubai"));
  const [locale, setLocale] = useState(String(initialPreferences.locale ?? "en-US"));
  const [profileName, setProfileName] = useState(data.user.name);
  const [profileAlias, setProfileAlias] = useState(data.user.alias);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState(String(data.user.avatarUrl ?? ""));
  const [profileEditing, setProfileEditing] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState<"all" | "unread">("all");
  const [notificationCategory, setNotificationCategory] = useState("All Categories");
  const [notifications, setNotifications] = useState<Array<RecordData>>(() => data.notifications);
  const [notificationPreferences, setNotificationPreferences] = useState<Record<string, boolean>>(() =>
    buildNotificationPreferences(data.notificationPreferences)
  );
  const [guidanceItems, setGuidanceItems] = useState<Array<RecordData>>(() => buildGuidanceItems(data));

  useEffect(() => {
    setNotifications(data.notifications);
  }, [data.notifications]);

  useEffect(() => {
    if (data.agentforceMessages.length) setAssistantMessages(data.agentforceMessages);
  }, [data.agentforceMessages]);

  useEffect(() => {
    assistantScrollRef.current?.scrollTo({ top: assistantScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [assistantMessages, assistantLoading]);

  useEffect(() => {
    setNotificationPreferences(buildNotificationPreferences(data.notificationPreferences));
  }, [data.notificationPreferences]);

  useEffect(() => {
    setHelpArticleStates(data.helpArticleStates);
  }, [data.helpArticleStates]);

  useEffect(() => {
    setSetupShortcutStates(data.setupShortcutStates);
  }, [data.setupShortcutStates]);

  useEffect(() => {
    setGuidanceItems(buildGuidanceItems(data));
  }, [data]);

  useEffect(() => {
    setProfileName(data.user.name);
    setProfileAlias(data.user.alias);
    setProfileAvatarUrl(String(data.user.avatarUrl ?? ""));
  }, [data.user]);

  async function sendAssistantMessage() {
    if (!assistantInput.trim() || assistantLoading) return;
    const text = assistantInput.trim();
    setAssistantInput("");
    setAssistantError("");
    setAssistantLoading(true);
    const optimisticUser = { id: `pending-user-${Date.now()}`, role: "user", text };
    setAssistantMessages((messages) => [...messages, optimisticUser]);
    try {
      const payload = await apiRequest<RecordData>("/api/ai/chat", {
        method: "POST",
        body: jsonBody({ message: text, pathname })
      });
      if (!Array.isArray(payload.messages)) throw new Error(`${BRAND.assistant} couldn't answer that request.`);
      const nextMessages = payload.messages as RecordData[];
      setAssistantMessages((messages) => [
        ...messages.filter((message) => message.id !== optimisticUser.id),
        ...nextMessages
      ]);
      onDataChange((previous) => ({
        ...previous,
        agentforceMessages: [...previous.agentforceMessages, ...nextMessages]
      }));
    } catch (error) {
      setAssistantMessages((messages) => messages.filter((message) => message.id !== optimisticUser.id));
      setAssistantInput(text);
      setAssistantError(error instanceof Error ? error.message : `${BRAND.assistant} couldn't answer that request.`);
    } finally {
      setAssistantLoading(false);
    }
  }

  async function clearAssistantMessages() {
    if (assistantLoading) return;
    setAssistantError("");
    try {
      const payload = await apiRequest<RecordData>("/api/ai/chat", { method: "DELETE" });
      if (!Array.isArray(payload.messages)) throw new Error("The conversation couldn't be cleared.");
      const messages = payload.messages as RecordData[];
      setAssistantMessages(messages);
      onDataChange((previous) => ({ ...previous, agentforceMessages: messages }));
      onToast({ tone: "success", message: `${BRAND.assistant} conversation cleared.` });
    } catch (error) {
      setAssistantError(error instanceof Error ? error.message : "The conversation couldn't be cleared.");
    }
  }

  async function copyAssistantDraft(draft: NonNullable<AgentforceMessageMetadata["draft"]>) {
    try {
      await navigator.clipboard.writeText([draft.subject, "", draft.body].filter(Boolean).join("\n"));
      onToast({ tone: "success", message: "AI draft copied." });
    } catch {
      onToast({ tone: "error", message: "The AI draft couldn't be copied." });
    }
  }

  const unreadCount = notifications.filter((item) => !item.read).length;
  const availableNotificationCategories = Array.from(
    new Set([
      "All Categories",
      ...notificationCategories,
      ...notifications.map((item) => String(item.category ?? "General"))
    ])
  );
  const visibleNotifications = notifications.filter((item) => {
    if (notificationFilter === "unread" && item.read) return false;
    if (notificationCategory !== "All Categories" && String(item.category ?? "General") !== notificationCategory)
      return false;
    return true;
  });
  const effectiveBadge = kind === "notifications" && unreadCount > 0 ? String(unreadCount) : undefined;
  const helpStateByArticleId = buildHelpArticleStateMap(helpArticleStates);
  const visibleHelpArticles = helpArticleCatalog.filter((article) => {
    const state = helpStateByArticleId[article.id];
    if (helpView === "Saved" && state?.saved !== true) return false;
    if (helpView === "Recent" && !state?.viewedAt) return false;
    return helpArticleMatchesQuery(article, helpQuery);
  });
  const setupStateByShortcutId = buildSetupShortcutStateMap(setupShortcutStates);
  const visibleSetupShortcuts = setupShortcutCatalog.filter((shortcut) => {
    if (shortcut.id === "setup-organization-users" && data.organizationRole !== "ADMIN") return false;
    const state = setupStateByShortcutId[shortcut.id];
    if (settingsView === "Pinned" && state?.pinned !== true) return false;
    if (settingsView === "Recent" && !state?.lastOpenedAt) return false;
    return setupShortcutMatchesQuery(shortcut, settingsQuery);
  });

  async function markNotificationRead(id: string) {
    setNotifications((items) => items.map((item) => (item.id === id ? { ...item, read: true } : item)));
    const response = await resourceApi.markNotificationRead(id);
    const notification = response?.notification as RecordData | undefined;
    if (notification?.id) {
      onDataChange((previous) => ({
        ...previous,
        notifications: previous.notifications.map((item) => (item.id === notification.id ? notification : item))
      }));
    }
  }

  async function markAllNotificationsRead() {
    setNotifications((items) => items.map((item) => ({ ...item, read: true })));
    const response = await resourceApi.markAllNotificationsRead();
    if (Array.isArray(response?.notifications)) {
      const nextNotifications = response.notifications as RecordData[];
      setNotifications(nextNotifications);
      onDataChange((previous) => ({ ...previous, notifications: nextNotifications }));
    }
    onToast({ tone: "success", message: "All notifications marked as read." });
  }

  async function openNotification(item: RecordData) {
    await markNotificationRead(String(item.id));
    if (item.href) onNavigate(String(item.href));
  }

  async function deleteNotification(id: string) {
    const previousNotifications = notifications;
    const nextNotifications = notifications.filter((item) => item.id !== id);
    setNotifications(nextNotifications);
    onDataChange((previous) => ({
      ...previous,
      notifications: previous.notifications.filter((item) => item.id !== id)
    }));
    const response = await resourceApi.deleteNotification(id);
    if (!response?.ok) setNotifications(previousNotifications);
    else onToast({ tone: "success", message: "Notification deleted." });
  }

  async function clearReadNotifications() {
    const response = await resourceApi.clearReadNotifications();
    if (Array.isArray(response?.notifications)) {
      const nextNotifications = response.notifications as RecordData[];
      setNotifications(nextNotifications);
      onDataChange((previous) => ({ ...previous, notifications: nextNotifications }));
      onToast({ tone: "success", message: "Read notifications cleared." });
    }
  }

  async function clearAllNotifications() {
    const response = await resourceApi.clearAllNotifications();
    if (Array.isArray(response?.notifications)) {
      setNotifications([]);
      onDataChange((previous) => ({ ...previous, notifications: [] }));
      onToast({ tone: "success", message: "Notifications cleared." });
    }
  }

  async function updateNotificationPreference(category: string, enabled: boolean) {
    setNotificationPreferences((current) => ({ ...current, [category]: enabled }));
    const response = await resourceApi.updateNotificationPreference(category, enabled);
    if (Array.isArray(response?.notificationPreferences)) {
      const nextPreferences = response.notificationPreferences as RecordData[];
      setNotificationPreferences(buildNotificationPreferences(nextPreferences));
      onDataChange((previous) => ({ ...previous, notificationPreferences: nextPreferences }));
    }
  }

  async function updateGuidanceItem(id: string, status: string, snoozedUntil?: string | null) {
    setGuidanceItems((items) =>
      items.map((item) => (item.id === id ? { ...item, state: status, snoozedUntil } : item))
    );
    const response = await resourceApi.updateGuidance(id, { status, snoozedUntil });
    const state = response?.state as RecordData | undefined;
    if (state?.id) {
      onDataChange((previous) => ({
        ...previous,
        guidanceStates: previous.guidanceStates.some((item) => item.id === state.id)
          ? previous.guidanceStates.map((item) => (item.id === state.id ? state : item))
          : [state, ...previous.guidanceStates]
      }));
    }
  }

  async function updateHelpArticleState(article: HelpArticle, values: RecordData) {
    const optimisticState = {
      ...(helpStateByArticleId[article.id] ?? {}),
      articleId: article.id,
      ...values
    };
    setHelpArticleStates((states) => [
      optimisticState,
      ...states.filter((state) => String(state.articleId) !== article.id)
    ]);
    const response = await resourceApi.updateHelpArticleState(article.id, {
      articleId: article.id,
      ...values
    });
    if (Array.isArray(response?.helpArticleStates)) {
      const nextStates = response.helpArticleStates as RecordData[];
      setHelpArticleStates(nextStates);
      onDataChange((previous) => ({ ...previous, helpArticleStates: nextStates }));
    }
  }

  async function openHelpArticle(article: HelpArticle) {
    await updateHelpArticleState(article, { viewedAt: new Date().toISOString() });
    onNavigate(article.href);
  }

  async function clearHelpHistory() {
    const response = await resourceApi.clearHelpArticleHistory();
    if (Array.isArray(response?.helpArticleStates)) {
      const nextStates = response.helpArticleStates as RecordData[];
      setHelpArticleStates(nextStates);
      onDataChange((previous) => ({ ...previous, helpArticleStates: nextStates }));
      onToast({ tone: "success", message: "Help history cleared." });
    }
  }

  async function updateSetupShortcutState(shortcut: SetupShortcut, values: RecordData) {
    const optimisticState = {
      ...(setupStateByShortcutId[shortcut.id] ?? {}),
      shortcutId: shortcut.id,
      ...values
    };
    setSetupShortcutStates((states) => [
      optimisticState,
      ...states.filter((state) => String(state.shortcutId) !== shortcut.id)
    ]);
    const response = await resourceApi.updateSetupShortcutState(shortcut.id, {
      shortcutId: shortcut.id,
      ...values
    });
    if (Array.isArray(response?.setupShortcutStates)) {
      const nextStates = response.setupShortcutStates as RecordData[];
      setSetupShortcutStates(nextStates);
      onDataChange((previous) => ({ ...previous, setupShortcutStates: nextStates }));
    }
  }

  async function openSetupShortcut(shortcut: SetupShortcut) {
    await updateSetupShortcutState(shortcut, { lastOpenedAt: new Date().toISOString() });
    onNavigate(shortcut.href);
  }

  async function clearSetupShortcutHistory() {
    const response = await resourceApi.clearSetupShortcutHistory();
    if (Array.isArray(response?.setupShortcutStates)) {
      const nextStates = response.setupShortcutStates as RecordData[];
      setSetupShortcutStates(nextStates);
      onDataChange((previous) => ({ ...previous, setupShortcutStates: nextStates }));
      onToast({ tone: "success", message: "Setup history cleared." });
    }
  }

  async function savePreferences(next: RecordData) {
    const values = {
      displayDensity: next.displayDensity ?? density,
      guidanceEnabled: next.guidanceEnabled ?? guidanceEnabled,
      consoleTabsEnabled: next.consoleTabsEnabled ?? consoleTabsEnabled,
      timezone: next.timezone ?? timezone,
      locale: next.locale ?? locale
    };
    const response = await resourceApi.updatePreferences(values);
    const preferences = response?.preferences as RecordData | undefined;
    if (preferences?.id) {
      onDataChange((previous) => ({
        ...previous,
        userPreferences: [
          preferences,
          ...previous.userPreferences.filter((item) => item.id !== preferences.id && item.userId !== preferences.userId)
        ]
      }));
    }
  }

  async function saveProfile() {
    if (!profileAlias.trim()) {
      onToast({ tone: "error", message: "Alias is required." });
      return;
    }
    const response = await resourceApi.updateProfile({
      name: profileName.trim(),
      alias: profileAlias.trim(),
      avatarUrl: profileAvatarUrl.trim() || null
    });
    const user = response?.user as RecordData | undefined;
    if (user?.id) {
      onDataChange((previous) => ({
        ...previous,
        user: user as ScopedCrmData["user"],
        users: previous.users.map((item) => (item.id === user.id ? (user as ScopedCrmData["user"]) : item))
      }));
      setProfileEditing(false);
      onToast({ tone: "success", message: "Profile updated." });
    }
  }

  async function switchOrganization(organizationId: string) {
    try {
      await apiRequest<RecordData>("/api/organizations/active", {
        method: "POST",
        body: jsonBody({ organizationId })
      });
    } catch (error) {
      onToast({
        tone: "error",
        message: error instanceof Error ? error.message : "Unable to switch organization."
      });
      return;
    }
    window.location.assign("/lightning/page/home");
  }

  return {
    assistantInput,
    setAssistantInput,
    assistantLoading,
    assistantError,
    assistantScrollRef,
    assistantMessages,
    helpQuery,
    setHelpQuery,
    helpView,
    setHelpView,
    settingsQuery,
    setSettingsQuery,
    settingsView,
    setSettingsView,
    density,
    setDensity,
    guidanceEnabled,
    setGuidanceEnabled,
    consoleTabsEnabled,
    setConsoleTabsEnabled,
    timezone,
    setTimezone,
    locale,
    setLocale,
    profileName,
    setProfileName,
    profileAlias,
    setProfileAlias,
    profileAvatarUrl,
    setProfileAvatarUrl,
    profileEditing,
    setProfileEditing,
    notificationFilter,
    setNotificationFilter,
    notificationCategory,
    setNotificationCategory,
    notificationPreferences,
    guidanceItems,
    unreadCount,
    availableNotificationCategories,
    visibleNotifications,
    effectiveBadge,
    helpStateByArticleId,
    visibleHelpArticles,
    setupStateByShortcutId,
    visibleSetupShortcuts,
    sendAssistantMessage,
    clearAssistantMessages,
    copyAssistantDraft,
    markNotificationRead,
    markAllNotificationsRead,
    openNotification,
    deleteNotification,
    clearReadNotifications,
    clearAllNotifications,
    updateNotificationPreference,
    updateGuidanceItem,
    updateHelpArticleState,
    openHelpArticle,
    clearHelpHistory,
    updateSetupShortcutState,
    openSetupShortcut,
    clearSetupShortcutHistory,
    savePreferences,
    saveProfile,
    switchOrganization
  };
}

export type HeaderUtilityState = ReturnType<typeof useHeaderUtility>;
