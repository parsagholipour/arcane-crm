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
  events: [],
  tasks: [],
  emailActivities: [],
  callActivities: [],
  files: [],
  attachments: [],
  quickTextFolders: [],
  quickTexts: [],
  knowledgeArticles: [],
  listEmails: [],
  stores: [],
  campaigns: [],
  labels: [],
  marketingActivations: [],
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
    assert(html.includes("Salesforce"), "home page did not render the Salesforce shell");
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
      "Don&#x27;t wait: Save 70% now with code STARTER70",
      "Days left in your Trial: 30",
      "Search...",
      "Agentforce",
      "Guidance Center",
      "Salesforce Help",
      "Quick Settings",
      "Notifications",
      "View profile"
    ]) {
      assert(home.includes(fragment), `home shell missing ${fragment}`);
    }

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
    assert(commerce.includes("Create Store"), "Commerce page missing Create Store");
    const yourAccount = await request("/lightning/app/your-account");
    assert(yourAccount.includes("Buy Now"), "Your Account page missing Buy Now");
  });

  await check("required create validation and scoped checkout errors", async () => {
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

    const checkout = await request("/api/workflows", {
      method: "POST",
      body: { action: "Buy Now", object: "Subscription", selectedIds: [], values: {} },
      expected: [400]
    });
    assert(checkout.error?.includes("out of scope"), "Buy Now workflow did not return scoped out-of-scope error");
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
      "files",
      "attachments",
      "tasks",
      "emailActivities",
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
    try {
      const data = await request("/api/bootstrap");
      assert(!data.accounts.some((record) => record.id === isolatedAccount.id), "bootstrap leaked another organization's account");
      await request(`/api/records/Account/${isolatedAccount.id}`, { method: "PATCH", body: { name: "Cross tenant update" }, expected: [404] });
      await request(`/api/records/Account/${isolatedAccount.id}`, { method: "DELETE", expected: [404] });
      await request("/api/organizations/active", { method: "POST", body: { organizationId: isolatedOrganization.id }, expected: [404] });
      await request("/api/workflows", { method: "POST", body: { action: "Add to Category", object: "Product2", selectedIds: [isolatedProduct.id], values: { category: "Cross tenant category" } }, expected: [404] });
      const unchangedProduct = await prisma.product.findUnique({ where: { id: isolatedProduct.id } });
      assert(unchangedProduct?.category === null, "workflow changed another organization's product");
    } finally {
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
      phone: "555-0102"
    }, "contacts");
    await patchRecord("Contact", contact.id, { title: "QA Contact" });

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

    caseB = await postRecord("Case", {
      status: "New",
      origin: "Phone",
      priority: "Medium",
      accountId: account.id,
      contactId: contact.id,
      subject: `${tag} Case B`
    }, "cases");

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
    await patchRecord("ListEmail", listEmail.id, { status: "Sent" });
  });

  await check("activity and file workflows", async () => {
    const email = await request("/api/activity", {
      method: "POST",
      body: { type: "email", to: contact.email, subject: `${tag} Email`, body: "Email body", relatedObjectType: "Contact", relatedRecordId: contact.id },
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

    const file = await request("/api/files", {
      method: "POST",
      body: { name: `${tag}.pdf`, size: 128, relatedObjectType: "Contact", relatedRecordId: contact.id },
      expected: [201]
    });
    remember("files", file.record);

    const attachment = await request("/api/files", {
      method: "POST",
      body: { name: `${tag}-attachment.txt`, size: 64, relatedObjectType: "Contact", relatedRecordId: contact.id, attachment: true },
      expected: [201]
    });
    remember("attachments", attachment.record);

    const data = await request("/api/bootstrap");
    assert(data.emailActivities.some((item) => item.id === email.record.id), "email activity missing from bootstrap");
    assert(data.callActivities.some((item) => item.id === call.record.id), "call activity missing from bootstrap");
    assert(data.tasks.some((item) => item.id === task.record.id), "task missing from bootstrap");
    assert(data.files.some((item) => item.id === file.record.id), "file missing from bootstrap");
    assert(data.attachments.some((item) => item.id === attachment.record.id), "attachment missing from bootstrap");
  });

  await check("bulk list and sales workflows", async () => {
    const labelResult = await workflow("Assign Label", "Contact", [contact.id], { label: `${tag} Label`, color: "blue" });
    labelResult.labels?.forEach((label) => remember("labels", label));
    assert(labelResult.labels?.length === 1, "Assign Label did not return one label");

    const campaignResult = await workflow("Add to Campaign", "Contact", [contact.id], { campaign: `${tag} Campaign`, status: "Sent" });
    remember("campaigns", campaignResult.campaign);
    campaignResult.campaignMembers?.forEach((member) => remember("campaigns", { id: campaignResult.campaign.id }) || member);
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

    const mergeResult = await workflow("Merge Cases", "Case", [caseA.id, caseB.id], { primaryCase: caseA.id });
    assert(mergeResult.ok, "Merge Cases did not complete");
    const closedCase = await prisma.caseRecord.findUnique({ where: { id: caseB.id } });
    assert(closedCase?.status === "Closed", "Merge Cases did not close the secondary case");
  });

  await check("knowledge lifecycle workflows", async () => {
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

    const partnerResult = await utility("createPartner", { accountId: account.id, name: `${tag} Partner`, role: "Integrator" });
    remember("partners", partnerResult.partner);

    const calendarResult = await utility("createCalendarSource", { name: `${tag} Calendar`, type: "My", color: "#0176d3", visible: true });
    remember("calendarSources", calendarResult.source);
    await utility("updateCalendarSource", { id: calendarResult.source.id, name: `${tag} Calendar Updated`, type: "Other", color: "#2e844a", visible: false }, calendarResult.source.id);
    await utility("deleteCalendarSource", { id: calendarResult.source.id }, calendarResult.source.id);
    created.calendarSources = created.calendarSources.filter((id) => id !== calendarResult.source.id);

    const reportResult = await utility("saveCustomReport", { name: `${tag} Report`, object: "Lead", groupField: "status", columns: ["displayName", "company", "status"] });
    remember("customReports", reportResult.report);
    const dashboardResult = await utility("saveCustomDashboard", { name: `${tag} Dashboard`, reportIds: [reportResult.report.id] });
    remember("customDashboards", dashboardResult.dashboard);

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

    const agentforceResult = await utility("sendAgentforceMessage", { text: `summarize ${tag}` });
    agentforceResult.messages?.forEach((message) => remember("agentforceMessages", message));
    assert(agentforceResult.messages?.length === 2, "Agentforce did not return user and assistant messages");
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
  await prisma.globalSearchRecent.deleteMany({ where: { OR: [{ id: { in: created.globalSearchRecents } }, { query: tag }, { label: tag }] } });
  await prisma.listViewPreference.deleteMany({ where: { OR: [{ id: { in: created.listViewPreferences } }, { viewName: { contains: tag } }] } });
  await prisma.appNavPreference.deleteMany({ where: { id: { in: created.appNavPreferences } } });
  await prisma.helpArticleState.deleteMany({ where: { OR: [{ id: { in: created.helpArticleStates } }, { articleId: tag }] } });
  await prisma.setupShortcutState.deleteMany({ where: { OR: [{ id: { in: created.setupShortcutStates } }, { shortcutId: tag }] } });
  await prisma.userGuidanceState.deleteMany({ where: { id: { in: created.guidanceStates } } });
  await prisma.notificationPreference.deleteMany({ where: { OR: [{ id: { in: created.notificationPreferences } }, { category: tag }] } });
  await prisma.notification.deleteMany({ where: { OR: [{ id: { in: created.notifications } }, { title: { contains: tag } }, { body: { contains: tag } }] } });
  await prisma.customDashboard.deleteMany({ where: { OR: [{ id: { in: created.customDashboards } }, { name: { contains: tag } }] } });
  await prisma.customReport.deleteMany({ where: { OR: [{ id: { in: created.customReports } }, { name: { contains: tag } }] } });
  await prisma.calendarSource.deleteMany({ where: { OR: [{ id: { in: created.calendarSources } }, { name: { contains: tag } }] } });
  await prisma.marketingActivation.deleteMany({ where: { OR: [{ id: { in: created.marketingActivations } }, { senderName: { contains: tag } }, { senderEmail: { contains: tag } }] } });
  await prisma.marketingStore.deleteMany({ where: { OR: [{ id: { in: created.stores } }, { name: { contains: tag } }] } });

  await prisma.fileRecord.deleteMany({ where: { OR: [{ id: { in: created.files } }, { name: { contains: tag } }] } });
  await prisma.attachmentRecord.deleteMany({ where: { OR: [{ id: { in: created.attachments } }, { name: { contains: tag } }] } });
  await prisma.task.deleteMany({ where: { OR: [{ id: { in: created.tasks } }, { subject: { contains: tag } }] } });
  await prisma.emailActivity.deleteMany({ where: { OR: [{ id: { in: created.emailActivities } }, { subject: { contains: tag } }] } });
  await prisma.callActivity.deleteMany({ where: { OR: [{ id: { in: created.callActivities } }, { subject: { contains: tag } }] } });
  await prisma.event.deleteMany({ where: { OR: [{ id: { in: created.events } }, { description: { contains: tag } }, { relatedRecordId: { in: created.accounts } }] } });

  await prisma.recordLabel.deleteMany({ where: { OR: [{ id: { in: created.labels } }, { label: { contains: tag } }, { recordId: { in: [...created.accounts, ...created.contacts, ...created.leads] } }] } });
  await prisma.campaignMember.deleteMany({ where: { OR: [{ campaignId: { in: created.campaigns } }, { recordId: { in: [...created.contacts, ...created.leads] } }] } });
  await prisma.campaign.deleteMany({ where: { OR: [{ id: { in: created.campaigns } }, { name: { contains: tag } }] } });

  await prisma.listEmail.deleteMany({ where: { OR: [{ id: { in: created.listEmails } }, { subject: { contains: tag } }] } });
  await prisma.knowledgeArticle.deleteMany({ where: { OR: [{ id: { in: created.knowledgeArticles } }, { title: { contains: tag } }, { urlName: { contains: tag } }] } });
  await prisma.quickText.deleteMany({ where: { OR: [{ id: { in: created.quickTexts } }, { name: { contains: tag } }, { message: { contains: tag } }] } });
  await prisma.quickTextFolder.deleteMany({ where: { OR: [{ id: { in: created.quickTextFolders } }, { name: { contains: tag } }] } });

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
