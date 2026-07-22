import { Prisma } from "@prisma/client";
import { authorizationErrorResponse, requireOrganizationContext } from "@/lib/organization-context";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type UtilityPayload = {
  action: string;
  id?: string;
  values?: Record<string, unknown>;
};

export async function POST(request: NextRequest) {
  try {
    const authContext = await requireOrganizationContext();
    const organizationId = authContext.organizationId;
    const userId = authContext.userId;
    const payload = (await request.json()) as UtilityPayload;
    const values = payload.values ?? {};
    const personalWhere = { organizationId, userId };
    if (payload.action === "createPartner") {
      const accountId = String(values.accountId ?? "");
      const name = String(values.name ?? "").trim();
      const role = values.role ? String(values.role) : null;
      if (!accountId || !name) return NextResponse.json({ error: "Account and partner name are required." }, { status: 400 });
      if (!(await prisma.account.findFirst({ where: { id: accountId, organizationId }, select: { id: true } }))) {
        return NextResponse.json({ error: "Account not found." }, { status: 404 });
      }
      const partner = await prisma.partner.create({
        data: {
          organizationId,
          accountId,
          name,
          role
        }
      });
      return NextResponse.json({ ok: true, partner: JSON.parse(JSON.stringify(partner)) }, { status: 201 });
    }

    if (payload.action === "createCalendarSource") {
      const name = String(values.name ?? "").trim();
      if (!name) return NextResponse.json({ error: "Calendar name is required." }, { status: 400 });
      const source = await prisma.calendarSource.create({
        data: {
          organizationId,
          userId,
          name,
          type: String(values.type ?? "My") === "Other" ? "Other" : "My",
          color: String(values.color ?? "#0176d3"),
          visible: values.visible !== false
        }
      });
      const calendarSources = await prisma.calendarSource.findMany({ where: personalWhere, orderBy: { updatedAt: "desc" } });
      return NextResponse.json({ ok: true, source: JSON.parse(JSON.stringify(source)), calendarSources: JSON.parse(JSON.stringify(calendarSources)) }, { status: 201 });
    }

    if (payload.action === "updateCalendarSource") {
      const id = String(payload.id ?? values.id ?? "").trim();
      const name = String(values.name ?? "").trim();
      if (!id || !name) return NextResponse.json({ error: "Calendar and name are required." }, { status: 400 });
      await prisma.calendarSource.updateMany({
        where: { id, ...personalWhere },
        data: {
          name,
          type: String(values.type ?? "My") === "Other" ? "Other" : "My",
          color: String(values.color ?? "#0176d3"),
          visible: values.visible !== false
        }
      });
      const source = await prisma.calendarSource.findFirst({ where: { id, ...personalWhere } });
      if (!source) return NextResponse.json({ error: "Calendar not found." }, { status: 404 });
      const calendarSources = await prisma.calendarSource.findMany({ where: personalWhere, orderBy: { updatedAt: "desc" } });
      return NextResponse.json({ ok: true, source: JSON.parse(JSON.stringify(source)), calendarSources: JSON.parse(JSON.stringify(calendarSources)) });
    }

    if (payload.action === "deleteCalendarSource") {
      const id = String(payload.id ?? values.id ?? "").trim();
      if (!id) return NextResponse.json({ error: "Calendar is required." }, { status: 400 });
      await prisma.calendarSource.deleteMany({ where: { id, ...personalWhere } });
      const calendarSources = await prisma.calendarSource.findMany({ where: personalWhere, orderBy: { updatedAt: "desc" } });
      return NextResponse.json({ ok: true, calendarSources: JSON.parse(JSON.stringify(calendarSources)) });
    }

    if (payload.action === "saveCustomReport") {
      const name = String(values.name ?? "").trim();
      const object = String(values.object ?? "").trim();
      const groupField = String(values.groupField ?? "").trim();
      const columns = Array.isArray(values.columns) ? values.columns.map(String).filter(Boolean) : [];
      if (!name || !object || !groupField || columns.length === 0) return NextResponse.json({ error: "Report name, object, group field, and columns are required." }, { status: 400 });
      const report = await prisma.customReport.create({
        data: {
          organizationId,
          userId,
          name,
          object,
          groupField,
          columns
        }
      });
      const reports = await prisma.customReport.findMany({ where: personalWhere, orderBy: { updatedAt: "desc" } });
      return NextResponse.json({ ok: true, report: JSON.parse(JSON.stringify(report)), customReports: JSON.parse(JSON.stringify(reports)) }, { status: 201 });
    }

    if (payload.action === "saveCustomDashboard") {
      const name = String(values.name ?? "").trim();
      const reportIds = Array.isArray(values.reportIds) ? values.reportIds.map(String).filter(Boolean) : [];
      if (!name || reportIds.length === 0) return NextResponse.json({ error: "Dashboard name and at least one component are required." }, { status: 400 });
      const dashboard = await prisma.customDashboard.create({
        data: {
          organizationId,
          userId,
          name,
          reportIds
        }
      });
      const dashboards = await prisma.customDashboard.findMany({ where: personalWhere, orderBy: { updatedAt: "desc" } });
      return NextResponse.json({ ok: true, dashboard: JSON.parse(JSON.stringify(dashboard)), customDashboards: JSON.parse(JSON.stringify(dashboards)) }, { status: 201 });
    }

    if (payload.action === "markNotificationRead" && payload.id) {
      const notification = await prisma.notification.updateManyAndReturn({
        where: { id: payload.id, ...personalWhere },
        data: { read: true }
      });
      if (!notification[0]) return NextResponse.json({ error: "Notification not found." }, { status: 404 });
      return NextResponse.json({ ok: true, notification: JSON.parse(JSON.stringify(notification[0])) });
    }

    if (payload.action === "markAllNotificationsRead") {
      await prisma.notification.updateMany({
        where: { ...personalWhere, read: false },
        data: { read: true }
      });
      const notifications = await prisma.notification.findMany({ where: personalWhere, orderBy: { createdAt: "desc" } });
      return NextResponse.json({ ok: true, notifications: JSON.parse(JSON.stringify(notifications)) });
    }

    if (payload.action === "deleteNotification" && payload.id) {
      await prisma.notification.deleteMany({ where: { id: payload.id, ...personalWhere } });
      return NextResponse.json({ ok: true });
    }

    if (payload.action === "clearReadNotifications") {
      await prisma.notification.deleteMany({ where: { ...personalWhere, read: true } });
      const notifications = await prisma.notification.findMany({ where: personalWhere, orderBy: { createdAt: "desc" } });
      return NextResponse.json({ ok: true, notifications: JSON.parse(JSON.stringify(notifications)) });
    }

    if (payload.action === "clearAllNotifications") {
      await prisma.notification.deleteMany({ where: personalWhere });
      return NextResponse.json({ ok: true, notifications: [] });
    }

    if (payload.action === "createNotification") {
      const category = values.category ? String(values.category) : "General";
      const preference = await prisma.notificationPreference.findUnique({
        where: { organizationId_userId_category: { organizationId, userId, category } }
      });
      if (preference?.enabled === false) {
        const notifications = await prisma.notification.findMany({ where: personalWhere, orderBy: { createdAt: "desc" } });
        return NextResponse.json({ ok: true, skipped: true, notifications: JSON.parse(JSON.stringify(notifications)) });
      }
      const notification = await prisma.notification.create({
        data: {
          organizationId,
          userId,
          title: String(values.title ?? "Notification"),
          body: String(values.body ?? ""),
          href: values.href ? String(values.href) : null,
          category,
          read: false
        }
      });
      return NextResponse.json({ ok: true, notification: JSON.parse(JSON.stringify(notification)) }, { status: 201 });
    }

    if (payload.action === "updateNotificationPreference") {
      const category = String(values.category ?? "").trim();
      if (!category) return NextResponse.json({ error: "Category is required." }, { status: 400 });
      const preference = await prisma.notificationPreference.upsert({
        where: { organizationId_userId_category: { organizationId, userId, category } },
        update: { enabled: values.enabled !== false },
        create: { organizationId, userId, category, enabled: values.enabled !== false }
      });
      const notificationPreferences = await prisma.notificationPreference.findMany({ where: personalWhere });
      return NextResponse.json({ ok: true, preference: JSON.parse(JSON.stringify(preference)), notificationPreferences: JSON.parse(JSON.stringify(notificationPreferences)) });
    }

    if (payload.action === "updateGuidance" && payload.id) {
      const state = await prisma.userGuidanceState.upsert({
        where: { organizationId_userId_itemId: { organizationId, userId, itemId: payload.id } },
        update: {
          status: String(values.status ?? "ACTIVE"),
          snoozedUntil: values.snoozedUntil ? new Date(String(values.snoozedUntil)) : null
        },
        create: {
          organizationId,
          userId,
          itemId: payload.id,
          status: String(values.status ?? "ACTIVE"),
          snoozedUntil: values.snoozedUntil ? new Date(String(values.snoozedUntil)) : null
        }
      });
      return NextResponse.json({ ok: true, state: JSON.parse(JSON.stringify(state)) });
    }

    if (payload.action === "updatePreferences") {
      const preferences = await prisma.userPreference.upsert({
        where: { organizationId_userId: { organizationId, userId } },
        update: {
          displayDensity: values.displayDensity ? String(values.displayDensity) : undefined,
          guidanceEnabled: typeof values.guidanceEnabled === "boolean" ? values.guidanceEnabled : undefined,
          consoleTabsEnabled: typeof values.consoleTabsEnabled === "boolean" ? values.consoleTabsEnabled : undefined,
          homeMode: values.homeMode ? String(values.homeMode) : undefined,
          quarterlyGoal: values.quarterlyGoal === null ? null : values.quarterlyGoal !== undefined ? Number(values.quarterlyGoal) : undefined,
          timezone: values.timezone ? String(values.timezone) : undefined,
          locale: values.locale ? String(values.locale) : undefined
        },
        create: {
          organizationId,
          userId,
          displayDensity: String(values.displayDensity ?? "Comfy"),
          guidanceEnabled: typeof values.guidanceEnabled === "boolean" ? values.guidanceEnabled : true,
          consoleTabsEnabled: typeof values.consoleTabsEnabled === "boolean" ? values.consoleTabsEnabled : true,
          homeMode: String(values.homeMode ?? "Onboarding"),
          quarterlyGoal: values.quarterlyGoal === null || values.quarterlyGoal === undefined ? null : Number(values.quarterlyGoal),
          timezone: values.timezone ? String(values.timezone) : "Asia/Dubai",
          locale: values.locale ? String(values.locale) : "en-US"
        }
      });
      return NextResponse.json({ ok: true, preferences: JSON.parse(JSON.stringify(preferences)) });
    }

    if (payload.action === "updateSetupShortcutState") {
      const shortcutId = String(values.shortcutId ?? payload.id ?? "").trim();
      if (!shortcutId) return NextResponse.json({ error: "Shortcut is required." }, { status: 400 });
      const state = await prisma.setupShortcutState.upsert({
        where: { organizationId_userId_shortcutId: { organizationId, userId, shortcutId } },
        update: {
          pinned: typeof values.pinned === "boolean" ? values.pinned : undefined,
          lastOpenedAt: values.lastOpenedAt ? new Date(String(values.lastOpenedAt)) : undefined
        },
        create: {
          organizationId,
          userId,
          shortcutId,
          pinned: typeof values.pinned === "boolean" ? values.pinned : false,
          lastOpenedAt: values.lastOpenedAt ? new Date(String(values.lastOpenedAt)) : null
        }
      });
      const setupShortcutStates = await prisma.setupShortcutState.findMany({ where: personalWhere, orderBy: { updatedAt: "desc" } });
      return NextResponse.json({ ok: true, state: JSON.parse(JSON.stringify(state)), setupShortcutStates: JSON.parse(JSON.stringify(setupShortcutStates)) });
    }

    if (payload.action === "clearSetupShortcutHistory") {
      await prisma.setupShortcutState.updateMany({
        where: { ...personalWhere, pinned: false },
        data: { lastOpenedAt: null }
      });
      await prisma.setupShortcutState.deleteMany({ where: { ...personalWhere, pinned: false, lastOpenedAt: null } });
      const setupShortcutStates = await prisma.setupShortcutState.findMany({ where: personalWhere, orderBy: { updatedAt: "desc" } });
      return NextResponse.json({ ok: true, setupShortcutStates: JSON.parse(JSON.stringify(setupShortcutStates)) });
    }

    if (payload.action === "updateHelpArticleState") {
      const articleId = String(values.articleId ?? payload.id ?? "").trim();
      if (!articleId) return NextResponse.json({ error: "Article is required." }, { status: 400 });
      const state = await prisma.helpArticleState.upsert({
        where: { organizationId_userId_articleId: { organizationId, userId, articleId } },
        update: {
          saved: typeof values.saved === "boolean" ? values.saved : undefined,
          helpful: typeof values.helpful === "boolean" ? values.helpful : undefined,
          viewedAt: values.viewedAt ? new Date(String(values.viewedAt)) : undefined
        },
        create: {
          organizationId,
          userId,
          articleId,
          saved: typeof values.saved === "boolean" ? values.saved : false,
          helpful: typeof values.helpful === "boolean" ? values.helpful : null,
          viewedAt: values.viewedAt ? new Date(String(values.viewedAt)) : null
        }
      });
      const helpArticleStates = await prisma.helpArticleState.findMany({ where: personalWhere, orderBy: { updatedAt: "desc" } });
      return NextResponse.json({ ok: true, state: JSON.parse(JSON.stringify(state)), helpArticleStates: JSON.parse(JSON.stringify(helpArticleStates)) });
    }

    if (payload.action === "clearHelpArticleHistory") {
      await prisma.helpArticleState.updateMany({
        where: { ...personalWhere, saved: false },
        data: { viewedAt: null, helpful: null }
      });
      await prisma.helpArticleState.deleteMany({ where: { ...personalWhere, saved: false, viewedAt: null } });
      const helpArticleStates = await prisma.helpArticleState.findMany({ where: personalWhere, orderBy: { updatedAt: "desc" } });
      return NextResponse.json({ ok: true, helpArticleStates: JSON.parse(JSON.stringify(helpArticleStates)) });
    }

    if (payload.action === "updateAppNavPreference") {
      const app = String(values.app ?? "");
      const items = Array.isArray(values.items) ? values.items : [];
      if (!app || items.length === 0) return NextResponse.json({ error: "App and items are required." }, { status: 400 });

      const preference = await prisma.appNavPreference.upsert({
        where: { organizationId_userId_app: { organizationId, userId, app } },
        update: { items },
        create: {
          organizationId,
          userId,
          app,
          items
        }
      });
      return NextResponse.json({ ok: true, appNavPreference: JSON.parse(JSON.stringify(preference)) });
    }

    if (payload.action === "resetAppNavPreference") {
      const app = String(values.app ?? "");
      if (!app) return NextResponse.json({ error: "App is required." }, { status: 400 });
      await prisma.appNavPreference.deleteMany({ where: { ...personalWhere, app } });
      return NextResponse.json({ ok: true, app });
    }

    if (payload.action === "saveListViewPreference") {
      const object = String(values.object ?? "");
      const viewName = String(values.viewName ?? "").trim();
      const columns = Array.isArray(values.columns) ? values.columns.map(String) : [];
      const columnWidths = inputJsonObject(values.columnWidths);
      const filters = Array.isArray(values.filters) ? values.filters : [];
      const chartType = values.chartType ? String(values.chartType) : null;
      const chartField = values.chartField ? String(values.chartField) : null;
      const sharing = values.sharing ? String(values.sharing) : undefined;
      if (!object || !viewName || columns.length === 0) return NextResponse.json({ error: "Object, view name, and columns are required." }, { status: 400 });
      const previousViewName = values.previousViewName ? String(values.previousViewName) : "";
      if (previousViewName && previousViewName !== viewName) {
        await prisma.listViewPreference.deleteMany({ where: { ...personalWhere, object, viewName: previousViewName } });
      }

      const pinned = Boolean(values.pinned);
      if (pinned) {
        await prisma.listViewPreference.updateMany({
          where: { ...personalWhere, object },
          data: { pinned: false }
        });
      }

      const preference = await prisma.listViewPreference.upsert({
        where: { organizationId_userId_object_viewName: { organizationId, userId, object, viewName } },
        update: {
          columns,
          columnWidths,
          filters,
          chartType,
          chartField,
          sharing,
          pinned,
          isCustom: Boolean(values.isCustom)
        },
        create: {
          organizationId,
          userId,
          object,
          viewName,
          columns,
          columnWidths,
          filters,
          chartType,
          chartField,
          sharing,
          pinned,
          isCustom: Boolean(values.isCustom)
        }
      });
      const preferences = await prisma.listViewPreference.findMany({ where: { ...personalWhere, object }, orderBy: { updatedAt: "desc" } });
      return NextResponse.json({ ok: true, listViewPreference: JSON.parse(JSON.stringify(preference)), listViewPreferences: JSON.parse(JSON.stringify(preferences)) });
    }

    if (payload.action === "pinListViewPreference") {
      const object = String(values.object ?? "");
      const viewName = String(values.viewName ?? "");
      const columns = Array.isArray(values.columns) ? values.columns.map(String) : [];
      const columnWidths = inputJsonObject(values.columnWidths);
      const filters = Array.isArray(values.filters) ? values.filters : [];
      const chartType = values.chartType ? String(values.chartType) : null;
      const chartField = values.chartField ? String(values.chartField) : null;
      if (!object || !viewName || columns.length === 0) return NextResponse.json({ error: "Object, view name, and columns are required." }, { status: 400 });

      await prisma.listViewPreference.updateMany({
        where: { ...personalWhere, object },
        data: { pinned: false }
      });
      const preference = await prisma.listViewPreference.upsert({
        where: { organizationId_userId_object_viewName: { organizationId, userId, object, viewName } },
        update: { columns, columnWidths, filters, chartType, chartField, pinned: true },
        create: { organizationId, userId, object, viewName, columns, columnWidths, filters, chartType, chartField, pinned: true, isCustom: Boolean(values.isCustom) }
      });
      const preferences = await prisma.listViewPreference.findMany({ where: { ...personalWhere, object }, orderBy: { updatedAt: "desc" } });
      return NextResponse.json({ ok: true, listViewPreference: JSON.parse(JSON.stringify(preference)), listViewPreferences: JSON.parse(JSON.stringify(preferences)) });
    }

    if (payload.action === "deleteListViewPreference") {
      const object = String(values.object ?? "");
      const viewName = String(values.viewName ?? "");
      if (!object || !viewName) return NextResponse.json({ error: "Object and view name are required." }, { status: 400 });
      await prisma.listViewPreference.deleteMany({ where: { ...personalWhere, object, viewName } });
      const preferences = await prisma.listViewPreference.findMany({ where: { ...personalWhere, object }, orderBy: { updatedAt: "desc" } });
      return NextResponse.json({ ok: true, listViewPreferences: JSON.parse(JSON.stringify(preferences)) });
    }

    if (payload.action === "saveGlobalSearchRecent") {
      const href = String(values.href ?? "").trim();
      const label = String(values.label ?? "").trim();
      const context = String(values.context ?? "").trim();
      const category = String(values.category ?? "Record").trim();
      const query = values.query ? String(values.query).trim() : null;
      if (!href || !label || !context) return NextResponse.json({ error: "Search label, context, and destination are required." }, { status: 400 });

      const recent = await prisma.globalSearchRecent.upsert({
        where: { organizationId_userId_href: { organizationId, userId, href } },
        update: { query, label, context, category },
        create: { organizationId, userId, query, label, context, href, category }
      });
      const recents = await prisma.globalSearchRecent.findMany({ where: personalWhere, orderBy: { updatedAt: "desc" }, take: 8 });
      return NextResponse.json({ ok: true, recent: JSON.parse(JSON.stringify(recent)), globalSearchRecents: JSON.parse(JSON.stringify(recents)) });
    }

    if (payload.action === "clearGlobalSearchRecents") {
      await prisma.globalSearchRecent.deleteMany({ where: personalWhere });
      return NextResponse.json({ ok: true, globalSearchRecents: [] });
    }

    if (payload.action === "resetListViewPreferences") {
      const object = String(values.object ?? "");
      if (!object) return NextResponse.json({ error: "Object is required." }, { status: 400 });
      await prisma.listViewPreference.deleteMany({ where: { ...personalWhere, object } });
      return NextResponse.json({ ok: true, listViewPreferences: [] });
    }

    if (payload.action === "updateProfile") {
      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          alias: values.alias ? String(values.alias) : undefined,
          avatarUrl: values.avatarUrl === null ? null : values.avatarUrl ? String(values.avatarUrl) : undefined
        }
      });
      return NextResponse.json({ ok: true, user: JSON.parse(JSON.stringify(user)) });
    }

    return NextResponse.json({ error: "Unknown utility action." }, { status: 400 });
  } catch (error) {
    console.error(error);
    const response = authorizationErrorResponse(error);
    if (response) return response;
    return NextResponse.json({ error: "Unable to update utility state." }, { status: 500 });
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function inputJsonObject(value: unknown): Prisma.InputJsonObject {
  if (!isPlainObject(value)) return {};
  const entries = Object.entries(value).filter((entry): entry is [string, Prisma.InputJsonValue] => isJsonPrimitive(entry[1]));
  return Object.fromEntries(entries) as Prisma.InputJsonObject;
}

function isJsonPrimitive(value: unknown): value is string | number | boolean | null {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null;
}
