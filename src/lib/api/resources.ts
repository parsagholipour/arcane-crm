import { apiRequest, jsonBody } from "@/lib/api/client";
import type { RecordData } from "@/lib/crm-types";

function mutate(path: string, method: "POST" | "PUT" | "PATCH" | "DELETE", values?: RecordData) {
  return apiRequest<RecordData>(path, {
    method,
    ...(values ? { body: jsonBody(values) } : {})
  });
}

export const resourceApi = {
  createPartner: (values: RecordData) => mutate("/api/partners", "POST", values),
  createCalendarSource: (values: RecordData) => mutate("/api/calendar/sources", "POST", values),
  updateCalendarSource: (id: string, values: RecordData) =>
    mutate(`/api/calendar/sources/${encodeURIComponent(id)}`, "PATCH", values),
  deleteCalendarSource: (id: string) => mutate(`/api/calendar/sources/${encodeURIComponent(id)}`, "DELETE"),
  toggleQuickTextFavorite: (id: string) => mutate(`/api/quick-text/favorites/${encodeURIComponent(id)}`, "PUT"),
  createReport: (values: RecordData) => mutate("/api/reports", "POST", values),
  updateReport: (id: string, values: RecordData) => mutate(`/api/reports/${encodeURIComponent(id)}`, "PATCH", values),
  deleteReport: (id: string) => mutate(`/api/reports/${encodeURIComponent(id)}`, "DELETE"),
  createDashboard: (values: RecordData) => mutate("/api/dashboards", "POST", values),
  updateDashboard: (id: string, values: RecordData) =>
    mutate(`/api/dashboards/${encodeURIComponent(id)}`, "PATCH", values),
  deleteDashboard: (id: string) => mutate(`/api/dashboards/${encodeURIComponent(id)}`, "DELETE"),
  createNotification: (values: RecordData) => mutate("/api/notifications", "POST", values),
  markNotificationRead: (id: string) => mutate(`/api/notifications/${encodeURIComponent(id)}`, "PATCH"),
  markAllNotificationsRead: () => mutate("/api/notifications", "PATCH"),
  deleteNotification: (id: string) => mutate(`/api/notifications/${encodeURIComponent(id)}`, "DELETE"),
  clearReadNotifications: () => mutate("/api/notifications?scope=read", "DELETE"),
  clearAllNotifications: () => mutate("/api/notifications", "DELETE"),
  updateNotificationPreference: (category: string, enabled: boolean) =>
    mutate(`/api/notification-preferences/${encodeURIComponent(category)}`, "PUT", { enabled }),
  updateGuidance: (id: string, values: RecordData) => mutate(`/api/guidance/${encodeURIComponent(id)}`, "PUT", values),
  updatePreferences: (values: RecordData) => mutate("/api/preferences", "PATCH", values),
  updateProfile: (values: RecordData) => mutate("/api/profile", "PATCH", values),
  updateHelpArticleState: (id: string, values: RecordData) =>
    mutate(`/api/help/state/${encodeURIComponent(id)}`, "PUT", values),
  clearHelpArticleHistory: () => mutate("/api/help/history", "DELETE"),
  updateSetupShortcutState: (id: string, values: RecordData) =>
    mutate(`/api/setup/state/${encodeURIComponent(id)}`, "PUT", values),
  clearSetupShortcutHistory: () => mutate("/api/setup/history", "DELETE"),
  updateNavigationPreference: (values: RecordData) => mutate("/api/navigation/preferences", "PUT", values),
  resetNavigationPreference: (values: RecordData) => mutate("/api/navigation/preferences", "DELETE", values),
  saveListView: (values: RecordData, pin?: boolean) =>
    mutate("/api/list-views", "PUT", { ...values, ...(typeof pin === "boolean" ? { pin } : {}) }),
  deleteListView: (values: RecordData) => mutate("/api/list-views", "DELETE", values),
  saveSearchRecent: (values: RecordData) => mutate("/api/search/recents", "POST", values),
  clearSearchRecents: () => mutate("/api/search/recents", "DELETE"),
  savePoAppIntegration: (values: RecordData) => mutate("/api/integrations/po-app", "PUT", values),
  testPoAppIntegration: () => mutate("/api/integrations/po-app/test", "POST"),
  syncPoAppCatalogue: (values: RecordData) => mutate("/api/integrations/po-app/sync", "POST", values),
  createOrganizationApiToken: () => mutate("/api/organization/api-access/token", "POST"),
  revokeOrganizationApiToken: () => mutate("/api/organization/api-access/token", "DELETE"),
  saveOrganizationApiAccess: (values: RecordData) => mutate("/api/organization/api-access", "PUT", values),
  rotateOrganizationWebhookSecret: () => mutate("/api/organization/api-access/webhook", "PUT", { rotateSecret: true }),
  testOrganizationWebhook: () => mutate("/api/organization/api-access/webhook/test", "POST")
};
