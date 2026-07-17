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

type AgentforceAction = {
  label: string;
  href: string;
};

type AgentforceFact = {
  label: string;
  value: string;
};

type AgentforceDraft = {
  subject: string;
  body: string;
  to?: string;
};

type AgentforceMetadata = {
  kind: "summary" | "pipeline" | "cases" | "leads" | "draft";
  actions: AgentforceAction[];
  facts: AgentforceFact[];
  draft?: AgentforceDraft;
};

type AgentforceWorkspace = Awaited<ReturnType<typeof loadAgentforceWorkspace>>;

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

    if (payload.action === "clearAgentforceMessages") {
      await prisma.agentforceMessage.deleteMany({ where: personalWhere });
      const welcome = await prisma.agentforceMessage.create({
        data: {
          organizationId,
          userId,
          role: "assistant",
          text: "I can summarize CRM records, draft follow-up email copy, suggest next actions, and take you to the right workspace.",
          metadata: {
            kind: "summary",
            facts: [],
            actions: [
              { label: "Open Home", href: "/lightning/page/home" },
              { label: "Open Analytics", href: "/lightning/page/analytics?report=Pipeline%20by%20Stage" }
            ]
          }
        }
      });
      return NextResponse.json({ ok: true, messages: JSON.parse(JSON.stringify([welcome])) });
    }

    if (payload.action === "sendAgentforceMessage") {
      const text = String(values.text ?? "").trim();
      if (!text) return NextResponse.json({ error: "Message is required." }, { status: 400 });
      const workspace = await loadAgentforceWorkspace(organizationId);
      const response = buildAgentforceResponse(text, workspace, authContext.user.name);

      const userMessage = await prisma.agentforceMessage.create({
        data: { organizationId, userId, role: "user", text }
      });
      const assistantMessage = await prisma.agentforceMessage.create({
        data: { organizationId, userId, role: "assistant", text: response.text, metadata: response.metadata }
      });
      return NextResponse.json({
        ok: true,
        messages: JSON.parse(JSON.stringify([userMessage, assistantMessage]))
      });
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

async function loadAgentforceWorkspace(organizationId: string) {
  const [accounts, contacts, leads, opportunities, cases, events, tasks] = await Promise.all([
    prisma.account.findMany({ where: { organizationId }, orderBy: { updatedAt: "desc" }, take: 20 }),
    prisma.contact.findMany({ where: { organizationId }, include: { account: true }, orderBy: { updatedAt: "desc" }, take: 20 }),
    prisma.lead.findMany({ where: { organizationId }, orderBy: { updatedAt: "desc" }, take: 30 }),
    prisma.opportunity.findMany({ where: { organizationId }, include: { account: true, contact: true }, orderBy: { updatedAt: "desc" }, take: 30 }),
    prisma.caseRecord.findMany({ where: { organizationId }, include: { account: true, contact: true }, orderBy: { updatedAt: "desc" }, take: 30 }),
    prisma.event.findMany({ where: { organizationId }, orderBy: { startAt: "asc" }, take: 20 }),
    prisma.task.findMany({ where: { organizationId }, orderBy: { updatedAt: "desc" }, take: 20 })
  ]);
  return { accounts, contacts, leads, opportunities, cases, events, tasks };
}

function buildAgentforceResponse(text: string, workspace: AgentforceWorkspace, userName: string): { text: string; metadata: AgentforceMetadata } {
  const normalized = text.toLowerCase();
  if (/\b(pipeline|opportunit|deal|forecast|stage)\b/.test(normalized)) return buildPipelineAgentforceResponse(workspace);
  if (/\b(case|support|ticket|priority|escalat)\b/.test(normalized)) return buildCaseAgentforceResponse(workspace);
  if (/\b(lead|prospect|qualif|source)\b/.test(normalized)) return buildLeadAgentforceResponse(workspace);
  if (/\b(email|follow.?up|draft|message|reply)\b/.test(normalized)) return buildFollowUpAgentforceResponse(text, workspace, userName);
  return buildWorkspaceAgentforceResponse(workspace);
}

function buildWorkspaceAgentforceResponse(workspace: AgentforceWorkspace): { text: string; metadata: AgentforceMetadata } {
  const openCases = workspace.cases.filter((record) => !isClosedCaseStatus(record.status));
  const openOpportunities = workspace.opportunities.filter((record) => !isClosedOpportunityStage(record.stage));
  const totalPipeline = sumAmounts(openOpportunities.map((record) => record.amount));
  const nextEvent = workspace.events.find((event) => new Date(event.startAt).getTime() >= Date.now());
  const text = [
    `Workspace snapshot: ${workspace.accounts.length} accounts, ${workspace.contacts.length} contacts, ${workspace.leads.length} leads, ${openOpportunities.length} open opportunities, and ${openCases.length} open cases.`,
    openOpportunities.length > 0 ? `Open pipeline totals ${formatUsd(totalPipeline)}.` : "No open pipeline is currently recorded.",
    nextEvent ? `Next calendar item is ${nextEvent.subject} on ${formatShortDate(nextEvent.startAt)}.` : "No upcoming calendar items are scheduled."
  ].join(" ");
  return {
    text,
    metadata: {
      kind: "summary",
      facts: [
        { label: "Accounts", value: String(workspace.accounts.length) },
        { label: "Contacts", value: String(workspace.contacts.length) },
        { label: "Open Pipeline", value: formatUsd(totalPipeline) },
        { label: "Open Cases", value: String(openCases.length) }
      ],
      actions: [
        { label: "Open Home", href: "/lightning/page/home" },
        { label: "Open Analytics", href: "/lightning/page/analytics?report=Pipeline%20by%20Stage" },
        { label: "Open Cases", href: "/lightning/o/Case/list?filterName=AllOpenCases" }
      ]
    }
  };
}

function buildPipelineAgentforceResponse(workspace: AgentforceWorkspace): { text: string; metadata: AgentforceMetadata } {
  const openOpportunities = workspace.opportunities.filter((record) => !isClosedOpportunityStage(record.stage));
  const stageTotals = groupBy(openOpportunities, (record) => record.stage || "No Stage");
  const stageSummary = Object.entries(stageTotals)
    .map(([stage, records]) => `${stage}: ${records.length} / ${formatUsd(sumAmounts(records.map((record) => record.amount)))}`)
    .join("; ");
  const topDeal = [...openOpportunities].sort((left, right) => amountNumber(right.amount) - amountNumber(left.amount))[0];
  const text = openOpportunities.length === 0
    ? "There is no open opportunity pipeline yet. Create a deal to start forecasting revenue."
    : `Open pipeline has ${openOpportunities.length} opportunities totaling ${formatUsd(sumAmounts(openOpportunities.map((record) => record.amount)))}. ${stageSummary}. ${topDeal ? `Largest open deal is ${topDeal.name} at ${formatUsd(topDeal.amount)}.` : ""}`;
  return {
    text,
    metadata: {
      kind: "pipeline",
      facts: [
        { label: "Open Opportunities", value: String(openOpportunities.length) },
        { label: "Pipeline Amount", value: formatUsd(sumAmounts(openOpportunities.map((record) => record.amount))) },
        { label: "Stages", value: String(Object.keys(stageTotals).length) },
        { label: "Largest Deal", value: topDeal ? String(topDeal.name) : "None" }
      ],
      actions: [
        { label: "View Pipeline Report", href: "/lightning/page/analytics?report=Pipeline%20by%20Stage" },
        { label: "Open Opportunities", href: "/lightning/o/Opportunity/list" },
        { label: "New Opportunity", href: "/lightning/o/Opportunity/new" }
      ]
    }
  };
}

function buildCaseAgentforceResponse(workspace: AgentforceWorkspace): { text: string; metadata: AgentforceMetadata } {
  const openCases = workspace.cases.filter((record) => !isClosedCaseStatus(record.status));
  const highPriority = openCases.filter((record) => record.priority === "High");
  const statusTotals = groupBy(openCases, (record) => record.status || "No Status");
  const text = openCases.length === 0
    ? "There are no open cases right now. Support workload is clear."
    : `There are ${openCases.length} open cases. ${highPriority.length} are high priority. Status mix: ${Object.entries(statusTotals).map(([status, records]) => `${status}: ${records.length}`).join("; ")}.`;
  return {
    text,
    metadata: {
      kind: "cases",
      facts: [
        { label: "Open Cases", value: String(openCases.length) },
        { label: "High Priority", value: String(highPriority.length) },
        { label: "Escalated", value: String(openCases.filter((record) => record.status === "Escalated").length) },
        { label: "Closed", value: String(workspace.cases.filter((record) => isClosedCaseStatus(record.status)).length) }
      ],
      actions: [
        { label: "Open Case List", href: "/lightning/o/Case/list?filterName=AllOpenCases" },
        { label: "View Case Report", href: "/lightning/page/analytics?report=Open%20Cases%20for%20Accounts%20I%20Own" },
        { label: "New Case", href: "/lightning/o/Case/new" }
      ]
    }
  };
}

function buildLeadAgentforceResponse(workspace: AgentforceWorkspace): { text: string; metadata: AgentforceMetadata } {
  const statusTotals = groupBy(workspace.leads, (record) => record.status || "No Status");
  const qualified = workspace.leads.filter((record) => record.status === "Qualified");
  const withEmail = workspace.leads.filter((record) => Boolean(record.email));
  const text = workspace.leads.length === 0
    ? "There are no leads yet. Add leads to begin prospecting and qualification."
    : `There are ${workspace.leads.length} leads. ${qualified.length} are qualified and ${withEmail.length} have email addresses. Status mix: ${Object.entries(statusTotals).map(([status, records]) => `${status}: ${records.length}`).join("; ")}.`;
  return {
    text,
    metadata: {
      kind: "leads",
      facts: [
        { label: "Total Leads", value: String(workspace.leads.length) },
        { label: "Qualified", value: String(qualified.length) },
        { label: "With Email", value: String(withEmail.length) },
        { label: "Statuses", value: String(Object.keys(statusTotals).length) }
      ],
      actions: [
        { label: "Open Leads", href: "/lightning/o/Lead/list?filterName=AllOpenLeads" },
        { label: "View Lead Report", href: "/lightning/page/analytics?report=Leads%20by%20Status" },
        { label: "New Lead", href: "/lightning/o/Lead/new" }
      ]
    }
  };
}

function buildFollowUpAgentforceResponse(text: string, workspace: AgentforceWorkspace, userName: string): { text: string; metadata: AgentforceMetadata } {
  const target = findFollowUpTarget(text, workspace);
  const recipientName = target.contact ? contactDisplayName(target.contact) : target.account?.name ?? workspace.accounts[0]?.name ?? "Customer";
  const accountName = target.account?.name ?? target.contact?.account?.name ?? "your account";
  const openCases = workspace.cases.filter((record) => !isClosedCaseStatus(record.status) && record.accountId && record.accountId === target.account?.id);
  const openOpportunities = workspace.opportunities.filter((record) => !isClosedOpportunityStage(record.stage) && record.accountId === target.account?.id);
  const subject = `Follow up with ${recipientName}`;
  const body = [
    `Hi ${recipientName},`,
    "",
    `I wanted to follow up on ${accountName} and make sure we are aligned on next steps.`,
    openOpportunities[0] ? `I also have ${openOpportunities[0].name} on my radar, currently in ${openOpportunities[0].stage}.` : "I can help identify the next sales step when you are ready.",
    openCases.length > 0 ? `I noticed ${openCases.length} open support case${openCases.length === 1 ? "" : "s"} and can coordinate an update.` : "There are no open support cases blocking the conversation.",
    "",
    "Best,",
    userName
  ].join("\n");
  return {
    text: `I drafted a follow-up for ${recipientName}. It references ${accountName}, ${openOpportunities.length} open opportunities, and ${openCases.length} open cases.`,
    metadata: {
      kind: "draft",
      facts: [
        { label: "Recipient", value: recipientName },
        { label: "Account", value: accountName },
        { label: "Open Deals", value: String(openOpportunities.length) },
        { label: "Open Cases", value: String(openCases.length) }
      ],
      draft: {
        subject,
        body,
        to: target.contact?.email ?? undefined
      },
      actions: [
        { label: "Open List Emails", href: "/lightning/o/ListEmail/list" },
        target.contact ? { label: "Open Contact", href: `/lightning/r/Contact/${target.contact.id}/view` } : { label: "Open Accounts", href: "/lightning/o/Account/list" },
        { label: "Open Analytics", href: "/lightning/page/analytics?report=Contacts%20by%20Account" }
      ]
    }
  };
}

function findFollowUpTarget(text: string, workspace: AgentforceWorkspace) {
  const normalized = text.toLowerCase();
  const contact = workspace.contacts.find((record) => normalized.includes(contactDisplayName(record).toLowerCase()) || normalized.includes(record.lastName.toLowerCase()));
  const account = contact?.account ?? workspace.accounts.find((record) => normalized.includes(record.name.toLowerCase())) ?? workspace.accounts[0];
  return { contact: contact ?? workspace.contacts.find((record) => record.accountId === account?.id) ?? workspace.contacts[0], account };
}

function contactDisplayName(record: { salutation?: string | null; firstName?: string | null; lastName: string }) {
  return [record.salutation, record.firstName, record.lastName].filter(Boolean).join(" ");
}

function groupBy<T>(records: T[], labelFor: (record: T) => string) {
  return records.reduce<Record<string, T[]>>((accumulator, record) => {
    const label = labelFor(record);
    accumulator[label] = [...(accumulator[label] ?? []), record];
    return accumulator;
  }, {});
}

function isClosedOpportunityStage(stage?: string | null) {
  return stage === "Closed Won" || stage === "Closed Lost";
}

function isClosedCaseStatus(status?: string | null) {
  return status === "Closed";
}

function sumAmounts(values: unknown[]) {
  return values.reduce<number>((sum, value) => sum + amountNumber(value), 0);
}

function amountNumber(value: unknown) {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatUsd(value: unknown) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amountNumber(value));
}

function formatShortDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(value);
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
