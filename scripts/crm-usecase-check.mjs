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
  if (contentType.includes("application/json")) return text ? JSON.parse(text) : {};
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
  if (!expected.includes(response.status)) throw new Error(`${method} ${path} returned ${response.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : {};
}

async function requestAnonymous(path, { method = "GET", body, expected = [200] } = {}) {
  const response = await fetch(`${baseUrl}${path}`, { method, headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined, redirect: "manual" });
  const text = await response.text();
  if (!expected.includes(response.status)) throw new Error(`${method} ${path} returned ${response.status}: ${text.slice(0, 500)}`);
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
  const response = await request("/api/workflows", {
    method: "POST",
    body: { action, object, selectedIds, values },
    expected: [200]
  });
  assert(response.ok, `${action} workflow did not return ok`);
  return response;
}

async function utility(action, values = {}, id) {
  const response = await request("/api/utilities", {
    method: "POST",
    body: { action, id, values },
    expected: [200, 201]
  });
  assert(response.ok, `${action} utility did not return ok`);
  return response;
}

async function main() {
  if (!authSecret) throw new Error("AUTH_SECRET must be set for authenticated use-case checks.");
  await prisma.user.upsert({
    where: { id: currentUserId },
    update: { keycloakSub, email: "crm-usecase@example.com", name: "CRM Usecase User", alias: "CRMTest", status: "ACTIVE" },
    create: { id: currentUserId, keycloakSub, email: "crm-usecase@example.com", name: "CRM Usecase User", alias: "CRMTest", status: "ACTIVE" }
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
    token: { sub: keycloakSub, appUserId: currentUserId, userStatus: "ACTIVE", appSessionId, email: "crm-usecase@example.com", name: "CRM Usecase User" }
  });
  authCookie = `authjs.session-token=${token}; crm_active_organization=${organizationId}`;

  await check("server is reachable", async () => {
    const html = await request("/lightning/page/home");
    assert(html.includes("Reloriq"), "home page did not render the Reloriq shell");
  });

  await check("all documented routes render", async () => {
    const routes = [
      ["/", "lightning/page/home"],
      ["/lightning/page/home", "Home"],
      ["/lightning/app/home", "Home"],
      ["/lightning/app/contacts", "Contacts"],
      ["/lightning/app/accounts", "Accounts"],
      ["/lightning/app/sales", "Leads"],
      ["/lightning/app/service", "Cases"],
      ["/lightning/app/marketing", "Marketing"],
      ["/lightning/app/commerce", "Stores"],
      ["/lightning/app/your-account", "Your Account"],
      ["/lightning/o/Contact/list", "Contacts"],
      ["/lightning/o/Account/list", "Accounts"],
      ["/lightning/o/Lead/list", "Leads"],
      ["/lightning/o/Opportunity/list", "Opportunities"],
      ["/lightning/o/Product2/list", "Products"],
      ["/lightning/o/Pricebook2/list", "Price Books"],
      ["/lightning/o/Event/home", "Calendar"],
      ["/lightning/o/Case/list", "Cases"],
      ["/lightning/o/QuickText/home", "Quick Text"],
      ["/lightning/o/MessagingSession/list", "Messaging Sessions"],
      ["/lightning/o/Knowledge__kav/list", "Knowledge"],
      ["/lightning/o/ListEmail/list", "List Emails"],
      ["/lightning/o/Campaign/list", "Campaigns"],
      ["/lightning/o/Invoice/list", "Invoices"],
      ["/lightning/o/VideoCall/list", "Video Calls"],
      ["/lightning/setup/users", "Organization users"],
      ["/account/sessions", "Account sessions"],
      ["/lightning/r/Account/acc-robert/view", "Robert"],
      ["/lightning/r/Contact/con-rober-antonio/view", "Rober"]
    ];
    for (const [route, fragment] of routes) {
      const html = await request(route);
      assert(html.includes(fragment), `${route} did not include ${fragment}`);
    }
  });

  await check("global shell and object action affordances render", async () => {
    const home = await request("/lightning/page/home");
    for (const fragment of [
      "Search...",
      "Reloriq AI",
      "Guidance Center",
      "Reloriq Help",
      "Quick Settings",
      "Notifications",
      "View profile"
    ]) {
      assert(home.includes(fragment), `home shell missing ${fragment}`);
    }
    assert(!home.includes("STARTER70") && !home.includes("Days left in your Trial"), "home shell still renders the trial purchase banner");

    const contactList = await request("/lightning/o/Contact/list");
    for (const fragment of [
      "Select a List View: Contacts",
      "Search this list...",
      "List View Controls",
      "Select list display",
      "Import",
      "Add to Campaign",
      "Send Email",
      "Assign Label"
    ]) {
      assert(contactList.includes(fragment), `Contact list missing ${fragment}`);
    }

    const leadList = await request("/lightning/o/Lead/list");
    for (const fragment of ["Change Owner", "Show more actions"]) {
      assert(leadList.includes(fragment), `Lead list missing ${fragment}`);
    }

    const caseList = await request("/lightning/o/Case/list");
    for (const fragment of ["Merge Cases", "Printable View", "Assign Label"]) {
      assert(caseList.includes(fragment), `Case list missing ${fragment}`);
    }
    assert(caseList.includes("data-disabled=\"true\""), "Case list column sort is not exposed as visually disabled");
    assert(
      caseList.includes("Column sort is disabled. To sort columns, a list view needs at least one row and two columns."),
      "Case list missing disabled column sort reason"
    );

    const knowledgeList = await request("/lightning/o/Knowledge__kav/list");
    for (const fragment of ["Publish", "Assign", "Archive", "Delete Article", "Show more actions"]) {
      assert(knowledgeList.includes(fragment), `Knowledge list missing ${fragment}`);
    }

    const accountRecord = await request("/lightning/r/Account/acc-robert/view");
    for (const fragment of ["View Account Hierarchy", "New Contact", "New Opportunity", "Related", "Details", "We found no potential duplicates", "Activity", "Upload Files"]) {
      assert(accountRecord.includes(fragment), `Account record missing ${fragment}`);
    }

    const commerce = await request("/lightning/app/commerce");
    assert(commerce.includes("New Store"), "Commerce page missing New Store");
    const yourAccount = await request("/lightning/app/your-account");
    for (const fragment of ["Profile", "Workspace", "Personal Preferences", "Security and Access", "Manage Sessions"]) {
      assert(yourAccount.includes(fragment), `Your Account page missing ${fragment}`);
    }
    assert(!yourAccount.includes("Buy Now") && !yourAccount.toLowerCase().includes("subscription") && !yourAccount.toLowerCase().includes("trial workspace"), "Your Account page still renders purchase content");
  });

  await check("required create validation and unsupported workflow errors", async () => {
    const requiredCases = [
      ["Account", {}, ["name"]],
      ["Contact", { lastName: `${tag} Invalid Contact` }, ["accountId"]],
      ["Lead", { status: "New", company: `${tag} Company` }, ["lastName"]],
      ["Opportunity", { name: `${tag} Invalid Opportunity`, stage: "Qualify" }, ["accountId", "closeDate", "forecastCategory"]],
      ["Product2", {}, ["name"]],
      ["Pricebook2", {}, ["name"]],
      ["Event", { subject: "--None--", startAt: "2026-08-20T09:00:00.000Z", endAt: "2026-08-20T10:00:00.000Z" }, ["subject", "assignedToId"]],
      ["QuickText", { name: `${tag} Invalid Quick Text` }, ["message"]],
      ["Knowledge__kav", { title: `${tag} Invalid Knowledge` }, ["urlName"]]
    ];

    for (const [object, body, fields] of requiredCases) {
      const result = await request(`/api/records/${object}`, { method: "POST", body, expected: [400] });
      assert(result.error === "Complete this field.", `${object} required validation returned wrong error`);
      for (const field of fields) assert(result.fields?.includes(field), `${object} required validation missing ${field}`);
    }

    const unsupportedWorkflow = await request("/api/workflows", {
      method: "POST",
      body: { action: "Pretend Success", object: "Lead", selectedIds: [], values: {} },
      expected: [400]
    });
    assert(unsupportedWorkflow.error?.includes("Unsupported workflow"), "unknown workflow action returned a false success");
    const emptyBulkAction = await request("/api/workflows", {
      method: "POST",
      body: { action: "Assign Label", object: "Lead", selectedIds: [], values: { label: "Must not apply" } },
      expected: [400]
    });
    assert(emptyBulkAction.error?.includes("Select at least one"), "destructive bulk workflow accepted an empty selection");
    const invalidOpportunityAmount = await request("/api/records/Opportunity", {
      method: "POST",
      body: { name: "Invalid", accountId: "acc-robert", closeDate: "2026-08-20", amount: "-1", stage: "Qualify", probability: 101, forecastCategory: "Pipeline" },
      expected: [400]
    });
    assert(invalidOpportunityAmount.fields?.includes("amount") || invalidOpportunityAmount.fields?.includes("probability"), "Opportunity numeric validation did not return a field-level error");
    const invalidKnowledgeUrl = await request("/api/records/Knowledge__kav", {
      method: "POST",
      body: { title: "Invalid URL", urlName: "Not a valid URL name" },
      expected: [400]
    });
    assert(invalidKnowledgeUrl.fields?.includes("urlName"), "Knowledge URL Name validation did not return a field-level error");
    const webhook = await requestAnonymous("/api/email/webhooks/sendgrid", { method: "POST", body: [], expected: [200] });
    assert(webhook.ok === true, "SendGrid webhook should accept events when verification key is unset");
  });

  await check("metadata covers country/state dependencies and Event lookup objects", async () => {
    const metadata = await readFile("src/lib/crm-metadata.ts", "utf8");
    const component = await readFile("src/components/crm/CrmApp.tsx", "utf8");

    const requiredCountries = [
      "Afghanistan",
      "Argentina",
      "Brazil",
      "Canada",
      "China",
      "France",
      "Germany",
      "India",
      "Japan",
      "Mexico",
      "Nigeria",
      "Pakistan",
      "Philippines",
      "South Africa",
      "United Arab Emirates",
      "United Kingdom",
      "United States",
      "Zimbabwe"
    ];
    for (const country of requiredCountries) assert(metadata.includes(`"${country}"`), `country list missing ${country}`);

    const requiredStateMappings = [
      "Argentina: AR_PROVINCES",
      "Brazil: BR_STATES",
      "Canada: CA_PROVINCES",
      "China: CN_PROVINCES",
      "France: FR_REGIONS",
      "Germany: DE_STATES",
      "India: IN_STATES",
      "Japan: JP_PREFECTURES",
      "Mexico: MX_STATES",
      "Nigeria: NG_STATES",
      "Pakistan: PK_PROVINCES",
      "Philippines: PH_REGIONS",
      "\"South Africa\": ZA_PROVINCES",
      "\"United Arab Emirates\": AE_EMIRATES",
      "\"United Kingdom\": GB_COUNTIES",
      "\"United States\": US_STATES"
    ];
    for (const mapping of requiredStateMappings) assert(metadata.includes(mapping), `state dependency missing ${mapping}`);

    for (const lookup of ["Product2", "Pricebook2", "ListEmail", "Invoice", "Knowledge__kav"]) {
      assert(component.includes(`field.lookupObject === "${lookup}"`), `Event lookup support missing ${lookup}`);
    }
  });

  await check("bootstrap exposes seeded data and all collections", async () => {
    const data = await request("/api/bootstrap");
    const requiredCollections = [
      "accounts",
      "contacts",
      "leads",
      "opportunities",
      "cases",
      "products",
      "priceBooks",
      "events",
      "quickTexts",
      "knowledgeArticles",
      "listEmails",
      "messagingSessions",
      "invoices",
      "videoCalls",
      "campaigns",
      "marketingLandingPages",
      "commerceOrders",
      "inventoryItems",
      "commercePromotions",
      "commerceFulfillments",
      "files",
      "attachments",
      "tasks",
      "emailActivities",
      "emailDeliveries",
      "callActivities",
      "notifications",
      "userPreferences"
    ];
    assert(data.user?.id === currentUserId, "bootstrap did not return the current seeded user");
    assert(data.accounts.some((account) => account.id === "acc-robert"), "seeded Robert account missing");
    assert(data.contacts.some((contact) => contact.id === "con-rober-antonio"), "seeded Rober Antonio contact missing");
    for (const key of requiredCollections) assert(Array.isArray(data[key]), `${key} is not an array`);
  });

  await check("organization isolation rejects cross-tenant access", async () => {
    const isolatedOrganization = await prisma.organization.create({ data: { name: `${tag} Isolated`, slug: `${tag}-isolated`.toLowerCase() } });
    const isolatedAccount = await prisma.account.create({
      data: { organizationId: isolatedOrganization.id, name: `${tag} Hidden Account`, ownerId: currentUserId, createdById: currentUserId, updatedById: currentUserId }
    });
    const isolatedProduct = await prisma.product.create({ data: { organizationId: isolatedOrganization.id, name: `${tag} Hidden Product`, active: true } });
    const isolatedInvoice = await prisma.invoice.create({
      data: {
        organizationId: isolatedOrganization.id,
        invoiceNumber: "INV-ISOLATED-000001",
        accountId: isolatedAccount.id,
        status: "Draft",
        issueDate: new Date("2026-07-01T00:00:00.000Z"),
        dueDate: new Date("2026-07-31T00:00:00.000Z"),
        billingName: isolatedAccount.name,
        createdById: currentUserId
      }
    });
    const isolatedMessaging = await prisma.messagingSession.create({
      data: { organizationId: isolatedOrganization.id, name: `${tag} Hidden Session`, status: "Open", channel: "Web Chat", ownerId: currentUserId, createdById: currentUserId }
    });
    const isolatedVideo = await prisma.videoCall.create({
      data: { organizationId: isolatedOrganization.id, name: `${tag} Hidden Call`, status: "Scheduled", provider: "External Link", scheduledStartAt: new Date("2026-08-01T10:00:00.000Z"), scheduledEndAt: new Date("2026-08-01T11:00:00.000Z"), organizerId: currentUserId, createdById: currentUserId }
    });
    const isolatedCampaign = await prisma.campaign.create({
      data: { organizationId: isolatedOrganization.id, name: `${tag} Hidden Campaign`, status: "Planned", ownerId: currentUserId, createdById: currentUserId }
    });
    const isolatedStore = await prisma.marketingStore.create({
      data: { organizationId: isolatedOrganization.id, name: `${tag} Hidden Store`, slug: `${tag}-hidden-store`, currency: "USD", status: "Draft", createdById: currentUserId }
    });
    const isolatedLandingPage = await prisma.marketingLandingPage.create({
      data: { organizationId: isolatedOrganization.id, name: `${tag} Hidden Form`, slug: `${tag}-hidden-form`, headline: "Hidden", fields: ["lastName", "email", "company"], ownerId: currentUserId, createdById: currentUserId }
    });
    try {
      const data = await request("/api/bootstrap");
      assert(!data.accounts.some((record) => record.id === isolatedAccount.id), "bootstrap leaked another organization's account");
      assert(!data.invoices.some((record) => record.id === isolatedInvoice.id), "bootstrap leaked another organization's invoice");
      assert(!data.marketingLandingPages.some((record) => record.id === isolatedLandingPage.id), "bootstrap leaked another organization's landing page");
      await request(`/api/invoices/${isolatedInvoice.id}`, { expected: [404] });
      await request(`/api/invoices/${isolatedInvoice.id}`, { method: "PATCH", body: { notes: "Cross tenant update" }, expected: [404] });
      await request(`/api/invoices/${isolatedInvoice.id}`, { method: "DELETE", expected: [404] });
      await request(`/api/messaging-sessions/${isolatedMessaging.id}`, { expected: [404] });
      await request(`/api/messaging-sessions/${isolatedMessaging.id}`, { method: "PATCH", body: { name: "Cross tenant update" }, expected: [404] });
      await request(`/api/messaging-sessions/${isolatedMessaging.id}`, { method: "DELETE", expected: [404] });
      await request(`/api/video-calls/${isolatedVideo.id}`, { expected: [404] });
      await request(`/api/video-calls/${isolatedVideo.id}`, { method: "PATCH", body: { notes: "Cross tenant update" }, expected: [404] });
      await request(`/api/video-calls/${isolatedVideo.id}`, { method: "DELETE", expected: [404] });
      await request(`/api/campaigns/${isolatedCampaign.id}`, { expected: [404] });
      await request(`/api/campaigns/${isolatedCampaign.id}`, { method: "PATCH", body: { name: "Cross tenant update" }, expected: [404] });
      await request(`/api/campaigns/${isolatedCampaign.id}`, { method: "DELETE", expected: [404] });
      await request(`/api/commerce/stores/${isolatedStore.id}`, { expected: [404] });
      await request(`/api/commerce/stores/${isolatedStore.id}`, { method: "PATCH", body: { name: "Cross tenant update" }, expected: [404] });
      await request(`/api/commerce/stores/${isolatedStore.id}`, { method: "DELETE", expected: [404] });
      await request(`/api/marketing/landing-pages/${isolatedLandingPage.id}`, { expected: [404] });
      await request(`/api/marketing/landing-pages/${isolatedLandingPage.id}`, { method: "PATCH", body: { name: "Cross tenant update" }, expected: [404] });
      await request(`/api/marketing/landing-pages/${isolatedLandingPage.id}`, { method: "DELETE", expected: [404] });
      await request(`/api/records/Account/${isolatedAccount.id}`, { method: "PATCH", body: { name: "Cross tenant update" }, expected: [404] });
      await request(`/api/records/Account/${isolatedAccount.id}`, { method: "DELETE", expected: [404] });
      const isolatedInsight = await request("/api/ai/insights", {
        method: "POST",
        body: { surface: "activity", object: "Account", recordId: isolatedAccount.id },
        expected: [404]
      });
      assert(isolatedInsight.code === "record_not_found", "AI activity lookup exposed another organization's record");
      await request("/api/organizations/active", { method: "POST", body: { organizationId: isolatedOrganization.id }, expected: [404] });
      await request("/api/workflows", { method: "POST", body: { action: "Add to Category", object: "Product2", selectedIds: [isolatedProduct.id], values: { category: "Cross tenant category" } }, expected: [404] });
      const unchangedProduct = await prisma.product.findUnique({ where: { id: isolatedProduct.id } });
      assert(unchangedProduct?.category === null, "workflow changed another organization's product");
    } finally {
      await prisma.messagingSession.deleteMany({ where: { organizationId: isolatedOrganization.id } });
      await prisma.videoCall.deleteMany({ where: { organizationId: isolatedOrganization.id } });
      await prisma.campaign.deleteMany({ where: { organizationId: isolatedOrganization.id } });
      await prisma.marketingLandingPage.deleteMany({ where: { organizationId: isolatedOrganization.id } });
      await prisma.marketingStore.deleteMany({ where: { organizationId: isolatedOrganization.id } });
      await prisma.invoice.deleteMany({ where: { organizationId: isolatedOrganization.id } });
      await prisma.product.deleteMany({ where: { organizationId: isolatedOrganization.id } });
      await prisma.account.deleteMany({ where: { organizationId: isolatedOrganization.id } });
      await prisma.organization.delete({ where: { id: isolatedOrganization.id } });
    }
  });

  await check("application session registry exposes the current session", async () => {
    const sessions = await request("/api/account/sessions");
    assert(sessions.appSessions?.some((session) => session.current), "current application session was not registered");
    const result = await request("/api/account/sessions", { method: "POST", body: { action: "logout-others" } });
    assert(result.ok, "logout-others did not complete");
  });

  let account;
  let contact;
  let lead;
  let opportunity;
  let caseA;
  let caseB;
  let product;
  let priceBook;
  let event;
  let quickTextFolder;
  let quickText;
  let knowledge;
  let listEmail;
  let invoice;

  await check("record create and update flows", async () => {
    account = await postRecord("Account", {
      name: `${tag} Account`,
      type: "Prospect",
      phone: "555-0100",
      billingCountry: "United States",
      billingState: "California"
    }, "accounts");
    await patchRecord("Account", account.id, { phone: "555-0101" });

    contact = await postRecord("Contact", {
      firstName: "Codex",
      lastName: `${tag} Contact`,
      accountId: account.id,
      email: `${tag}@example.com`,
      phone: "555-0102",
      birthDate: `1990-${String(new Date().getUTCMonth() + 1).padStart(2, "0")}-15`
    }, "contacts");
    await patchRecord("Contact", contact.id, { title: "QA Contact" });
    const invalidBirthdate = await request(`/api/records/Contact/${contact.id}`, { method: "PATCH", body: { birthDate: "not-a-date" }, expected: [400] });
    assert(invalidBirthdate.fields?.includes("birthDate"), "Contact update accepted an invalid birthdate");

    lead = await postRecord("Lead", {
      status: "New",
      firstName: "Codex",
      lastName: `${tag} Lead`,
      company: `${tag} Company`,
      email: `lead-${tag}@example.com`,
      country: "United States",
      state: "New York"
    }, "leads");
    await patchRecord("Lead", lead.id, { status: "Contacted" });

    opportunity = await postRecord("Opportunity", {
      name: `${tag} Opportunity`,
      accountId: account.id,
      contactId: contact.id,
      closeDate: "2026-08-15",
      amount: "1234",
      stage: "Qualify",
      forecastCategory: "Pipeline"
    }, "opportunities");
    await patchRecord("Opportunity", opportunity.id, { stage: "Propose", probability: 40 });

    caseA = await postRecord("Case", {
      status: "New",
      origin: "Email",
      priority: "High",
      accountId: account.id,
      contactId: contact.id,
      subject: `${tag} Case A`
    }, "cases");
    await patchRecord("Case", caseA.id, { status: "Working" });
    const closedCaseA = await patchRecord("Case", caseA.id, { status: "Closed" });
    assert(closedCaseA.closedAt, "closing a Case did not set its closed timestamp");
    const reopenedCaseA = await patchRecord("Case", caseA.id, { status: "Working" });
    assert(reopenedCaseA.closedAt === null, "reopening a Case did not clear its closed timestamp");

    caseB = await postRecord("Case", {
      status: "New",
      origin: "Phone",
      priority: "Medium",
      accountId: account.id,
      contactId: contact.id,
      subject: `${tag} Case B`
    }, "cases");
    const [concurrentCaseA, concurrentCaseB] = await Promise.all([
      postRecord("Case", { status: "New", priority: "Low", subject: `${tag} Concurrent Case A` }, "cases"),
      postRecord("Case", { status: "New", priority: "Low", subject: `${tag} Concurrent Case B` }, "cases")
    ]);
    assert(/^\d{8}$/.test(concurrentCaseA.caseNumber), "Case number did not use the eight-digit sequence format");
    assert(concurrentCaseA.caseNumber !== concurrentCaseB.caseNumber, "concurrent Case creation allocated a duplicate number");

    priceBook = await postRecord("Pricebook2", {
      name: `${tag} Price Book`,
      active: true,
      description: "Use-case price book",
      validFrom: "2026-08-01",
      validFromTime: "09:00",
      validTo: "2026-12-31",
      validToTime: "17:00"
    }, "priceBooks");
    await patchRecord("Pricebook2", priceBook.id, { description: "Updated use-case price book" });

    product = await postRecord("Product2", {
      name: `${tag} Product`,
      productCode: tag,
      sku: `${tag}-sku`,
      active: true,
      createPriceBookEntry: true,
      priceBookId: priceBook.id,
      priceBookName: priceBook.name,
      listPrice: "49.99",
      currency: "USD",
      entryActive: true
    }, "products");
    if (product.priceBookEntry?.id) remember("priceBookEntries", product.priceBookEntry);
    await patchRecord("Product2", product.id, { description: "Updated product" });

    const invalidEvent = await request("/api/records/Event", { method: "POST", body: { subject: "Meeting", startAt: "2026-08-20T10:00:00.000Z", endAt: "2026-08-20T09:00:00.000Z", assignedToId: currentUserId }, expected: [400] });
    assert(invalidEvent.error?.includes("after its start"), "Event API accepted an end time before its start time");
    event = await postRecord("Event", {
      subject: "Meeting",
      description: `${tag} event`,
      startAt: "2026-08-20T09:00:00.000Z",
      endAt: "2026-08-20T10:00:00.000Z",
      attendeeIds: [currentUserId],
      nameObjectType: "Contacts",
      nameRecordId: contact.id,
      relatedObjectType: "Accounts",
      relatedRecordId: account.id,
      assignedToId: currentUserId,
      showTimeAs: "Busy"
    }, "events");
    await patchRecord("Event", event.id, { location: "Conference Room" });

    quickTextFolder = (await workflow("New Folder", "QuickText", [], { name: `${tag} Folder`, sharing: "Private" })).folder;
    remember("quickTextFolders", quickTextFolder);
    quickText = await postRecord("QuickText", {
      name: `${tag} Quick Text`,
      message: "Hello {!Contact.FirstName}",
      folderId: quickTextFolder.id,
      category: "Greetings",
      channels: ["Email", "Event"],
      mergeFields: ["Contact.FirstName"]
    }, "quickTexts");
    await patchRecord("QuickText", quickText.id, { message: "Updated {!Contact.FirstName}" });

    const favoriteResult = await utility("toggleQuickTextFavorite", {}, quickText.id);
    favoriteResult.quickTextFavorites?.forEach((favorite) => remember("quickTextFavorites", favorite));
    assert(favoriteResult.favorite === true, "Quick Text favorite was not created");
    const bootstrapWithFavorite = await request("/api/bootstrap");
    assert(bootstrapWithFavorite.quickTextFavorites.some((favorite) => favorite.quickTextId === quickText.id), "Quick Text favorite did not persist through Bootstrap");
    const favoriteView = await request("/lightning/o/QuickText/home");
    assert(favoriteView.includes("All Favorites"), "Quick Text page omitted the persisted favorites view");

    knowledge = await postRecord("Knowledge__kav", {
      title: `${tag} Knowledge`,
      urlName: `${tag}-knowledge`,
      summary: "Use-case article",
      bodyRichText: "<p>Use-case body</p>",
      visibleInInternalApp: true,
      visibleToCustomer: false
    }, "knowledgeArticles");
    await patchRecord("Knowledge__kav", knowledge.id, { summary: "Updated article" });

    listEmail = await postRecord("ListEmail", {
      layoutType: "Sales",
      subject: `${tag} List Email`,
      body: "Use-case list email",
      recipientType: "Leads and Contacts",
      recipients: [lead.id, contact.id],
      status: "Draft"
    }, "listEmails");
    await patchRecord("ListEmail", listEmail.id, { subject: `${tag} List Email Draft` });

    const birthdayView = await request("/lightning/o/Contact/list?filterName=BirthdaysThisMonth");
    assert(birthdayView.includes("Birthdays This Month"), "Contact filterName did not select the requested standard list view");
    assert(birthdayView.includes("1 item - Sorted by"), "Birthdays This Month did not filter the visible list to the matching Contact");
  });

  await check("sales invoice validation, creation, numbering, and totals", async () => {
    const missingAccount = await request("/api/invoices", {
      method: "POST",
      body: { issueDate: "2026-07-01", dueDate: "2026-07-31", lineItems: [] },
      expected: [400]
    });
    assert(missingAccount.error?.includes("Account"), "invoice create did not require an Account");

    const invalidQuantity = await request("/api/invoices", {
      method: "POST",
      body: { accountId: account.id, issueDate: "2026-07-01", dueDate: "2026-07-31", lineItems: [{ description: "Invalid quantity", quantity: 0, unitPrice: 10 }] },
      expected: [400]
    });
    assert(invalidQuantity.error?.includes("quantity"), "invoice create accepted a zero quantity");

    const invalidDiscount = await request("/api/invoices", {
      method: "POST",
      body: { accountId: account.id, issueDate: "2026-07-01", dueDate: "2026-07-31", lineItems: [{ description: "Invalid discount", quantity: 1, unitPrice: 10, discountAmount: 11 }] },
      expected: [400]
    });
    assert(invalidDiscount.error?.includes("discount"), "invoice create accepted a discount above the line subtotal");

    const createdInvoice = await request("/api/invoices", {
      method: "POST",
      body: {
        accountId: account.id,
        opportunityId: opportunity.id,
        issueDate: "2026-07-01",
        dueDate: "2026-07-31",
        currency: "USD",
        purchaseOrderNumber: `${tag}-PO`,
        billingName: `${tag} Billing`,
        notes: `${tag} invoice notes`,
        terms: "Net 30",
        lineItems: [
          { productId: product.id, description: `${tag} Product line`, quantity: "2", unitPrice: "49.99", discountAmount: "9.98", taxRate: "10" },
          { description: `${tag} Service line`, quantity: "1.5", unitPrice: "20.00", discountAmount: "0", taxRate: "5" }
        ]
      },
      expected: [201]
    });
    invoice = rememberInvoiceResult(createdInvoice);
    assert(invoice?.invoiceNumber?.startsWith("INV-"), "invoice create did not allocate an invoice number");
    assert(invoice?.status === "Draft", "invoice create did not create a Draft");
    assert(invoice?.lineItems?.length === 2, "invoice create did not persist multiple line items");
    assert(Number(invoice.subtotal) === 129.98, `invoice subtotal was ${invoice.subtotal}, expected 129.98`);
    assert(Number(invoice.discountTotal) === 9.98, `invoice discount total was ${invoice.discountTotal}, expected 9.98`);
    assert(Number(invoice.taxTotal) === 10.5, `invoice tax total was ${invoice.taxTotal}, expected 10.50`);
    assert(Number(invoice.total) === 130.5 && Number(invoice.balanceDue) === 130.5, "invoice final totals were not calculated on the server");

    const concurrentPayload = {
      accountId: account.id,
      issueDate: "2026-07-01",
      dueDate: "2026-07-31",
      currency: "USD",
      lineItems: [{ description: `${tag} Concurrent`, quantity: 1, unitPrice: 1, discountAmount: 0, taxRate: 0 }]
    };
    const [firstConcurrent, secondConcurrent] = await Promise.all([
      request("/api/invoices", { method: "POST", body: concurrentPayload, expected: [201] }),
      request("/api/invoices", { method: "POST", body: concurrentPayload, expected: [201] })
    ]);
    const firstNumber = rememberInvoiceResult(firstConcurrent)?.invoiceNumber;
    const secondNumber = rememberInvoiceResult(secondConcurrent)?.invoiceNumber;
    assert(firstNumber && secondNumber && firstNumber !== secondNumber, "concurrent invoice creates returned colliding numbers");
    const uniqueCount = await prisma.invoice.count({ where: { organizationId, invoiceNumber: { in: [firstNumber, secondNumber] } } });
    assert(uniqueCount === 2, "concurrent invoice numbers were not unique in the database");
  });

  await check("sales invoice draft editing and lifecycle validation", async () => {
    const updated = await request(`/api/invoices/${invoice.id}`, { method: "PATCH", body: { notes: `${tag} edited invoice notes`, terms: "Due on receipt" } });
    rememberInvoiceResult(updated);
    invoice = updated.invoice;
    assert(invoice.notes === `${tag} edited invoice notes` && invoice.lineItems.length === 2, "draft edit did not retain the invoice aggregate");
    assert(Number(invoice.total) === 130.5, "draft edit trusted or changed totals unexpectedly");

    const emptyDraftResult = await request("/api/invoices", { method: "POST", body: { accountId: account.id, issueDate: "2026-07-01", dueDate: "2026-07-31", lineItems: [] }, expected: [201] });
    const emptyDraft = rememberInvoiceResult(emptyDraftResult);
    const rejectedSend = await request(`/api/invoices/${emptyDraft.id}/actions`, { method: "POST", body: { action: "mark-sent" }, expected: [400] });
    assert(rejectedSend.error?.includes("line item"), "invoice without line items could be marked Sent");
    await request(`/api/invoices/${emptyDraft.id}`, { method: "DELETE" });
    created.invoices = created.invoices.filter((id) => id !== emptyDraft.id);

    const draftDetailHtml = await request(`/lightning/r/Invoice/${invoice.id}/view`);
    assert(draftDetailHtml.includes("Mark as Sent"), "Draft invoice detail did not expose Mark as Sent");
    const markedSent = await request(`/api/invoices/${invoice.id}/actions`, { method: "POST", body: { action: "mark-sent" } });
    invoice = rememberInvoiceResult(markedSent);
    assert(invoice.status === "Sent" && invoice.sentAt, "Mark as Sent did not update the lifecycle timestamp");
    await request(`/api/invoices/${invoice.id}`, { method: "PATCH", body: { notes: "Forbidden edit" }, expected: [409] });
    await request(`/api/invoices/${invoice.id}/actions`, { method: "POST", body: { action: "send", recipientEmail: contact.email }, expected: [409] });
  });

  await check("sales invoice partial and final payments", async () => {
    const zeroPayment = await request(`/api/invoices/${invoice.id}/payments`, { method: "POST", body: { amount: 0, paymentDate: "2026-07-10", paymentMethod: "Bank Transfer" }, expected: [400] });
    assert(zeroPayment.error?.includes("greater than zero"), "invoice accepted a zero payment");

    const partial = await request(`/api/invoices/${invoice.id}/payments`, {
      method: "POST",
      body: { amount: "30.00", paymentDate: "2026-07-10", paymentMethod: "Bank Transfer", referenceNumber: `${tag}-PAY-1`, notes: "External transfer" },
      expected: [201]
    });
    rememberInvoiceResult(partial);
    invoice = partial.invoice;
    assert(invoice.status === "Partially Paid", "partial payment did not set Partially Paid status");
    assert(Number(invoice.amountPaid) === 30 && Number(invoice.balanceDue) === 100.5, "partial payment totals were not recalculated");
    assert(invoice.payments.length === 1, "partial payment was not added to payment history");

    const overpayment = await request(`/api/invoices/${invoice.id}/payments`, { method: "POST", body: { amount: "100.51", paymentDate: "2026-07-11", paymentMethod: "Check" }, expected: [400] });
    assert(overpayment.error?.includes("outstanding balance"), "invoice accepted an overpayment");

    const finalPayment = await request(`/api/invoices/${invoice.id}/payments`, {
      method: "POST",
      body: { amount: "100.50", paymentDate: "2026-07-11", paymentMethod: "Check", referenceNumber: `${tag}-PAY-2` },
      expected: [201]
    });
    rememberInvoiceResult(finalPayment);
    invoice = finalPayment.invoice;
    assert(invoice.status === "Paid" && invoice.paidAt, "final payment did not mark the invoice Paid");
    assert(Number(invoice.amountPaid) === 130.5 && Number(invoice.balanceDue) === 0, "final payment totals were not recalculated");
    await request(`/api/invoices/${invoice.id}`, { method: "DELETE", expected: [409] });
    await request(`/api/invoices/${invoice.id}/actions`, { method: "POST", body: { action: "void" }, expected: [409] });
  });

  await check("sales invoice overdue, void, and draft deletion restrictions", async () => {
    const overdueCreated = await request("/api/invoices", {
      method: "POST",
      body: { accountId: account.id, issueDate: "2026-01-01", dueDate: "2026-01-02", lineItems: [{ description: `${tag} Overdue`, quantity: 1, unitPrice: 25, taxRate: 0 }] },
      expected: [201]
    });
    let overdueInvoice = rememberInvoiceResult(overdueCreated);
    rememberInvoiceResult(await request(`/api/invoices/${overdueInvoice.id}/actions`, { method: "POST", body: { action: "mark-sent" } }));
    const overdueRead = await request(`/api/invoices/${overdueInvoice.id}`);
    overdueInvoice = rememberInvoiceResult(overdueRead);
    assert(overdueInvoice.status === "Overdue", "past-due Sent invoice did not display as Overdue");

    const voidCreated = await request("/api/invoices", {
      method: "POST",
      body: { accountId: account.id, issueDate: "2026-07-01", dueDate: "2026-07-31", lineItems: [{ description: `${tag} Void`, quantity: 1, unitPrice: 10, taxRate: 0 }] },
      expected: [201]
    });
    let voidInvoice = rememberInvoiceResult(voidCreated);
    rememberInvoiceResult(await request(`/api/invoices/${voidInvoice.id}/actions`, { method: "POST", body: { action: "mark-sent" } }));
    const voided = await request(`/api/invoices/${voidInvoice.id}/actions`, { method: "POST", body: { action: "void" } });
    rememberInvoiceResult(voided);
    voidInvoice = voided.invoice;
    assert(voidInvoice.status === "Void" && voidInvoice.voidedAt, "void action did not set Void status");
    await request(`/api/invoices/${voidInvoice.id}/payments`, { method: "POST", body: { amount: 1, paymentDate: "2026-07-12", paymentMethod: "Cash" }, expected: [409] });
    await request(`/api/invoices/${voidInvoice.id}`, { method: "DELETE", expected: [409] });

    const deleteCreated = await request("/api/invoices", { method: "POST", body: { accountId: account.id, lineItems: [] }, expected: [201] });
    const deleteDraft = rememberInvoiceResult(deleteCreated);
    await request(`/api/invoices/${deleteDraft.id}`, { method: "DELETE" });
    assert(!(await prisma.invoice.findUnique({ where: { id: deleteDraft.id } })), "Draft invoice deletion did not remove the invoice");
    created.invoices = created.invoices.filter((id) => id !== deleteDraft.id);
  });

  await check("sales invoice list, detail, notifications, and PDF render", async () => {
    const list = await request("/api/invoices");
    assert(list.invoices.some((item) => item.id === invoice.id), "invoice list API omitted the created invoice");
    const listHtml = await request("/lightning/o/Invoice/list");
    for (const fragment of ["Invoices", "New Invoice", "Invoice Number", "Amount Paid", "Balance Due", invoice.invoiceNumber]) {
      assert(listHtml.includes(fragment), `invoice list missing ${fragment}`);
    }
    const detailHtml = await request(`/lightning/r/Invoice/${invoice.id}/view`);
    for (const fragment of [invoice.invoiceNumber, "Invoice Details", "Line Items", "Payment History", "Download PDF", "Record Information"]) {
      assert(detailHtml.includes(fragment), `invoice detail missing ${fragment}`);
    }

    const pdfResponse = await requestRaw(`/api/invoices/${invoice.id}/pdf`);
    const pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer());
    assert(pdfResponse.headers.get("content-type")?.includes("application/pdf"), "invoice PDF endpoint did not return application/pdf");
    assert(pdfResponse.headers.get("content-disposition")?.includes(`${invoice.invoiceNumber}.pdf`), "invoice PDF filename was incorrect");
    assert(new TextDecoder().decode(pdfBytes.slice(0, 5)) === "%PDF-", "invoice PDF response was not a valid PDF document");
    assert(pdfBytes.length > 1000, "invoice PDF response was unexpectedly small");

    const notifications = await prisma.notification.findMany({ where: { organizationId, userId: currentUserId, href: `/lightning/r/Invoice/${invoice.id}/view` } });
    assert(notifications.some((item) => item.title === "Invoice created"), "invoice creation notification was not created");
    assert(notifications.some((item) => item.title === "Invoice sent"), "invoice sent notification was not created");
    assert(notifications.some((item) => item.title === "Invoice payment recorded"), "invoice payment notification was not created");
    assert(notifications.some((item) => item.title === "Invoice paid"), "invoice paid notification was not created");
    notifications.forEach((notification) => remember("notifications", notification));
  });

  await check("record detail routes and customer Knowledge lifecycle", async () => {
    const leadHtml = await request(`/lightning/r/Lead/${lead.id}/view`);
    for (const fragment of [`${tag} Lead`, "Lead Details", "Convert", "Activity"]) assert(leadHtml.includes(fragment), `Lead detail missing ${fragment}`);

    const opportunityHtml = await request(`/lightning/r/Opportunity/${opportunity.id}/view`);
    for (const fragment of [opportunity.name, "Opportunity Details", "Related Invoices", invoice.invoiceNumber, "Activity"]) assert(opportunityHtml.includes(fragment), `Opportunity detail missing ${fragment}`);

    const caseHtml = await request(`/lightning/r/Case/${caseA.id}/view`);
    for (const fragment of [caseA.caseNumber, "Case Details", "Related Records", "Activity"]) assert(caseHtml.includes(fragment), `Case detail missing ${fragment}`);

    const trackedDelivery = remember("emailDeliveries", await prisma.emailDelivery.create({ data: { organizationId, trackingKey: randomUUID(), provider: "sendgrid", providerMessageId: `${tag}-provider`, sourceType: "ListEmail", sourceId: listEmail.id, recipient: contact.email, sender: "verified@example.com", subject: listEmail.subject, status: "Delivered", recordedById: currentUserId, acceptedAt: new Date(), deliveredAt: new Date(), lastEventAt: new Date() } }));
    remember("emailDeliveryEvents", await prisma.emailDeliveryEvent.create({ data: { organizationId, deliveryId: trackedDelivery.id, providerEventId: randomUUID(), providerMessageId: trackedDelivery.providerMessageId, eventType: "delivered", occurredAt: new Date(), raw: { event: "delivered", email: contact.email } } }));
    const deliveryApi = await request(`/api/email/deliveries?sourceType=ListEmail&sourceId=${listEmail.id}`);
    assert(deliveryApi.deliveries?.length === 1 && deliveryApi.deliveries[0].events?.length === 1, "tenant-scoped email delivery API omitted tracking history");
    const listEmailHtml = await request(`/lightning/r/ListEmail/${listEmail.id}/view`);
    for (const fragment of [`${tag} List Email Draft`, "List Email", "Message", "Delivery Details", "Recipients (2)", "Provider Delivery Tracking (1)", "Delivered", contact.email]) assert(listEmailHtml.includes(fragment), `List Email detail missing ${fragment}`);
    const bootstrap = await request("/api/bootstrap");
    if (!bootstrap.emailDeliveryConfigured) assert(listEmailHtml.includes("Email delivery is disabled"), "List Email detail did not disclose the provider limitation");

    knowledge = await patchRecord("Knowledge__kav", knowledge.id, { visibleToCustomer: true, bodyRichText: `<p>${tag} public knowledge body</p>` });
    const published = await request(`/api/knowledge/${knowledge.id}/actions`, { method: "POST", body: { action: "publish" } });
    knowledge = published.article;
    published.notifications?.forEach((notification) => remember("notifications", notification));
    assert(knowledge.publicationStatus === "Published" && knowledge.publishedAt, "dedicated Knowledge publish action did not persist lifecycle timestamps");

    const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { slug: true } });
    assert(organization?.slug, "active organization has no public slug");
    const publicPath = `/knowledge/${encodeURIComponent(organization.slug)}/${encodeURIComponent(knowledge.urlName)}`;
    const publicHtml = await requestAnonymous(publicPath);
    for (const fragment of [knowledge.title, "Help Center", `${tag} public knowledge body`, "Was this article helpful?"]) assert(publicHtml.includes(fragment), `public Knowledge article missing ${fragment}`);

    const feedbackResult = await requestAnonymous(`/api/knowledge/public/${encodeURIComponent(organization.slug)}/${encodeURIComponent(knowledge.urlName)}/feedback`, { method: "POST", body: { helpful: true, comment: `${tag} helpful article` } });
    assert(feedbackResult.ok, "anonymous Knowledge feedback was not accepted");
    const feedback = await prisma.knowledgeFeedback.findFirst({ where: { organizationId, articleId: knowledge.id, comment: `${tag} helpful article` } });
    assert(feedback, "anonymous Knowledge feedback was not persisted");
    remember("knowledgeFeedback", feedback);

    const internalKnowledge = await request(`/api/knowledge/${knowledge.id}`);
    assert(internalKnowledge.article.totalViewCount >= 1, "public Knowledge view was not counted");
    assert(internalKnowledge.metrics.helpful >= 1 && internalKnowledge.metrics.total >= 1, "internal Knowledge metrics omitted public feedback");
    const knowledgeHtml = await request(`/lightning/r/Knowledge__kav/${knowledge.id}/view`);
    for (const fragment of [knowledge.title, "Article Content", "Customer Feedback", "Open customer article"]) assert(knowledgeHtml.includes(fragment), `Knowledge detail missing ${fragment}`);

    const archived = await request(`/api/knowledge/${knowledge.id}/actions`, { method: "POST", body: { action: "archive" } });
    archived.notifications?.forEach((notification) => remember("notifications", notification));
    assert(archived.article.publicationStatus === "Archived" && archived.article.archivedAt, "Knowledge archive action did not persist lifecycle state");
    await requestAnonymous(publicPath, { expected: [404] });
    const restored = await request(`/api/knowledge/${knowledge.id}/actions`, { method: "POST", body: { action: "restore" } });
    restored.notifications?.forEach((notification) => remember("notifications", notification));
    knowledge = restored.article;
    assert(knowledge.publicationStatus === "Draft" && !knowledge.archivedAt, "Knowledge restore action did not return the article to Draft");
    await request(`/api/knowledge/${knowledge.id}/actions`, { method: "POST", body: { action: "restore" }, expected: [409] });
  });

  await check("activity and file workflows", async () => {
    const invalidActivity = await request("/api/activity", { method: "POST", body: { type: "pretend", relatedObjectType: "Contact", relatedRecordId: contact.id }, expected: [400] });
    assert(invalidActivity.error?.includes("activity type"), "unknown activity type was silently stored as a Task");
    const email = await request("/api/activity", {
      method: "POST",
      body: { type: "email", emailAction: "log", to: contact.email, subject: `${tag} Email`, body: "Email body", relatedObjectType: "Contact", relatedRecordId: contact.id },
      expected: [201]
    });
    remember("emailActivities", email.record);

    const call = await request("/api/activity", {
      method: "POST",
      body: { type: "call", subject: `${tag} Call`, comments: "Connected", relatedObjectType: "Contact", relatedRecordId: contact.id },
      expected: [201]
    });
    remember("callActivities", call.record);

    const task = await request("/api/activity", {
      method: "POST",
      body: { type: "task", subject: `${tag} Task`, dueDate: "2026-08-21", status: "Not Started", priority: "Normal", relatedObjectType: "Contact", relatedRecordId: contact.id },
      expected: [201]
    });
    remember("tasks", task.record);

    const fileForm = new FormData();
    const fileBytes = new TextEncoder().encode(`%PDF-1.7\n${tag} durable CRM file`);
    fileForm.set("file", new Blob([fileBytes], { type: "application/pdf" }), `${tag}.pdf`);
    fileForm.set("relatedObjectType", "Contact");
    fileForm.set("relatedRecordId", contact.id);
    const file = await requestForm("/api/files", fileForm, { expected: [201] });
    remember("files", file.record);

    const attachmentForm = new FormData();
    attachmentForm.set("file", new Blob([`Attachment content ${tag}`], { type: "text/plain" }), `${tag}-attachment.txt`);
    attachmentForm.set("relatedObjectType", "Contact");
    attachmentForm.set("relatedRecordId", contact.id);
    attachmentForm.set("attachment", "true");
    const attachment = await requestForm("/api/files", attachmentForm, { expected: [201] });
    remember("attachments", attachment.record);

    assert(file.record.checksum?.length === 64, "file upload did not return a SHA-256 checksum");
    const downloaded = await requestRaw(`/api/files/${file.record.id}?kind=file`);
    const downloadedBytes = new Uint8Array(await downloaded.arrayBuffer());
    assert(downloaded.headers.get("content-type") === "application/pdf", "file download did not preserve content type");
    assert(downloaded.headers.get("content-disposition")?.startsWith("attachment"), "file download did not use attachment disposition");
    assert(Buffer.from(downloadedBytes).equals(Buffer.from(fileBytes)), "file download bytes did not match the upload");
    const preview = await requestRaw(`/api/files/${file.record.id}?kind=file&disposition=inline`);
    assert(preview.headers.get("content-disposition")?.startsWith("inline"), "safe PDF preview was not rendered inline");

    const rejectedMetadataUpload = await request("/api/files", { method: "POST", body: { name: `${tag}-fake.txt`, size: 10 }, expected: [415] });
    assert(rejectedMetadataUpload.error?.includes("multipart"), "metadata-only upload was not rejected");

    const data = await request("/api/bootstrap");
    assert(data.emailActivities.some((item) => item.id === email.record.id), "email activity missing from bootstrap");
    assert(data.callActivities.some((item) => item.id === call.record.id), "call activity missing from bootstrap");
    assert(data.tasks.some((item) => item.id === task.record.id), "task missing from bootstrap");
    assert(data.files.some((item) => item.id === file.record.id), "file missing from bootstrap");
    assert(data.attachments.some((item) => item.id === attachment.record.id), "attachment missing from bootstrap");
    assert(!data.files.find((item) => item.id === file.record.id)?.content, "bootstrap exposed stored file bytes");
  });

  await check("messaging session CRUD, transcript, lifecycle, isolation, and UI", async () => {
    const createdSession = await request("/api/messaging-sessions", {
      method: "POST",
      body: {
        name: `${tag} Support Conversation`,
        subject: "Implementation follow-up",
        channel: "Email",
        ownerId: currentUserId,
        accountId: account.id,
        contactId: contact.id,
        participants: [{ contactId: contact.id, role: "Customer" }]
      },
      expected: [201]
    });
    const session = remember("messagingSessions", createdSession.session);
    createdSession.session.participants?.forEach((participant) => remember("messagingSessions", { id: session.id }) || participant);
    createdSession.notifications?.forEach((notification) => remember("notifications", notification));
    assert(session.status === "Open" && session.participants.length === 1, "messaging session did not create its participant aggregate");

    const updated = await request(`/api/messaging-sessions/${session.id}`, { method: "PATCH", body: { subject: "Updated implementation follow-up", ownerId: currentUserId } });
    assert(updated.session.subject === "Updated implementation follow-up", "messaging session edit did not persist");
    const inbound = await request(`/api/messaging-sessions/${session.id}/messages`, { method: "POST", body: { direction: "Inbound", senderName: "Customer", body: `${tag} inbound transcript entry`, sentAt: "2026-08-01T09:00:00.000Z" }, expected: [201] });
    remember("messagingMessages", inbound.message);
    inbound.notifications?.forEach((notification) => remember("notifications", notification));
    assert(inbound.message.status === "Received", "inbound message did not receive the correct truthful status");
    const outbound = await request(`/api/messaging-sessions/${session.id}/messages`, { method: "POST", body: { direction: "Outbound", senderName: "Agent", body: `${tag} externally sent reply`, deliver: false }, expected: [201] });
    remember("messagingMessages", outbound.message);
    assert(outbound.message.status === "Recorded" && !outbound.delivery, "record-only outbound message claimed provider delivery");

    await request(`/api/messaging-sessions/${session.id}/actions`, { method: "POST", body: { action: "wait" } });
    await request(`/api/messaging-sessions/${session.id}/actions`, { method: "POST", body: { action: "resume" } });
    const closed = await request(`/api/messaging-sessions/${session.id}/actions`, { method: "POST", body: { action: "close" } });
    closed.notifications?.forEach((notification) => remember("notifications", notification));
    assert(closed.session.status === "Closed" && closed.session.endedAt, "closing a messaging session did not set lifecycle fields");
    await request(`/api/messaging-sessions/${session.id}/messages`, { method: "POST", body: { direction: "Inbound", body: "Must fail" }, expected: [409] });
    await request(`/api/messaging-sessions/${session.id}`, { method: "DELETE", expected: [409] });
    const reopened = await request(`/api/messaging-sessions/${session.id}/actions`, { method: "POST", body: { action: "reopen" } });
    assert(reopened.session.status === "Open" && reopened.session.endedAt === null, "reopen did not restore an Open session");

    const detail = await request(`/api/messaging-sessions/${session.id}`);
    assert(detail.session.messages.length === 2, "messaging detail omitted transcript history");
    const list = await request("/api/messaging-sessions");
    assert(list.sessions.some((item) => item.id === session.id), "messaging list omitted created session");
    const listHtml = await request("/lightning/o/MessagingSession/list");
    for (const fragment of ["Messaging Sessions", "New", "Channel", "Last Message", session.name]) assert(listHtml.includes(fragment), `messaging list missing ${fragment}`);
    const detailHtml = await request(`/lightning/r/MessagingSession/${session.id}/view`);
    for (const fragment of [session.name, "Session Details", "Participants", "Conversation", "Record Message"]) assert(detailHtml.includes(fragment), `messaging detail missing ${fragment}`);

    const disposable = await request("/api/messaging-sessions", { method: "POST", body: { name: `${tag} Empty Session`, channel: "Web Chat", ownerId: currentUserId }, expected: [201] });
    remember("messagingSessions", disposable.session);
    disposable.notifications?.forEach((notification) => remember("notifications", notification));
    await request(`/api/messaging-sessions/${disposable.session.id}`, { method: "DELETE" });
    created.messagingSessions = created.messagingSessions.filter((id) => id !== disposable.session.id);
  });

  await check("video call CRUD, attendance, lifecycle, provider links, and UI", async () => {
    const invalidDates = await request("/api/video-calls", { method: "POST", body: { name: `${tag} Invalid Call`, scheduledStartAt: "2026-08-01T11:00:00.000Z", scheduledEndAt: "2026-08-01T10:00:00.000Z" }, expected: [400] });
    assert(invalidDates.error?.includes("after"), "video call did not validate its date range");
    const createdCall = await request("/api/video-calls", {
      method: "POST",
      body: {
        name: `${tag} Customer Review`, provider: "Google Meet", meetingUrl: "https://meet.google.com/example-room",
        scheduledStartAt: "2026-08-01T10:00:00.000Z", scheduledEndAt: "2026-08-01T11:00:00.000Z",
        accountId: account.id, contactId: contact.id, opportunityId: opportunity.id, organizerId: currentUserId,
        participants: [{ contactId: contact.id, role: "Attendee" }], notifyParticipants: false
      },
      expected: [201]
    });
    const videoCall = remember("videoCalls", createdCall.videoCall);
    createdCall.videoCall.participants?.forEach((participant) => remember("videoCallParticipants", participant));
    createdCall.notifications?.forEach((notification) => remember("notifications", notification));
    assert(videoCall.status === "Scheduled" && videoCall.meetingUrl.startsWith("https://"), "video call did not preserve its real provider link");
    const participant = videoCall.participants[0];
    const attendance = await request(`/api/video-calls/${videoCall.id}/actions`, { method: "POST", body: { action: "attendance", participantId: participant.id, attendance: "Accepted" } });
    assert(attendance.videoCall.participants[0].attendance === "Accepted", "video-call attendance did not update");
    const updated = await request(`/api/video-calls/${videoCall.id}`, { method: "PATCH", body: { notes: `${tag} agenda ready`, organizerId: currentUserId } });
    assert(updated.videoCall.notes === `${tag} agenda ready`, "video-call edit did not persist");
    const started = await request(`/api/video-calls/${videoCall.id}/actions`, { method: "POST", body: { action: "start" } });
    assert(started.videoCall.status === "In Progress" && started.videoCall.startedAt, "video-call start transition failed");
    const completed = await request(`/api/video-calls/${videoCall.id}/actions`, { method: "POST", body: { action: "complete" } });
    completed.notifications?.forEach((notification) => remember("notifications", notification));
    assert(completed.videoCall.status === "Completed" && completed.videoCall.endedAt, "video-call completion transition failed");
    const terminalNotes = await request(`/api/video-calls/${videoCall.id}`, { method: "PATCH", body: { notes: `${tag} completed notes`, recordingUrl: "https://example.com/recording" } });
    assert(terminalNotes.videoCall.notes === `${tag} completed notes`, "completed video-call notes could not be updated");
    await request(`/api/video-calls/${videoCall.id}`, { method: "PATCH", body: { name: "Forbidden terminal edit" }, expected: [409] });
    await request(`/api/video-calls/${videoCall.id}`, { method: "DELETE", expected: [409] });

    const list = await request("/api/video-calls");
    assert(list.videoCalls.some((item) => item.id === videoCall.id), "video-call list omitted created call");
    const listHtml = await request("/lightning/o/VideoCall/list");
    for (const fragment of ["Video Calls", "New", "Scheduled Start", "Organizer", videoCall.name]) assert(listHtml.includes(fragment), `video-call list missing ${fragment}`);
    const detailHtml = await request(`/lightning/r/VideoCall/${videoCall.id}/view`);
    for (const fragment of [videoCall.name, "Schedule", "Related Records", "Participants", "Description &amp; Notes"]) assert(detailHtml.includes(fragment), `video-call detail missing ${fragment}`);

    const disposable = await request("/api/video-calls", { method: "POST", body: { name: `${tag} Disposable Call`, scheduledStartAt: "2026-08-02T10:00:00.000Z", scheduledEndAt: "2026-08-02T11:00:00.000Z", organizerId: currentUserId }, expected: [201] });
    remember("videoCalls", disposable.videoCall);
    disposable.notifications?.forEach((notification) => remember("notifications", notification));
    await request(`/api/video-calls/${disposable.videoCall.id}`, { method: "DELETE" });
    created.videoCalls = created.videoCalls.filter((id) => id !== disposable.videoCall.id);
  });

  await check("campaign CRUD, members, hierarchy, lifecycle, metrics, and UI", async () => {
    const missingName = await request("/api/campaigns", { method: "POST", body: {}, expected: [400] });
    assert(missingName.error?.includes("name"), "campaign creation did not require a name");
    const invalidDates = await request("/api/campaigns", {
      method: "POST",
      body: { name: `${tag} Invalid Campaign`, startDate: "2026-09-02", endDate: "2026-09-01" },
      expected: [400]
    });
    assert(invalidDates.error?.includes("precede"), "campaign creation accepted an invalid date range");

    const createdCampaign = await request("/api/campaigns", {
      method: "POST",
      body: {
        name: `${tag} Lifecycle Campaign`,
        type: "Webinar",
        ownerId: currentUserId,
        startDate: "2026-09-01",
        endDate: "2026-09-30",
        budgetedCost: "1000.50",
        expectedRevenue: "5000",
        description: `${tag} campaign description`
      },
      expected: [201]
    });
    let campaign = remember("campaigns", createdCampaign.campaign);
    createdCampaign.notifications?.forEach((notification) => remember("notifications", notification));
    assert(campaign.status === "Planned" && campaign.type === "Webinar", "campaign did not start as Planned with its selected type");
    assert(Number(campaign.budgetedCost) === 1000.5, "campaign budget was not persisted as a decimal");

    await request("/api/campaigns", { method: "POST", body: { name: campaign.name }, expected: [409] });
    const selfParent = await request(`/api/campaigns/${campaign.id}`, { method: "PATCH", body: { parentCampaignId: campaign.id }, expected: [400] });
    assert(selfParent.error?.includes("own parent"), "campaign hierarchy accepted a direct cycle");

    const updated = await request(`/api/campaigns/${campaign.id}`, {
      method: "PATCH",
      body: { actualCost: "125.25", description: `${tag} updated campaign` }
    });
    campaign = updated.campaign;
    assert(Number(campaign.actualCost) === 125.25 && campaign.description.includes("updated"), "campaign edit did not persist");

    const added = await request(`/api/campaigns/${campaign.id}/members`, {
      method: "POST",
      body: { objectType: "Contact", recordIds: [contact.id], status: "Sent" }
    });
    campaign = added.campaign;
    added.notifications?.forEach((notification) => remember("notifications", notification));
    assert(campaign.members.length === 1 && campaign.metrics.memberCount === 1, "campaign member was not added or counted");
    const member = campaign.members[0];
    const responded = await request(`/api/campaigns/${campaign.id}/members/${member.id}`, {
      method: "PATCH",
      body: { status: "Responded", notes: `${tag} response` }
    });
    campaign = responded.campaign;
    assert(campaign.members[0].responded === true && campaign.metrics.responseRate === 100, "campaign response metrics were not recalculated");
    await request(`/api/campaigns/${campaign.id}`, { method: "DELETE", expected: [409] });

    const activated = await request(`/api/campaigns/${campaign.id}/actions`, { method: "POST", body: { action: "activate" } });
    campaign = activated.campaign;
    activated.notifications?.forEach((notification) => remember("notifications", notification));
    assert(campaign.status === "In Progress" && campaign.activatedAt, "campaign activation did not set lifecycle state");
    await request(`/api/campaigns/${campaign.id}/actions`, { method: "POST", body: { action: "activate" }, expected: [409] });
    const completed = await request(`/api/campaigns/${campaign.id}/actions`, { method: "POST", body: { action: "complete" } });
    campaign = completed.campaign;
    completed.notifications?.forEach((notification) => remember("notifications", notification));
    assert(campaign.status === "Completed" && campaign.completedAt, "campaign completion did not set lifecycle state");
    const archived = await request(`/api/campaigns/${campaign.id}/actions`, { method: "POST", body: { action: "archive" } });
    campaign = archived.campaign;
    archived.notifications?.forEach((notification) => remember("notifications", notification));
    assert(campaign.status === "Archived" && campaign.archivedAt, "campaign archive did not set lifecycle state");
    await request(`/api/campaigns/${campaign.id}`, { method: "PATCH", body: { description: "Forbidden" }, expected: [409] });
    await request(`/api/campaigns/${campaign.id}/members/${member.id}`, { method: "DELETE", expected: [409] });

    const list = await request("/api/campaigns");
    assert(list.campaigns.some((item) => item.id === campaign.id), "campaign list API omitted the created campaign");
    const detail = await request(`/api/campaigns/${campaign.id}`);
    assert(detail.campaign.members[0].name, "campaign detail did not hydrate its polymorphic member");
    const listHtml = await request("/lightning/o/Campaign/list");
    for (const fragment of ["Campaigns", "New", "Campaign Name", "Response Rate", campaign.name]) assert(listHtml.includes(fragment), `campaign list missing ${fragment}`);
    const detailHtml = await request(`/lightning/r/Campaign/${campaign.id}/view`);
    for (const fragment of [campaign.name, "Campaign Details", "Campaign Members", "Response Rate", contact.lastName]) assert(detailHtml.includes(fragment), `campaign detail missing ${fragment}`);

    const disposable = await request("/api/campaigns", { method: "POST", body: { name: `${tag} Disposable Campaign` }, expected: [201] });
    remember("campaigns", disposable.campaign);
    disposable.notifications?.forEach((notification) => remember("notifications", notification));
    await request(`/api/campaigns/${disposable.campaign.id}`, { method: "DELETE" });
    created.campaigns = created.campaigns.filter((id) => id !== disposable.campaign.id);
  });

  await check("commerce catalog, stores, promotions, orders, inventory, fulfillment, and UI", async () => {
    const catalogProduct = await postRecord("Product2", {
      name: `${tag} Catalog Product`,
      productCode: `${tag}-catalog`,
      sku: `${tag}-catalog-sku`,
      active: true,
      description: `${tag} catalog item`,
      createPriceBookEntry: false
    }, "products");
    const entryCreated = await request(`/api/price-books/${priceBook.id}/entries`, {
      method: "POST",
      body: { productId: catalogProduct.id, listPrice: "20.00", currency: "USD", active: true },
      expected: [201]
    });
    remember("priceBookEntries", entryCreated.entry);
    assert(Number(entryCreated.entry.listPrice) === 20, "Price Book entry did not preserve its Decimal price");
    const entryUpdated = await request(`/api/price-books/${priceBook.id}/entries/${entryCreated.entry.id}`, { method: "PATCH", body: { listPrice: "22.50", active: true } });
    assert(Number(entryUpdated.entry.listPrice) === 22.5, "Price Book entry update did not persist");
    await request(`/api/price-books/${priceBook.id}/entries`, { method: "POST", body: { productId: catalogProduct.id, listPrice: 20, currency: "USD" }, expected: [409] });
    await request(`/api/price-books/${priceBook.id}/entries/${entryCreated.entry.id}`, { method: "DELETE" });
    created.priceBookEntries = created.priceBookEntries.filter((id) => id !== entryCreated.entry.id);

    const storeCreated = await request("/api/commerce/stores", {
      method: "POST",
      body: { name: `${tag} Commerce Store`, slug: `${tag}-commerce`, currency: "USD", priceBookId: priceBook.id, description: `${tag} store` },
      expected: [201]
    });
    let store = remember("stores", storeCreated.store);
    storeCreated.notifications?.forEach((notification) => remember("notifications", notification));
    assert(store.status === "Draft" && store.priceBookId === priceBook.id, "commerce store was not created as a Draft with its Price Book");
    const storeUpdated = await request(`/api/commerce/stores/${store.id}`, { method: "PATCH", body: { description: `${tag} updated store` } });
    store = storeUpdated.store;
    assert(store.description.includes("updated"), "store edit did not persist");
    const activated = await request(`/api/commerce/stores/${store.id}/actions`, { method: "POST", body: { action: "activate" } });
    store = activated.store;
    activated.notifications?.forEach((notification) => remember("notifications", notification));
    assert(store.status === "Active" && store.launchedAt, "store activation did not set lifecycle fields");

    const inventoryResult = await request(`/api/commerce/stores/${store.id}/inventory`, {
      method: "POST",
      body: { productId: product.id, quantityOnHand: "10.000", reorderPoint: "2.000" }
    });
    remember("inventoryItems", inventoryResult.inventoryItem);
    assert(Number(inventoryResult.inventoryItem.quantityOnHand) === 10, "inventory quantity was not stored");
    const negativeInventory = await request(`/api/commerce/stores/${store.id}/inventory`, { method: "POST", body: { productId: product.id, quantityOnHand: -1, reorderPoint: 0 }, expected: [400] });
    assert(negativeInventory.error?.includes("negative"), "inventory accepted a negative quantity");

    const promotionResult = await request(`/api/commerce/stores/${store.id}/promotions`, {
      method: "POST",
      body: { name: `${tag} Ten Percent`, code: `${tag}-SAVE10`, type: "Percentage", value: "10", minimumOrderAmount: "50", maxRedemptions: 5, active: true },
      expected: [201]
    });
    const promotion = remember("commercePromotions", promotionResult.promotion);
    await request(`/api/commerce/stores/${store.id}/promotions`, { method: "POST", body: { name: "Duplicate", code: promotion.code, type: "Percentage", value: 10 }, expected: [409] });

    const invalidLine = await request("/api/commerce/orders", {
      method: "POST",
      body: { storeId: store.id, accountId: account.id, lineItems: [{ productId: product.id, quantity: 0, unitPrice: 10 }] },
      expected: [400]
    });
    assert(invalidLine.error?.includes("quantity"), "commerce order accepted a zero quantity");

    const orderCreated = await request("/api/commerce/orders", {
      method: "POST",
      body: {
        storeId: store.id,
        accountId: account.id,
        contactId: contact.id,
        purchaseOrderNumber: `${tag}-ORDER-PO`,
        promotionCode: promotion.code,
        shippingTotal: "7.00",
        total: "1.00",
        notes: `${tag} commerce order`,
        lineItems: [{ productId: product.id, description: `${tag} ordered product`, quantity: "2", unitPrice: "49.99", discountAmount: "5.00", taxRate: "10" }]
      },
      expected: [201]
    });
    let order = remember("commerceOrders", orderCreated.order);
    order.lines?.forEach((line) => remember("commerceOrderLines", line));
    orderCreated.notifications?.forEach((notification) => remember("notifications", notification));
    assert(order.orderNumber.startsWith("ORD-") && order.status === "Draft", "order creation did not allocate a Draft order number");
    assert(Number(order.subtotal) === 99.98, `order subtotal was ${order.subtotal}`);
    assert(Number(order.discountTotal) === 14.5 && Number(order.taxTotal) === 9.5 && Number(order.total) === 101.98, `server order totals were incorrect: ${order.total}`);

    const concurrentPayload = { storeId: store.id, accountId: account.id, lineItems: [] };
    const [concurrentA, concurrentB] = await Promise.all([
      request("/api/commerce/orders", { method: "POST", body: concurrentPayload, expected: [201] }),
      request("/api/commerce/orders", { method: "POST", body: concurrentPayload, expected: [201] })
    ]);
    remember("commerceOrders", concurrentA.order); remember("commerceOrders", concurrentB.order);
    assert(concurrentA.order.orderNumber !== concurrentB.order.orderNumber, "concurrent orders received colliding numbers");
    await request(`/api/commerce/orders/${concurrentA.order.id}`, { method: "DELETE" });
    await request(`/api/commerce/orders/${concurrentB.order.id}`, { method: "DELETE" });
    created.commerceOrders = created.commerceOrders.filter((id) => ![concurrentA.order.id, concurrentB.order.id].includes(id));

    const confirmed = await request(`/api/commerce/orders/${order.id}/actions`, { method: "POST", body: { action: "confirm" } });
    order = confirmed.order;
    confirmed.notifications?.forEach((notification) => remember("notifications", notification));
    assert(order.status === "Confirmed" && order.confirmedAt, "order confirmation did not set lifecycle state");
    let inventory = await prisma.inventoryItem.findUnique({ where: { organizationId_storeId_productId: { organizationId, storeId: store.id, productId: product.id } } });
    assert(Number(inventory?.quantityReserved) === 2, "order confirmation did not reserve inventory");
    await request(`/api/commerce/orders/${order.id}`, { method: "PATCH", body: { notes: "Forbidden" }, expected: [409] });
    await request(`/api/commerce/orders/${order.id}`, { method: "DELETE", expected: [409] });
    await request(`/api/commerce/orders/${order.id}/actions`, { method: "POST", body: { action: "fulfill", lines: [{ orderLineId: order.lines[0].id, quantity: 3 }] }, expected: [400] });

    const partial = await request(`/api/commerce/orders/${order.id}/actions`, { method: "POST", body: { action: "fulfill", status: "Shipped", carrier: "External Carrier", trackingNumber: `${tag}-TRACK-1`, lines: [{ orderLineId: order.lines[0].id, quantity: 1 }] } });
    order = partial.order;
    remember("commerceFulfillments", partial.fulfillment);
    partial.fulfillment.lines?.forEach((line) => remember("commerceFulfillmentLines", line));
    partial.notifications?.forEach((notification) => remember("notifications", notification));
    assert(order.status === "Confirmed" && order.fulfillmentStatus === "Partially Fulfilled", "partial fulfillment status was incorrect");
    inventory = await prisma.inventoryItem.findUnique({ where: { organizationId_storeId_productId: { organizationId, storeId: store.id, productId: product.id } } });
    assert(Number(inventory?.quantityOnHand) === 9 && Number(inventory?.quantityReserved) === 1, "partial fulfillment did not update inventory");

    const finalFulfillment = await request(`/api/commerce/orders/${order.id}/actions`, { method: "POST", body: { action: "fulfill", status: "Shipped", carrier: "External Carrier", trackingNumber: `${tag}-TRACK-2` } });
    order = finalFulfillment.order;
    remember("commerceFulfillments", finalFulfillment.fulfillment);
    finalFulfillment.fulfillment.lines?.forEach((line) => remember("commerceFulfillmentLines", line));
    finalFulfillment.notifications?.forEach((notification) => remember("notifications", notification));
    assert(order.status === "Fulfilled" && order.fulfillmentStatus === "Fulfilled" && order.fulfilledAt, "final fulfillment did not complete the order");
    inventory = await prisma.inventoryItem.findUnique({ where: { organizationId_storeId_productId: { organizationId, storeId: store.id, productId: product.id } } });
    assert(Number(inventory?.quantityOnHand) === 8 && Number(inventory?.quantityReserved) === 0, "final fulfillment did not consume and release inventory");
    const delivered = await request(`/api/commerce/orders/${order.id}/actions`, { method: "POST", body: { action: "deliver", fulfillmentId: finalFulfillment.fulfillment.id } });
    order = delivered.order;
    delivered.notifications?.forEach((notification) => remember("notifications", notification));
    assert(order.fulfillments.some((item) => item.id === finalFulfillment.fulfillment.id && item.status === "Delivered"), "fulfillment delivery state did not persist");
    await request(`/api/commerce/orders/${order.id}/actions`, { method: "POST", body: { action: "cancel" }, expected: [409] });
    await request(`/api/commerce/stores/${store.id}/promotions/${promotion.id}`, { method: "DELETE", expected: [409] });
    await request(`/api/records/Product2/${product.id}`, { method: "DELETE", expected: [409] });
    await request(`/api/records/Pricebook2/${priceBook.id}`, { method: "DELETE", expected: [409] });

    const orderList = await request("/api/commerce/orders");
    assert(orderList.orders.some((item) => item.id === order.id), "commerce order list omitted the created order");
    const commerceHtml = await request("/lightning/app/commerce");
    for (const fragment of ["Sales Commerce Workspace", "New Store", "New Order", "Open Orders", "Active Promotions", order.orderNumber]) assert(commerceHtml.includes(fragment), `commerce workspace missing ${fragment}`);
    const productHtml = await request(`/lightning/r/Product2/${product.id}/view`);
    for (const fragment of [product.name, "Product Details", "Price Book Entries", "Inventory", "Order Usage"]) assert(productHtml.includes(fragment), `Product detail missing ${fragment}`);
    const priceBookHtml = await request(`/lightning/r/Pricebook2/${priceBook.id}/view`);
    for (const fragment of [priceBook.name, "Price Book Details", "Add Product", "Connected Stores"]) assert(priceBookHtml.includes(fragment), `Price Book detail missing ${fragment}`);
  });

  await check("bulk list and sales workflows", async () => {
    const labelResult = await workflow("Assign Label", "Contact", [contact.id], { label: `${tag} Label`, color: "blue" });
    labelResult.labels?.forEach((label) => remember("labels", label));
    assert(labelResult.labels?.length === 1, "Assign Label did not return one label");

    const campaignResult = await workflow("Add to Campaign", "Contact", [contact.id], { campaign: `${tag} Campaign`, status: "Sent" });
    remember("campaigns", campaignResult.campaign);
    assert(campaignResult.campaignMembers?.length === 1, "Add to Campaign did not return one member");

    const ownerResult = await workflow("Change Owner", "Lead", [lead.id], { ownerId: currentUserId });
    assert(ownerResult.records?.[0]?.ownerId === currentUserId, "Change Owner did not update lead owner");

    const productCategoryResult = await workflow("Add to Category", "Product2", [product.id], { category: `${tag} Category` });
    assert(productCategoryResult.records?.[0]?.category === `${tag} Category`, "Add to Category did not return categorized product");
    const categorizedProduct = await prisma.product.findUnique({ where: { id: product.id } });
    assert(categorizedProduct?.category === `${tag} Category`, "Add to Category did not persist product category");

    const convertLead = await postRecord("Lead", {
      status: "New",
      firstName: "Convert",
      lastName: `${tag} Convert`,
      company: `${tag} Convert Co`,
      email: `convert-${tag}@example.com`
    }, "leads");
    const conversion = await workflow("Convert Lead", "Lead", [convertLead.id], {
      accountName: `${tag} Converted Account`,
      opportunityName: `${tag} Converted Opportunity`,
      createOpportunity: true,
      convertedStatus: "Qualified",
      closeDate: "2026-09-01",
      stage: "Qualify",
      forecastCategory: "Pipeline"
    });
    conversion.accounts?.forEach((record) => remember("accounts", record));
    conversion.contacts?.forEach((record) => remember("contacts", record));
    conversion.opportunities?.forEach((record) => remember("opportunities", record));
    assert(conversion.accounts?.length === 1, "Convert Lead did not create/reuse an account");
    assert(conversion.contacts?.length === 1, "Convert Lead did not create a contact");
    assert(conversion.opportunities?.length === 1, "Convert Lead did not create an opportunity");
    const persistedConversion = await prisma.lead.findUnique({ where: { id: convertLead.id } });
    assert(persistedConversion?.convertedAt, "Convert Lead did not persist its conversion timestamp");
    assert(persistedConversion?.convertedAccountId === conversion.accounts[0].id, "Convert Lead did not persist the converted Account link");
    assert(persistedConversion?.convertedContactId === conversion.contacts[0].id, "Convert Lead did not persist the converted Contact link");
    assert(persistedConversion?.convertedOpportunityId === conversion.opportunities[0].id, "Convert Lead did not persist the converted Opportunity link");
    await request("/api/workflows", {
      method: "POST",
      body: { action: "Convert Lead", object: "Lead", selectedIds: [convertLead.id], values: {} },
      expected: [409]
    });
    await request(`/api/records/Lead/${convertLead.id}`, { method: "PATCH", body: { status: "New" }, expected: [409] });
    await request(`/api/records/Lead/${convertLead.id}`, { method: "DELETE", expected: [409] });
    const convertedLeadHtml = await request(`/lightning/r/Lead/${convertLead.id}/view`);
    for (const fragment of ["Conversion Date", "Converted Leads are read-only", conversion.accounts[0].name, conversion.opportunities[0].name]) {
      assert(convertedLeadHtml.includes(fragment), `converted Lead detail missing ${fragment}`);
    }

    const mergeTask = remember("tasks", await prisma.task.create({
      data: {
        organizationId,
        subject: `${tag} Secondary Case Task`,
        status: "Not Started",
        priority: "Normal",
        ownerId: currentUserId,
        relatedObjectType: "Case",
        relatedRecordId: caseB.id
      }
    }));

    const mergeResult = await workflow("Merge Cases", "Case", [caseA.id, caseB.id], { primaryCase: caseA.id });
    assert(mergeResult.ok, "Merge Cases did not complete");
    const closedCase = await prisma.caseRecord.findUnique({ where: { id: caseB.id } });
    assert(closedCase?.status === "Closed", "Merge Cases did not close the secondary case");
    const movedTask = await prisma.task.findUnique({ where: { id: mergeTask.id } });
    assert(movedTask?.relatedRecordId === caseA.id, "Merge Cases did not preserve and re-parent related activity");
  });

  await check("knowledge lifecycle workflows", async () => {
    const [concurrentArticleA, concurrentArticleB] = await Promise.all([
      request("/api/records/Knowledge__kav", { method: "POST", body: { title: `${tag} Concurrent Knowledge A`, urlName: `${tag}-concurrent-knowledge-a`, bodyRichText: "<p>A</p>" }, expected: [201] }),
      request("/api/records/Knowledge__kav", { method: "POST", body: { title: `${tag} Concurrent Knowledge B`, urlName: `${tag}-concurrent-knowledge-b`, bodyRichText: "<p>B</p>" }, expected: [201] })
    ]);
    remember("knowledgeArticles", concurrentArticleA.record);
    remember("knowledgeArticles", concurrentArticleB.record);
    assert(/^KA-\d{6}$/.test(concurrentArticleA.record.articleNumber), "Knowledge article number did not use the expected sequence format");
    assert(concurrentArticleA.record.articleNumber !== concurrentArticleB.record.articleNumber, "concurrent Knowledge creation allocated a duplicate article number");
    await request("/api/records/Knowledge__kav", { method: "POST", body: { title: `${tag} Duplicate URL`, urlName: knowledge.urlName }, expected: [409] });

    await workflow("Publish", "Knowledge__kav", [knowledge.id], {});
    let article = await prisma.knowledgeArticle.findUnique({ where: { id: knowledge.id } });
    assert(article?.publicationStatus === "Published", "Publish did not set Published status");

    await workflow("Assign", "Knowledge__kav", [knowledge.id], { assigneeId: currentUserId });
    article = await prisma.knowledgeArticle.findUnique({ where: { id: knowledge.id } });
    assert(article?.updatedById === currentUserId, "Assign did not update assignee field");

    await workflow("Archive", "Knowledge__kav", [knowledge.id], { reason: "Use-case archive" });
    article = await prisma.knowledgeArticle.findUnique({ where: { id: knowledge.id } });
    assert(article?.publicationStatus === "Archived", "Archive did not set Archived status");

    await workflow("Restore", "Knowledge__kav", [knowledge.id], {});
    article = await prisma.knowledgeArticle.findUnique({ where: { id: knowledge.id } });
    assert(article?.publicationStatus === "Draft", "Restore did not set Draft status");

    const draft = await postRecord("Knowledge__kav", {
      title: `${tag} Draft Delete`,
      urlName: `${tag}-draft-delete`,
      bodyRichText: "<p>Draft delete</p>"
    }, "knowledgeArticles");
    await workflow("Delete Draft", "Knowledge__kav", [draft.id], {});
    const deletedDraft = await prisma.knowledgeArticle.findUnique({ where: { id: draft.id } });
    assert(!deletedDraft, "Delete Draft did not remove draft article");
    created.knowledgeArticles = created.knowledgeArticles.filter((id) => id !== draft.id);
  });

  await check("marketing, commerce, and utility workflows", async () => {
    const storeResult = await workflow("Create Store", "ListEmail", [], { name: `${tag} Store`, currency: "USD", status: "Draft" });
    remember("stores", storeResult.store);
    assert(storeResult.store?.name === `${tag} Store`, "Create Store did not create store");

    const activationResult = await workflow("Activate Marketing", "ListEmail", [], { senderName: `${tag} Sender`, senderEmail: `${tag}@example.com`, tracking: true });
    remember("marketingActivations", activationResult.activation);
    assert(activationResult.activation?.active === true, "Activate Marketing did not create an active activation");
    const editedActivation = await workflow("Activate Marketing", "ListEmail", [], { id: activationResult.activation.id, senderName: `${tag} Sender Updated`, senderEmail: `${tag}@example.com`, tracking: false });
    assert(editedActivation.activation?.id === activationResult.activation.id && editedActivation.activation?.tracking === false, "Edit Activation created a duplicate instead of updating settings");

    const partnerResult = await utility("createPartner", { accountId: account.id, name: `${tag} Partner`, role: "Integrator" });
    remember("partners", partnerResult.partner);

    const calendarResult = await utility("createCalendarSource", { name: `${tag} Calendar`, type: "My", color: "#0176d3", visible: true });
    remember("calendarSources", calendarResult.source);
    assert(calendarResult.source?.provider === "Local" && calendarResult.source?.connectionStatus === "Local", "calendar source did not disclose its local provider state");
    event = await patchRecord("Event", event.id, { calendarSourceId: calendarResult.source.id });
    assert(event.calendarSourceId === calendarResult.source.id, "event was not assigned to its calendar source");
    const calendarHtml = await request("/lightning/o/Event/home");
    for (const fragment of ["Calendar", "Export .ics", `${tag} Calendar`]) assert(calendarHtml.includes(fragment), `Calendar workspace missing ${fragment}`);
    const icsResponse = await requestRaw("/api/calendar/export");
    const icsText = await icsResponse.text();
    assert(icsResponse.headers.get("content-type")?.includes("text/calendar"), "calendar export did not return text/calendar");
    assert(icsResponse.headers.get("content-disposition")?.includes("calendar.ics"), "calendar export filename was incorrect");
    for (const fragment of ["BEGIN:VCALENDAR", "BEGIN:VEVENT", `${tag} event`, "END:VCALENDAR"]) assert(icsText.includes(fragment), `calendar export missing ${fragment}`);
    await utility("updateCalendarSource", { id: calendarResult.source.id, name: `${tag} Calendar Updated`, type: "Other", color: "#2e844a", visible: false }, calendarResult.source.id);
    await utility("deleteCalendarSource", { id: calendarResult.source.id }, calendarResult.source.id);
    const eventAfterCalendarDelete = await prisma.event.findUnique({ where: { id: event.id } });
    assert(eventAfterCalendarDelete?.calendarSourceId === null, "deleting a calendar source did not safely retain and unassign its events");
    created.calendarSources = created.calendarSources.filter((id) => id !== calendarResult.source.id);

    const reportResult = await utility("saveCustomReport", { name: `${tag} Report`, object: "Lead", groupField: "status", columns: ["displayName", "company", "status"] });
    remember("customReports", reportResult.report);
    const dashboardResult = await utility("saveCustomDashboard", { name: `${tag} Dashboard`, reportIds: [reportResult.report.id] });
    remember("customDashboards", dashboardResult.dashboard);
    const updatedReport = await utility("updateCustomReport", { name: `${tag} Report Updated`, object: "Lead", groupField: "rating", columns: ["displayName", "company", "rating"] }, reportResult.report.id);
    assert(updatedReport.report?.name === `${tag} Report Updated` && updatedReport.report?.groupField === "rating", "saved report update did not persist");
    const updatedDashboard = await utility("updateCustomDashboard", { name: `${tag} Dashboard Updated`, reportIds: [reportResult.report.id] }, dashboardResult.dashboard.id);
    assert(updatedDashboard.dashboard?.name === `${tag} Dashboard Updated`, "saved dashboard update did not persist");
    const analyticsHtml = await request(`/lightning/page/analytics?report=${encodeURIComponent(`${tag} Report Updated`)}`);
    for (const fragment of [`${tag} Report Updated`, `${tag} Dashboard Updated`, "Edit", "Export", "Saved Dashboards"]) assert(analyticsHtml.includes(fragment), `Analytics workspace missing ${fragment}`);
    const reportExportForm = new FormData();
    reportExportForm.set("filename", `${tag} Forecast.csv`);
    reportExportForm.set("csv", '"Rating","Records"\n"Hot","1"');
    const reportExportResponse = await fetch(`${baseUrl}/api/analytics/export`, { method: "POST", headers: { Cookie: authCookie }, body: reportExportForm });
    assert(reportExportResponse.status === 200, `report export returned ${reportExportResponse.status}`);
    assert(reportExportResponse.headers.get("content-type")?.includes("text/csv"), "report export did not return text/csv");
    assert(reportExportResponse.headers.get("content-disposition") === `attachment; filename="${tag}-forecast.csv"`, "report export filename was not constrained");
    assert((await reportExportResponse.text()).includes('"Hot","1"'), "report export did not preserve the CSV rows");
    await utility("deleteCustomDashboard", {}, dashboardResult.dashboard.id);
    await utility("deleteCustomReport", {}, reportResult.report.id);
    assert(!(await prisma.customDashboard.findUnique({ where: { id: dashboardResult.dashboard.id } })), "saved dashboard delete did not persist");
    assert(!(await prisma.customReport.findUnique({ where: { id: reportResult.report.id } })), "saved report delete did not persist");
    created.customDashboards = created.customDashboards.filter((id) => id !== dashboardResult.dashboard.id);
    created.customReports = created.customReports.filter((id) => id !== reportResult.report.id);

    const notificationResult = await utility("createNotification", { title: `${tag} Notification`, body: "Use-case notification", category: tag, href: "/lightning/page/home" });
    remember("notifications", notificationResult.notification);
    await utility("markNotificationRead", {}, notificationResult.notification.id);
    const preferenceResult = await utility("updateNotificationPreference", { category: tag, enabled: false });
    remember("notificationPreferences", preferenceResult.preference);

    const setupResult = await utility("updateSetupShortcutState", { shortcutId: tag, pinned: true, lastOpenedAt: "2026-08-01T00:00:00.000Z" });
    remember("setupShortcutStates", setupResult.state);
    const helpResult = await utility("updateHelpArticleState", { articleId: tag, saved: true, helpful: true, viewedAt: "2026-08-01T00:00:00.000Z" });
    remember("helpArticleStates", helpResult.state);
    originalLeadGuidanceState = await prisma.userGuidanceState.findFirst({
      where: { organizationId, userId: currentUserId, itemId: "lead" }
    });
    const guidanceResult = await utility("updateGuidance", { status: "DONE" }, "lead");
    if (!originalLeadGuidanceState) remember("guidanceStates", guidanceResult.state);

    const appNavResult = await utility("updateAppNavPreference", {
      app: "home",
      items: [{ label: "Home", href: "/lightning/page/home" }, { label: `${tag} Nav`, href: "/lightning/o/Lead/list", object: "Lead" }]
    });
    remember("appNavPreferences", appNavResult.appNavPreference);
    await utility("resetAppNavPreference", { app: "home" });
    created.appNavPreferences = created.appNavPreferences.filter((id) => id !== appNavResult.appNavPreference.id);

    const listViewResult = await utility("saveListViewPreference", {
      object: "Lead",
      viewName: `${tag} Leads`,
      columns: ["displayName", "company", "status"],
      columnWidths: { displayName: "220px" },
      filters: [{ field: "status", operator: "equals", value: "New" }],
      chartType: "Bar",
      chartField: "status",
      sharing: "Only I can see this list view",
      isCustom: true
    });
    remember("listViewPreferences", listViewResult.listViewPreference);
    await utility("pinListViewPreference", {
      object: "Lead",
      viewName: `${tag} Leads`,
      columns: ["displayName", "company", "status"],
      pinned: true,
      isCustom: true
    });
    await utility("deleteListViewPreference", { object: "Lead", viewName: `${tag} Leads` });
    created.listViewPreferences = created.listViewPreferences.filter((id) => id !== listViewResult.listViewPreference.id);

    const searchResult = await utility("saveGlobalSearchRecent", { href: `/lightning/o/Lead/list?search=${tag}`, label: tag, context: "Lead", category: "Record", query: tag });
    remember("globalSearchRecents", searchResult.recent);

    const invalidChat = await request("/api/ai/chat", { method: "POST", body: { message: "", pathname: "/lightning/page/home" }, expected: [400] });
    assert(invalidChat.code === "invalid_request", "AI chat did not validate an empty message before provider access");
    const oversizedChat = await request("/api/ai/chat", { method: "POST", body: { message: "x".repeat(2001), pathname: "/lightning/page/home" }, expected: [400] });
    assert(oversizedChat.code === "invalid_request", "AI chat did not enforce its 2,000-character prompt limit");
    const invalidInsight = await request("/api/ai/insights", { method: "POST", body: { surface: "unknown" }, expected: [400] });
    assert(invalidInsight.code === "invalid_request", "AI insights did not reject an unsupported surface");

    const rateLimitTexts = Array.from({ length: 10 }, (_, index) => `${tag} rate limit ${index}`);
    await prisma.agentforceMessage.createMany({
      data: rateLimitTexts.map((text) => ({ organizationId, userId: currentUserId, role: "user", text }))
    });
    try {
      const limitedChat = await request("/api/ai/chat", {
        method: "POST",
        body: { message: "This must be rejected before provider access.", pathname: "/lightning/page/home" },
        expected: [429]
      });
      assert(limitedChat.code === "rate_limit", "AI chat did not enforce 10 requests per minute");
    } finally {
      await prisma.agentforceMessage.deleteMany({ where: { organizationId, userId: currentUserId, text: { in: rateLimitTexts } } });
    }

    if (process.env.CRM_AI_LIVE_CHECK === "1") {
      const agentforceResult = await request("/api/ai/chat", {
        method: "POST",
        body: { message: "Summarize the open pipeline with exact CRM facts.", pathname: "/lightning/page/home" },
        expected: [200]
      });
      agentforceResult.messages?.forEach((message) => remember("agentforceMessages", message));
      assert(agentforceResult.messages?.length === 2, "Agentforce did not return user and assistant messages");
      assert(agentforceResult.messages[1]?.metadata?.model, "Agentforce response did not include model metadata");

      const draftResult = await request("/api/ai/chat", {
        method: "POST",
        body: { message: "Draft a concise follow-up email for Rober Antonio about next steps.", pathname: "/lightning/r/Contact/con-rober-antonio/view" },
        expected: [200]
      });
      draftResult.messages?.forEach((message) => remember("agentforceMessages", message));
      const draft = draftResult.messages?.[1]?.metadata?.draft;
      assert(draft?.subject && draft?.body, "Agentforce did not return a follow-up draft");
      assert(draft?.recipientIds?.includes("con-rober-antonio"), "Agentforce did not securely resolve the draft recipient");

      const homeInsight = await request("/api/ai/insights", { method: "POST", body: { surface: "home" }, expected: [200] });
      assert(homeInsight.payload?.summary, "Home AI did not return a summary");
      const cachedHomeInsight = await request("/api/ai/insights", { method: "POST", body: { surface: "home" }, expected: [200] });
      assert(cachedHomeInsight.cached === true, "Home AI did not reuse its validated cache");
      const activityInsight = await request("/api/ai/insights", {
        method: "POST",
        body: { surface: "activity", object: "Account", recordId: "acc-robert" },
        expected: [200]
      });
      assert(activityInsight.payload?.summary, "Activity AI did not return a summary");
      const cachedActivityInsight = await request("/api/ai/insights", {
        method: "POST",
        body: { surface: "activity", object: "Account", recordId: "acc-robert" },
        expected: [200]
      });
      assert(cachedActivityInsight.cached === true, "Activity AI did not reuse its validated cache");
    }
  });

  await check("marketing landing pages publish real lead forms", async () => {
    const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
    assert(organization?.slug, "active organization slug was not available");
    const campaignResult = await request("/api/campaigns", {
      method: "POST",
      body: { name: `${tag} Form Campaign`, type: "Email", ownerId: currentUserId },
      expected: [201]
    });
    const formCampaign = remember("campaigns", campaignResult.campaign);
    campaignResult.notifications?.forEach((notification) => remember("notifications", notification));

    const createResult = await request("/api/marketing/landing-pages", {
      method: "POST",
      body: {
        name: `${tag} Lead Form`,
        slug: `${tag}-lead-form`,
        headline: `${tag} Request a consultation`,
        description: "A real public lead-capture form.",
        submitLabel: "Request Consultation",
        successMessage: "A representative will follow up.",
        ownerId: currentUserId,
        campaignId: formCampaign.id,
        fields: ["firstName", "phone", "message"]
      },
      expected: [201]
    });
    let landingPage = remember("marketingLandingPages", createResult.page);
    createResult.notifications?.forEach((notification) => remember("notifications", notification));
    assert(landingPage.status === "Draft", "landing page did not start as Draft");
    for (const requiredField of ["lastName", "email", "company"]) assert(landingPage.fields.includes(requiredField), `landing page omitted required ${requiredField} field`);

    await request("/api/marketing/landing-pages", {
      method: "POST",
      body: { name: `${tag} Duplicate Form`, slug: landingPage.slug, headline: "Duplicate", ownerId: currentUserId, fields: [] },
      expected: [409]
    });
    const publicPath = `/forms/${encodeURIComponent(organization.slug)}/${encodeURIComponent(landingPage.slug)}`;
    await requestAnonymous(publicPath, { expected: [404] });

    const updateResult = await request(`/api/marketing/landing-pages/${landingPage.id}`, {
      method: "PATCH",
      body: { headline: `${tag} Updated consultation form`, submitLabel: "Contact Me" }
    });
    landingPage = updateResult.page;
    assert(landingPage.headline.includes("Updated"), "Draft landing-page edit did not persist");

    const publishResult = await request(`/api/marketing/landing-pages/${landingPage.id}/actions`, { method: "POST", body: { action: "publish" } });
    landingPage = publishResult.page;
    publishResult.notifications?.forEach((notification) => remember("notifications", notification));
    assert(landingPage.status === "Published" && landingPage.publishedAt, "landing page publish did not set lifecycle state");
    await request(`/api/marketing/landing-pages/${landingPage.id}`, { method: "PATCH", body: { headline: "Forbidden" }, expected: [409] });
    await request(`/api/marketing/landing-pages/${landingPage.id}`, { method: "DELETE", expected: [409] });

    const publicHtml = await requestAnonymous(publicPath);
    for (const fragment of [landingPage.headline, "Contact Me", "Last Name", "Email", "Company"]) assert(publicHtml.includes(fragment), `public marketing form missing ${fragment}`);
    await requestAnonymous(`/api/marketing/public/${encodeURIComponent(organization.slug)}/${encodeURIComponent(landingPage.slug)}/submissions`, {
      method: "POST",
      body: { lastName: "Missing Company", email: "invalid" },
      expected: [400]
    });
    const submissionEmail = `form-${tag}@example.com`;
    const submissionResult = await requestAnonymous(`/api/marketing/public/${encodeURIComponent(organization.slug)}/${encodeURIComponent(landingPage.slug)}/submissions`, {
      method: "POST",
      body: { firstName: "Web", lastName: `${tag} Submitter`, company: `${tag} Prospect`, email: submissionEmail, phone: "555-0199", message: `${tag} form message` },
      expected: [201]
    });
    assert(submissionResult.successMessage === "A representative will follow up.", "public form did not return its configured success message");
    const submission = await prisma.marketingFormSubmission.findUnique({ where: { id: submissionResult.submissionId }, include: { lead: true } });
    assert(submission?.lead?.email === submissionEmail && submission.lead.leadSource === "Web", "form submission did not create the expected Web Lead");
    remember("marketingFormSubmissions", submission);
    remember("leads", submission?.lead);
    const attributedMember = await prisma.campaignMember.findFirst({ where: { organizationId, campaignId: formCampaign.id, objectType: "Lead", recordId: submission.lead.id } });
    assert(attributedMember?.responded === true, "form submission did not create a responded Campaign Member");
    await requestAnonymous(`/api/marketing/public/${encodeURIComponent(organization.slug)}/${encodeURIComponent(landingPage.slug)}/submissions`, {
      method: "POST",
      body: { lastName: `${tag} Submitter`, company: `${tag} Prospect`, email: submissionEmail },
      expected: [429]
    });

    const pageResult = await request(`/api/marketing/landing-pages/${landingPage.id}`);
    assert(pageResult.page.submissions.some((item) => item.id === submission.id), "landing-page detail omitted its submission history");
    const bootstrap = await request("/api/bootstrap");
    assert(bootstrap.marketingLandingPages.some((item) => item.id === landingPage.id), "Bootstrap omitted the created landing page");
    const marketingHtml = await request("/lightning/app/marketing");
    for (const fragment of ["Landing Pages &amp; Lead Forms", "New Landing Page", landingPage.name]) assert(marketingHtml.includes(fragment), `Marketing workspace missing ${fragment}`);

    const archiveResult = await request(`/api/marketing/landing-pages/${landingPage.id}/actions`, { method: "POST", body: { action: "archive" } });
    archiveResult.notifications?.forEach((notification) => remember("notifications", notification));
    assert(archiveResult.page.status === "Archived", "landing page archive did not persist");
    await requestAnonymous(publicPath, { expected: [404] });
    const restoreResult = await request(`/api/marketing/landing-pages/${landingPage.id}/actions`, { method: "POST", body: { action: "restore" } });
    restoreResult.notifications?.forEach((notification) => remember("notifications", notification));
    assert(restoreResult.page.status === "Draft", "landing page restore did not return to Draft");
    await request(`/api/marketing/landing-pages/${landingPage.id}`, { method: "DELETE", expected: [409] });

    const disposable = await request("/api/marketing/landing-pages", {
      method: "POST",
      body: { name: `${tag} Disposable Form`, slug: `${tag}-disposable-form`, headline: "Disposable", ownerId: currentUserId, fields: [] },
      expected: [201]
    });
    remember("marketingLandingPages", disposable.page);
    disposable.notifications?.forEach((notification) => remember("notifications", notification));
    await request(`/api/marketing/landing-pages/${disposable.page.id}`, { method: "DELETE" });
    created.marketingLandingPages = created.marketingLandingPages.filter((id) => id !== disposable.page.id);
  });

  await check("profile and preference utilities restore cleanly", async () => {
    originalUser = await prisma.user.findUnique({ where: { id: currentUserId } });
    originalPreference = await prisma.userPreference.findUnique({ where: { organizationId_userId: { organizationId, userId: currentUserId } } });
    assert(originalUser, "current user not found");

    const profileResult = await utility("updateProfile", { name: `${tag} User`, alias: "QA", avatarUrl: null });
    assert(profileResult.user?.alias === "QA", "profile update did not change alias");

    const preferencesResult = await utility("updatePreferences", {
      displayDensity: "Compact",
      guidanceEnabled: true,
      consoleTabsEnabled: true,
      homeMode: "Dashboard",
      quarterlyGoal: 1000,
      timezone: "Asia/Dubai",
      locale: "en-US"
    });
    assert(preferencesResult.preferences?.displayDensity === "Compact", "preferences update did not change display density");

    await restoreProfileAndPreferences();
  });

  await check("disposable API delete route works", async () => {
    const disposable = await postRecord("QuickText", {
      name: `${tag} Disposable Delete`,
      message: "Delete me",
      category: "Greetings",
      channels: ["Email"],
      mergeFields: []
    }, "quickTexts");
    await request(`/api/records/QuickText/${disposable.id}`, { method: "DELETE", expected: [200] });
    const afterDelete = await prisma.quickText.findUnique({ where: { id: disposable.id } });
    assert(!afterDelete, "DELETE route did not remove quick text");
    created.quickTexts = created.quickTexts.filter((id) => id !== disposable.id);
  });
}

async function restoreProfileAndPreferences() {
  if (originalUser) {
    await prisma.user.update({
      where: { id: originalUser.id },
      data: {
        name: originalUser.name,
        alias: originalUser.alias,
        avatarUrl: originalUser.avatarUrl
      }
    });
  }

  if (originalPreference) {
    await prisma.userPreference.upsert({
      where: { organizationId_userId: { organizationId: originalPreference.organizationId, userId: originalPreference.userId } },
      update: {
        displayDensity: originalPreference.displayDensity,
        guidanceEnabled: originalPreference.guidanceEnabled,
        consoleTabsEnabled: originalPreference.consoleTabsEnabled,
        homeMode: originalPreference.homeMode,
        quarterlyGoal: originalPreference.quarterlyGoal,
        timezone: originalPreference.timezone,
        locale: originalPreference.locale
      },
      create: {
        organizationId: originalPreference.organizationId,
        userId: originalPreference.userId,
        displayDensity: originalPreference.displayDensity,
        guidanceEnabled: originalPreference.guidanceEnabled,
        consoleTabsEnabled: originalPreference.consoleTabsEnabled,
        homeMode: originalPreference.homeMode,
        quarterlyGoal: originalPreference.quarterlyGoal,
        timezone: originalPreference.timezone,
        locale: originalPreference.locale
      }
    });
  }
}

async function cleanup() {
  await restoreProfileAndPreferences();
  await restoreLeadGuidanceState();

  await prisma.agentforceMessage.deleteMany({ where: { OR: [{ id: { in: created.agentforceMessages } }, { text: { contains: tag } }] } });
  await prisma.aiInsightCache.deleteMany({ where: { organizationId, userId: currentUserId } });
  await prisma.globalSearchRecent.deleteMany({ where: { OR: [{ id: { in: created.globalSearchRecents } }, { query: tag }, { label: tag }, { href: { in: created.invoices.map((id) => `/lightning/r/Invoice/${id}/view`) } }] } });
  await prisma.listViewPreference.deleteMany({ where: { OR: [{ id: { in: created.listViewPreferences } }, { viewName: { contains: tag } }] } });
  await prisma.appNavPreference.deleteMany({ where: { id: { in: created.appNavPreferences } } });
  await prisma.helpArticleState.deleteMany({ where: { OR: [{ id: { in: created.helpArticleStates } }, { articleId: tag }] } });
  await prisma.setupShortcutState.deleteMany({ where: { OR: [{ id: { in: created.setupShortcutStates } }, { shortcutId: tag }] } });
  await prisma.userGuidanceState.deleteMany({ where: { id: { in: created.guidanceStates } } });
  await prisma.notificationPreference.deleteMany({ where: { OR: [{ id: { in: created.notificationPreferences } }, { category: tag }] } });
  await prisma.notification.deleteMany({ where: { OR: [{ id: { in: created.notifications } }, { title: { contains: tag } }, { body: { contains: tag } }, { href: { in: created.invoices.map((id) => `/lightning/r/Invoice/${id}/view`) } }] } });
  await prisma.customDashboard.deleteMany({ where: { OR: [{ id: { in: created.customDashboards } }, { name: { contains: tag } }] } });
  await prisma.customReport.deleteMany({ where: { OR: [{ id: { in: created.customReports } }, { name: { contains: tag } }] } });
  await prisma.calendarSource.deleteMany({ where: { OR: [{ id: { in: created.calendarSources } }, { name: { contains: tag } }] } });
  await prisma.marketingFormSubmission.deleteMany({ where: { OR: [{ id: { in: created.marketingFormSubmissions } }, { landingPageId: { in: created.marketingLandingPages } }, { leadId: { in: created.leads } }] } });
  await prisma.marketingLandingPage.deleteMany({ where: { OR: [{ id: { in: created.marketingLandingPages } }, { name: { contains: tag } }, { slug: { contains: tag } }] } });
  await prisma.marketingActivation.deleteMany({ where: { OR: [{ id: { in: created.marketingActivations } }, { senderName: { contains: tag } }, { senderEmail: { contains: tag } }] } });
  await prisma.commerceFulfillmentLine.deleteMany({ where: { OR: [{ id: { in: created.commerceFulfillmentLines } }, { fulfillmentId: { in: created.commerceFulfillments } }] } });
  await prisma.commerceFulfillment.deleteMany({ where: { OR: [{ id: { in: created.commerceFulfillments } }, { orderId: { in: created.commerceOrders } }, { trackingNumber: { contains: tag } }] } });
  await prisma.commerceOrderPromotion.deleteMany({ where: { OR: [{ orderId: { in: created.commerceOrders } }, { promotionId: { in: created.commercePromotions } }] } });
  await prisma.commerceOrderLine.deleteMany({ where: { OR: [{ id: { in: created.commerceOrderLines } }, { orderId: { in: created.commerceOrders } }, { description: { contains: tag } }] } });
  await prisma.commerceOrder.deleteMany({ where: { OR: [{ id: { in: created.commerceOrders } }, { notes: { contains: tag } }, { purchaseOrderNumber: { contains: tag } }] } });
  await prisma.commercePromotion.deleteMany({ where: { OR: [{ id: { in: created.commercePromotions } }, { name: { contains: tag } }, { code: { contains: tag } }] } });
  await prisma.inventoryItem.deleteMany({ where: { OR: [{ id: { in: created.inventoryItems } }, { storeId: { in: created.stores } }, { productId: { in: created.products } }] } });
  await prisma.marketingStore.deleteMany({ where: { OR: [{ id: { in: created.stores } }, { name: { contains: tag } }] } });

  await prisma.fileRecord.deleteMany({ where: { OR: [{ id: { in: created.files } }, { name: { contains: tag } }] } });
  await prisma.attachmentRecord.deleteMany({ where: { OR: [{ id: { in: created.attachments } }, { name: { contains: tag } }] } });
  await prisma.task.deleteMany({ where: { OR: [{ id: { in: created.tasks } }, { subject: { contains: tag } }] } });
  await prisma.emailDeliveryEvent.deleteMany({ where: { OR: [{ id: { in: created.emailDeliveryEvents } }, { deliveryId: { in: created.emailDeliveries } }] } });
  await prisma.emailDelivery.deleteMany({ where: { OR: [{ id: { in: created.emailDeliveries } }, { subject: { contains: tag } }, { providerMessageId: { contains: tag } }] } });
  await prisma.emailActivity.deleteMany({ where: { OR: [{ id: { in: created.emailActivities } }, { subject: { contains: tag } }] } });
  await prisma.callActivity.deleteMany({ where: { OR: [{ id: { in: created.callActivities } }, { subject: { contains: tag } }] } });
  await prisma.event.deleteMany({ where: { OR: [{ id: { in: created.events } }, { description: { contains: tag } }, { relatedRecordId: { in: created.accounts } }] } });
  await prisma.messagingMessage.deleteMany({ where: { OR: [{ id: { in: created.messagingMessages } }, { body: { contains: tag } }, { sessionId: { in: created.messagingSessions } }] } });
  await prisma.messagingSessionParticipant.deleteMany({ where: { sessionId: { in: created.messagingSessions } } });
  await prisma.messagingSession.deleteMany({ where: { OR: [{ id: { in: created.messagingSessions } }, { name: { contains: tag } }] } });
  await prisma.videoCallParticipant.deleteMany({ where: { OR: [{ id: { in: created.videoCallParticipants } }, { videoCallId: { in: created.videoCalls } }] } });
  await prisma.videoCall.deleteMany({ where: { OR: [{ id: { in: created.videoCalls } }, { name: { contains: tag } }] } });

  await prisma.recordLabel.deleteMany({ where: { OR: [{ id: { in: created.labels } }, { label: { contains: tag } }, { recordId: { in: [...created.accounts, ...created.contacts, ...created.leads] } }] } });
  await prisma.campaignMember.deleteMany({ where: { OR: [{ campaignId: { in: created.campaigns } }, { recordId: { in: [...created.contacts, ...created.leads] } }] } });
  await prisma.campaign.deleteMany({ where: { OR: [{ id: { in: created.campaigns } }, { name: { contains: tag } }] } });

  await prisma.listEmail.deleteMany({ where: { OR: [{ id: { in: created.listEmails } }, { subject: { contains: tag } }] } });
  await prisma.knowledgeFeedback.deleteMany({ where: { OR: [{ id: { in: created.knowledgeFeedback } }, { articleId: { in: created.knowledgeArticles } }, { comment: { contains: tag } }] } });
  await prisma.knowledgeArticle.deleteMany({ where: { OR: [{ id: { in: created.knowledgeArticles } }, { title: { contains: tag } }, { urlName: { contains: tag } }] } });
  await prisma.quickTextFavorite.deleteMany({ where: { OR: [{ id: { in: created.quickTextFavorites } }, { quickTextId: { in: created.quickTexts } }] } });
  await prisma.quickText.deleteMany({ where: { OR: [{ id: { in: created.quickTexts } }, { name: { contains: tag } }, { message: { contains: tag } }] } });
  await prisma.quickTextFolder.deleteMany({ where: { OR: [{ id: { in: created.quickTextFolders } }, { name: { contains: tag } }] } });

  await prisma.invoicePayment.deleteMany({ where: { OR: [{ id: { in: created.invoicePayments } }, { invoiceId: { in: created.invoices } }] } });
  await prisma.invoiceLineItem.deleteMany({ where: { OR: [{ id: { in: created.invoiceLineItems } }, { invoiceId: { in: created.invoices } }, { description: { contains: tag } }] } });
  await prisma.invoice.deleteMany({ where: { OR: [{ id: { in: created.invoices } }, { notes: { contains: tag } }, { purchaseOrderNumber: { contains: tag } }] } });

  await prisma.priceBookEntry.deleteMany({ where: { OR: [{ id: { in: created.priceBookEntries } }, { productId: { in: created.products } }, { priceBookId: { in: created.priceBooks } }] } });
  await prisma.partner.deleteMany({ where: { OR: [{ id: { in: created.partners } }, { name: { contains: tag } }, { accountId: { in: created.accounts } }] } });
  await prisma.opportunity.deleteMany({ where: { OR: [{ id: { in: created.opportunities } }, { name: { contains: tag } }, { accountId: { in: created.accounts } }, { contactId: { in: created.contacts } }] } });
  await prisma.caseRecord.deleteMany({ where: { OR: [{ id: { in: created.cases } }, { subject: { contains: tag } }, { accountId: { in: created.accounts } }, { contactId: { in: created.contacts } }] } });
  await prisma.contact.deleteMany({ where: { OR: [{ id: { in: created.contacts } }, { lastName: { contains: tag } }, { email: { contains: tag } }, { accountId: { in: created.accounts } }] } });
  await prisma.lead.deleteMany({ where: { OR: [{ id: { in: created.leads } }, { lastName: { contains: tag } }, { company: { contains: tag } }, { email: { contains: tag } }] } });
  await prisma.product.deleteMany({ where: { OR: [{ id: { in: created.products } }, { name: { contains: tag } }, { productCode: tag }] } });
  await prisma.priceBook.deleteMany({ where: { OR: [{ id: { in: created.priceBooks } }, { name: { contains: tag } }] } });
  await prisma.account.deleteMany({ where: { OR: [{ id: { in: created.accounts } }, { name: { contains: tag } }] } });
  await prisma.appSession.deleteMany({ where: { userId: currentUserId } });
  await prisma.organizationMembership.deleteMany({ where: { organizationId, userId: currentUserId } });
  await prisma.userPreference.deleteMany({ where: { organizationId, userId: currentUserId } });
  await prisma.user.deleteMany({ where: { id: currentUserId } });
}

async function restoreLeadGuidanceState() {
  if (originalLeadGuidanceState) {
    await prisma.userGuidanceState.upsert({
      where: { id: originalLeadGuidanceState.id },
      update: {
        status: originalLeadGuidanceState.status,
        snoozedUntil: originalLeadGuidanceState.snoozedUntil
      },
      create: {
        id: originalLeadGuidanceState.id,
        organizationId: originalLeadGuidanceState.organizationId,
        userId: originalLeadGuidanceState.userId,
        itemId: originalLeadGuidanceState.itemId,
        status: originalLeadGuidanceState.status,
        snoozedUntil: originalLeadGuidanceState.snoozedUntil
      }
    });
    return;
  }

  await prisma.userGuidanceState.deleteMany({
    where: { organizationId, userId: currentUserId, itemId: "lead" }
  });
}

try {
  await main();
} finally {
  await cleanup();
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
