import { cleanupUsecaseState, restoreProfileAndPreferencesState } from "./usecases/cleanup.mjs";
import { runFoundationScenarios } from "./usecases/scenarios/foundation.mjs";
import { runRecordsScenarios } from "./usecases/scenarios/records.mjs";
import { runInvoicesScenarios } from "./usecases/scenarios/invoices.mjs";
import { runRecordExperienceScenarios } from "./usecases/scenarios/record-experience.mjs";
import { runCommerceScenarios } from "./usecases/scenarios/commerce.mjs";
import { runCommunicationsScenarios } from "./usecases/scenarios/communications.mjs";
import { runDomainWorkflowsScenarios } from "./usecases/scenarios/domain-workflows.mjs";
import { runPlatformResourcesScenarios } from "./usecases/scenarios/platform-resources.mjs";
import { runMarketingAccountScenarios } from "./usecases/scenarios/marketing-account.mjs";
import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { encode } from "next-auth/jwt";

const prisma = new PrismaClient();
const baseUrl = process.env.CRM_BASE_URL ?? "http://127.0.0.1:3001";
const tag = `codex-uc-${Date.now()}`;
const currentUserId = "crm-usecase-user";
const organizationId = "org-robert";
const keycloakSub = randomUUID();
const authSecret = process.env.AUTH_SECRET;
let authCookie = "";

const created = {
  accounts: [],
  contacts: [],
  leads: [],
  opportunities: [],
  cases: [],
  products: [],
  priceBooks: [],
  priceBookEntries: [],
  invoices: [],
  invoiceLineItems: [],
  invoicePayments: [],
  events: [],
  tasks: [],
  emailActivities: [],
  emailDeliveries: [],
  emailDeliveryEvents: [],
  callActivities: [],
  files: [],
  attachments: [],
  messagingSessions: [],
  messagingMessages: [],
  videoCalls: [],
  videoCallParticipants: [],
  quickTextFolders: [],
  quickTexts: [],
  quickTextFavorites: [],
  knowledgeArticles: [],
  knowledgeFeedback: [],
  listEmails: [],
  stores: [],
  commerceOrders: [],
  commerceOrderLines: [],
  inventoryItems: [],
  commercePromotions: [],
  commerceFulfillments: [],
  commerceFulfillmentLines: [],
  campaigns: [],
  labels: [],
  marketingActivations: [],
  marketingLandingPages: [],
  marketingFormSubmissions: [],
  notifications: [],
  notificationPreferences: [],
  calendarSources: [],
  partners: [],
  customReports: [],
  customDashboards: [],
  appNavPreferences: [],
  listViewPreferences: [],
  globalSearchRecents: [],
  agentforceMessages: [],
  setupShortcutStates: [],
  helpArticleStates: [],
  guidanceStates: []
};

const results = [];
let originalUser = null;
let originalPreference = null;
let originalLeadGuidanceState = null;

function setOriginalUser(value) {
  originalUser = value;
}

function setOriginalPreference(value) {
  originalPreference = value;
}

function setOriginalLeadGuidanceState(value) {
  originalLeadGuidanceState = value;
}

function remember(key, value) {
  if (value?.id && created[key]) created[key].push(String(value.id));
  return value;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, { method = "GET", body, expected = [200] } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { Cookie: authCookie, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  if (!expected.includes(response.status)) {
    throw new Error(`${method} ${path} returned ${response.status}: ${text.slice(0, 500)}`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const payload = text ? JSON.parse(text) : {};
    if (payload && typeof payload === "object" && "data" in payload) return payload.data;
    if (payload?.error && typeof payload.error === "object") {
      return {
        ...payload,
        code: payload.error.code,
        error: payload.error.message,
        fields: payload.error.fieldErrors ? Object.keys(payload.error.fieldErrors) : undefined
      };
    }
    return payload;
  }
  return text;
}

async function requestRaw(path, { method = "GET", body, expected = [200] } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { Cookie: authCookie, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!expected.includes(response.status)) {
    throw new Error(`${method} ${path} returned ${response.status}: ${(await response.text()).slice(0, 500)}`);
  }
  return response;
}

async function requestForm(path, form, { method = "POST", expected = [200, 201] } = {}) {
  const response = await fetch(`${baseUrl}${path}`, { method, headers: { Cookie: authCookie }, body: form });
  const text = await response.text();
  if (!expected.includes(response.status))
    throw new Error(`${method} ${path} returned ${response.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : {};
}

async function requestAnonymous(path, { method = "GET", body, expected = [200] } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual"
  });
  const text = await response.text();
  if (!expected.includes(response.status))
    throw new Error(`${method} ${path} returned ${response.status}: ${text.slice(0, 500)}`);
  return response.headers.get("content-type")?.includes("application/json") ? (text ? JSON.parse(text) : {}) : text;
}

function rememberInvoiceResult(result) {
  if (result?.invoice) {
    remember("invoices", result.invoice);
    result.invoice.lineItems?.forEach((line) => remember("invoiceLineItems", line));
    result.invoice.payments?.forEach((payment) => remember("invoicePayments", payment));
  }
  result?.notifications?.forEach((notification) => remember("notifications", notification));
  return result?.invoice;
}

async function check(name, fn) {
  const started = Date.now();
  try {
    await fn();
    results.push({ name, status: "PASS", ms: Date.now() - started });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, status: "FAIL", ms: Date.now() - started, error: error.message });
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}

async function postRecord(object, payload, key) {
  const response = await request(`/api/records/${object}`, { method: "POST", body: payload, expected: [201] });
  assert(response.record?.id, `${object} create did not return a record id`);
  remember(key, response.record);
  return response.record;
}

async function patchRecord(object, id, payload) {
  const response = await request(`/api/records/${object}/${id}`, { method: "PATCH", body: payload, expected: [200] });
  assert(response.record?.id === id, `${object} update did not return the same record id`);
  return response.record;
}

async function workflow(action, object, selectedIds = [], values = {}) {
  const paths = {
    "Assign Label": "/api/actions/labels",
    "Add to Campaign": "/api/actions/campaign-members",
    "Change Owner": "/api/actions/ownership",
    "Add to Category": "/api/actions/product-categories",
    "Convert Lead": "/api/actions/lead-conversion",
    "New Folder": "/api/actions/quick-text-folders",
    "Create Store": "/api/actions/commerce-stores",
    "Activate Marketing": "/api/actions/marketing-activation",
    Publish: "/api/actions/knowledge/publish",
    Assign: "/api/actions/knowledge/assign",
    Archive: "/api/actions/knowledge/archive",
    "Delete Article": "/api/actions/knowledge/delete",
    "Delete Draft": "/api/actions/knowledge/delete-draft",
    Restore: "/api/actions/knowledge/restore",
    "Merge Cases": "/api/actions/case-merge"
  };
  const path = paths[action];
  assert(path, `No typed endpoint is registered for ${action}`);
  const response = await request(path, {
    method: "POST",
    body: { object, selectedIds, values },
    expected: [200]
  });
  assert(response.ok, `${action} workflow did not return ok`);
  return response;
}

async function utility(action, values = {}, id) {
  const encodedId = encodeURIComponent(id ?? "");
  const routes = {
    createPartner: ["/api/partners", "POST"],
    createCalendarSource: ["/api/calendar/sources", "POST"],
    updateCalendarSource: [`/api/calendar/sources/${encodedId}`, "PATCH"],
    deleteCalendarSource: [`/api/calendar/sources/${encodedId}`, "DELETE"],
    toggleQuickTextFavorite: [`/api/quick-text/favorites/${encodedId}`, "PUT"],
    saveCustomReport: ["/api/reports", "POST"],
    updateCustomReport: [`/api/reports/${encodedId}`, "PATCH"],
    deleteCustomReport: [`/api/reports/${encodedId}`, "DELETE"],
    saveCustomDashboard: ["/api/dashboards", "POST"],
    updateCustomDashboard: [`/api/dashboards/${encodedId}`, "PATCH"],
    deleteCustomDashboard: [`/api/dashboards/${encodedId}`, "DELETE"],
    createNotification: ["/api/notifications", "POST"],
    markNotificationRead: [`/api/notifications/${encodedId}`, "PATCH"],
    updateNotificationPreference: [
      `/api/notification-preferences/${encodeURIComponent(String(values.category ?? ""))}`,
      "PUT"
    ],
    updateSetupShortcutState: [`/api/setup/state/${encodeURIComponent(String(values.shortcutId ?? id ?? ""))}`, "PUT"],
    updateHelpArticleState: [`/api/help/state/${encodeURIComponent(String(values.articleId ?? id ?? ""))}`, "PUT"],
    updateGuidance: [`/api/guidance/${encodedId}`, "PUT"],
    updateAppNavPreference: ["/api/navigation/preferences", "PUT"],
    resetAppNavPreference: ["/api/navigation/preferences", "DELETE"],
    saveListViewPreference: ["/api/list-views", "PUT"],
    pinListViewPreference: ["/api/list-views", "PUT"],
    deleteListViewPreference: ["/api/list-views", "DELETE"],
    saveGlobalSearchRecent: ["/api/search/recents", "POST"],
    updateProfile: ["/api/profile", "PATCH"],
    updatePreferences: ["/api/preferences", "PATCH"]
  };
  const route = routes[action];
  assert(route, `No resource endpoint is registered for ${action}`);
  const body = action === "pinListViewPreference" ? { ...values, pin: true } : values;
  const response = await request(route[0], {
    method: route[1],
    body,
    expected: [200, 201]
  });
  assert(response.ok, `${action} utility did not return ok`);
  return response;
}

async function main() {
  if (!authSecret) throw new Error("AUTH_SECRET must be set for authenticated use-case checks.");

  await prisma.user.upsert({
    where: { id: currentUserId },
    update: {
      keycloakSub,
      email: "crm-usecase@example.com",
      name: "CRM Usecase User",
      alias: "CRMTest",
      status: "ACTIVE"
    },
    create: {
      id: currentUserId,
      keycloakSub,
      email: "crm-usecase@example.com",
      name: "CRM Usecase User",
      alias: "CRMTest",
      status: "ACTIVE"
    }
  });

  await prisma.organizationMembership.upsert({
    where: { organizationId_userId: { organizationId, userId: currentUserId } },
    update: { role: "ADMIN", status: "ACTIVE" },
    create: { organizationId, userId: currentUserId, role: "ADMIN", status: "ACTIVE" }
  });

  const appSessionId = randomUUID();

  const token = await encode({
    secret: authSecret,
    salt: "authjs.session-token",
    token: {
      sub: keycloakSub,
      appUserId: currentUserId,
      userStatus: "ACTIVE",
      appSessionId,
      email: "crm-usecase@example.com",
      name: "CRM Usecase User"
    }
  });

  authCookie = `authjs.session-token=${token}; crm_active_organization=${organizationId}`;

  const context = {
    assert,
    authCookie,
    baseUrl,
    check,
    created,
    currentUserId,
    organizationId,
    patchRecord,
    postRecord,
    prisma,
    randomUUID,
    readFile,
    request,
    requestAnonymous,
    requestForm,
    requestRaw,
    remember,
    rememberInvoiceResult,
    restoreProfileAndPreferences,
    setOriginalLeadGuidanceState,
    setOriginalPreference,
    setOriginalUser,
    tag,
    utility,
    workflow
  };
  const state = {};

  await runFoundationScenarios(context, state);
  await runRecordsScenarios(context, state);
  await runInvoicesScenarios(context, state);
  await runRecordExperienceScenarios(context, state);
  await runCommunicationsScenarios(context, state);
  await runCommerceScenarios(context, state);
  await runDomainWorkflowsScenarios(context, state);
  await runPlatformResourcesScenarios(context, state);
  await runMarketingAccountScenarios(context, state);
}
async function restoreProfileAndPreferences() {
  return restoreProfileAndPreferencesState({
    originalPreference,
    originalUser,
    prisma
  });
}

try {
  await main();
} finally {
  await cleanupUsecaseState({
    created,
    currentUserId,
    organizationId,
    originalLeadGuidanceState,
    originalPreference,
    originalUser,
    prisma,
    tag
  });
  await prisma.$disconnect();
}

const failed = results.filter((result) => result.status === "FAIL");
console.log("");
console.log(`Use-case checks: ${results.length - failed.length}/${results.length} passed`);
for (const result of results) {
  console.log(`${result.status} ${result.name} (${result.ms}ms)${result.error ? ` - ${result.error}` : ""}`);
}

if (failed.length > 0) {
  process.exitCode = 1;
}
