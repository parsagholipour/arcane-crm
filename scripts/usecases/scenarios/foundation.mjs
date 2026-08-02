export async function runFoundationScenarios(context, state) {
  const { assert, check, currentUserId, prisma, readFile, request, requestAnonymous, tag } = context;
  let { account, contact, product, invoice } = state;

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
    assert(
      !home.includes("STARTER70") && !home.includes("Days left in your Trial"),
      "home shell still renders the trial purchase banner"
    );

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
    const knowledgeList = await request("/lightning/o/Knowledge__kav/list");
    for (const fragment of ["Publish", "Assign", "Archive", "Delete Article", "Show more actions"]) {
      assert(knowledgeList.includes(fragment), `Knowledge list missing ${fragment}`);
    }

    const accountRecord = await request("/lightning/r/Account/acc-robert/view");
    for (const fragment of [
      "View Account Hierarchy",
      "New Contact",
      "New Opportunity",
      "Related",
      "Details",
      "We found no potential duplicates",
      "Activity",
      "Upload Files"
    ]) {
      assert(accountRecord.includes(fragment), `Account record missing ${fragment}`);
    }

    const commerce = await request("/lightning/app/commerce");
    assert(commerce.includes("New Store"), "Commerce page missing New Store");
    const yourAccount = await request("/lightning/app/your-account");
    for (const fragment of ["Profile", "Workspace", "Personal Preferences", "Security and Access", "Manage Sessions"]) {
      assert(yourAccount.includes(fragment), `Your Account page missing ${fragment}`);
    }
    assert(
      !yourAccount.includes("Buy Now") &&
        !yourAccount.toLowerCase().includes("subscription") &&
        !yourAccount.toLowerCase().includes("trial workspace"),
      "Your Account page still renders purchase content"
    );
  });

  await check("required create validation and unsupported workflow errors", async () => {
    const requiredCases = [
      ["Account", {}, ["name"]],
      ["Contact", { lastName: `${tag} Invalid Contact` }, ["accountId"]],
      ["Lead", { lastName: `${tag} Lead`, company: `${tag} Company` }, ["status"]],
      [
        "Opportunity",
        { name: `${tag} Invalid Opportunity`, stage: "Qualify" },
        ["accountId", "closeDate", "forecastCategory"]
      ],
      ["Product2", {}, ["name"]],
      ["Pricebook2", {}, ["name"]],
      [
        "Event",
        { subject: "--None--", startAt: "2026-08-20T09:00:00.000Z", endAt: "2026-08-20T10:00:00.000Z" },
        ["subject", "assignedToId"]
      ],
      ["QuickText", { name: `${tag} Invalid Quick Text` }, ["message"]],
      ["Knowledge__kav", { title: `${tag} Invalid Knowledge` }, ["urlName"]]
    ];

    for (const [object, body, fields] of requiredCases) {
      const result = await request(`/api/records/${object}`, { method: "POST", body, expected: [400] });
      assert(result.error === "Complete this field.", `${object} required validation returned wrong error`);
      for (const field of fields)
        assert(result.fields?.includes(field), `${object} required validation missing ${field}`);
    }

    const unsupportedWorkflow = await request("/api/actions/knowledge/unsupported", {
      method: "POST",
      body: { object: "Knowledge__kav", selectedIds: [], values: {} },
      expected: [404]
    });
    assert(
      unsupportedWorkflow.error?.includes("Unknown Knowledge action"),
      "unknown domain action returned a false success"
    );
    const emptyBulkAction = await request("/api/actions/labels", {
      method: "POST",
      body: { object: "Lead", selectedIds: [], values: { label: "Must not apply" } },
      expected: [400]
    });
    assert(
      emptyBulkAction.error?.includes("Select at least one"),
      "destructive bulk workflow accepted an empty selection"
    );
    const invalidOpportunityAmount = await request("/api/records/Opportunity", {
      method: "POST",
      body: {
        name: "Invalid",
        accountId: "acc-robert",
        closeDate: "2026-08-20",
        amount: "-1",
        stage: "Qualify",
        probability: 101,
        forecastCategory: "Pipeline"
      },
      expected: [400]
    });
    assert(
      invalidOpportunityAmount.fields?.includes("amount") || invalidOpportunityAmount.fields?.includes("probability"),
      "Opportunity numeric validation did not return a field-level error"
    );
    const invalidKnowledgeUrl = await request("/api/records/Knowledge__kav", {
      method: "POST",
      body: { title: "Invalid URL", urlName: "Not a valid URL name" },
      expected: [400]
    });
    assert(
      invalidKnowledgeUrl.fields?.includes("urlName"),
      "Knowledge URL Name validation did not return a field-level error"
    );
    const webhook = await requestAnonymous("/api/email/webhooks/sendgrid", {
      method: "POST",
      body: [],
      expected: [200]
    });
    assert(webhook.ok === true, "SendGrid webhook should accept events when verification key is unset");
  });

  await check("metadata covers country/state dependencies and Event lookup objects", async () => {
    const metadata = await readFile("src/lib/crm-metadata/geographic.ts", "utf8");
    const component = await readFile("src/features/crm/form-controls.tsx", "utf8");

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
    for (const country of requiredCountries)
      assert(metadata.includes(`"${country}"`), `country list missing ${country}`);

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
      '"South Africa": ZA_PROVINCES',
      '"United Arab Emirates": AE_EMIRATES',
      '"United Kingdom": GB_COUNTIES',
      '"United States": US_STATES'
    ];
    for (const mapping of requiredStateMappings)
      assert(metadata.includes(mapping), `state dependency missing ${mapping}`);

    for (const lookup of ["Product2", "Pricebook2", "ListEmail", "Invoice", "Knowledge__kav"]) {
      assert(component.includes(`field.lookupObject === "${lookup}"`), `Event lookup support missing ${lookup}`);
    }
  });

  await check("shell and route-scoped lists expose seeded tenant data", async () => {
    const shell = await request("/api/shell");
    const accounts = await request("/api/records/Account?limit=50");
    const contacts = await request("/api/records/Contact?limit=50");
    assert(shell.user?.id === currentUserId, "shell did not return the current seeded user");
    assert(Array.isArray(shell.notifications), "shell notifications are not an array");
    assert(Array.isArray(shell.userPreferences), "shell user preferences are not an array");
    assert(
      accounts.items.some((account) => account.id === "acc-robert"),
      "seeded Robert account missing"
    );
    assert(
      contacts.items.some((contact) => contact.id === "con-rober-antonio"),
      "seeded Rober Antonio contact missing"
    );
    assert(typeof accounts.total === "number" && "nextCursor" in accounts, "account list pagination metadata missing");
  });

  await check("organization isolation rejects cross-tenant access", async () => {
    const isolatedOrganization = await prisma.organization.create({
      data: { name: `${tag} Isolated`, slug: `${tag}-isolated`.toLowerCase() }
    });
    const isolatedAccount = await prisma.account.create({
      data: {
        organizationId: isolatedOrganization.id,
        name: `${tag} Hidden Account`,
        ownerId: currentUserId,
        createdById: currentUserId,
        updatedById: currentUserId
      }
    });
    const isolatedProduct = await prisma.product.create({
      data: { organizationId: isolatedOrganization.id, name: `${tag} Hidden Product`, active: true }
    });
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
      data: {
        organizationId: isolatedOrganization.id,
        name: `${tag} Hidden Session`,
        status: "Open",
        channel: "Web Chat",
        ownerId: currentUserId,
        createdById: currentUserId
      }
    });
    const isolatedVideo = await prisma.videoCall.create({
      data: {
        organizationId: isolatedOrganization.id,
        name: `${tag} Hidden Call`,
        status: "Scheduled",
        provider: "External Link",
        scheduledStartAt: new Date("2026-08-01T10:00:00.000Z"),
        scheduledEndAt: new Date("2026-08-01T11:00:00.000Z"),
        organizerId: currentUserId,
        createdById: currentUserId
      }
    });
    const isolatedCampaign = await prisma.campaign.create({
      data: {
        organizationId: isolatedOrganization.id,
        name: `${tag} Hidden Campaign`,
        status: "Planned",
        ownerId: currentUserId,
        createdById: currentUserId
      }
    });
    const isolatedStore = await prisma.marketingStore.create({
      data: {
        organizationId: isolatedOrganization.id,
        name: `${tag} Hidden Store`,
        slug: `${tag}-hidden-store`,
        currency: "USD",
        status: "Draft",
        createdById: currentUserId
      }
    });
    const isolatedLandingPage = await prisma.marketingLandingPage.create({
      data: {
        organizationId: isolatedOrganization.id,
        name: `${tag} Hidden Form`,
        slug: `${tag}-hidden-form`,
        headline: "Hidden",
        fields: ["lastName", "email", "company"],
        ownerId: currentUserId,
        createdById: currentUserId
      }
    });
    try {
      const accounts = await request("/api/records/Account?limit=50");
      const invoices = await request("/api/records/Invoice?limit=50");
      assert(
        !accounts.items.some((record) => record.id === isolatedAccount.id),
        "account list leaked another organization's record"
      );
      assert(
        !invoices.items.some((record) => record.id === isolatedInvoice.id),
        "invoice list leaked another organization's record"
      );
      await request(`/api/marketing/landing-pages/${isolatedLandingPage.id}`, { expected: [404] });
      await request(`/api/invoices/${isolatedInvoice.id}`, { expected: [404] });
      await request(`/api/invoices/${isolatedInvoice.id}`, {
        method: "PATCH",
        body: { notes: "Cross tenant update" },
        expected: [404]
      });
      await request(`/api/invoices/${isolatedInvoice.id}`, { method: "DELETE", expected: [404] });
      await request(`/api/messaging-sessions/${isolatedMessaging.id}`, { expected: [404] });
      await request(`/api/messaging-sessions/${isolatedMessaging.id}`, {
        method: "PATCH",
        body: { name: "Cross tenant update" },
        expected: [404]
      });
      await request(`/api/messaging-sessions/${isolatedMessaging.id}`, { method: "DELETE", expected: [404] });
      await request(`/api/video-calls/${isolatedVideo.id}`, { expected: [404] });
      await request(`/api/video-calls/${isolatedVideo.id}`, {
        method: "PATCH",
        body: { notes: "Cross tenant update" },
        expected: [404]
      });
      await request(`/api/video-calls/${isolatedVideo.id}`, { method: "DELETE", expected: [404] });
      await request(`/api/campaigns/${isolatedCampaign.id}`, { expected: [404] });
      await request(`/api/campaigns/${isolatedCampaign.id}`, {
        method: "PATCH",
        body: { name: "Cross tenant update" },
        expected: [404]
      });
      await request(`/api/campaigns/${isolatedCampaign.id}`, { method: "DELETE", expected: [404] });
      await request(`/api/commerce/stores/${isolatedStore.id}`, { expected: [404] });
      await request(`/api/commerce/stores/${isolatedStore.id}`, {
        method: "PATCH",
        body: { name: "Cross tenant update" },
        expected: [404]
      });
      await request(`/api/commerce/stores/${isolatedStore.id}`, { method: "DELETE", expected: [404] });
      await request(`/api/marketing/landing-pages/${isolatedLandingPage.id}`, { expected: [404] });
      await request(`/api/marketing/landing-pages/${isolatedLandingPage.id}`, {
        method: "PATCH",
        body: { name: "Cross tenant update" },
        expected: [404]
      });
      await request(`/api/marketing/landing-pages/${isolatedLandingPage.id}`, { method: "DELETE", expected: [404] });
      await request(`/api/records/Account/${isolatedAccount.id}`, {
        method: "PATCH",
        body: { name: "Cross tenant update" },
        expected: [404]
      });
      await request(`/api/records/Account/${isolatedAccount.id}`, { method: "DELETE", expected: [404] });
      const isolatedInsight = await request("/api/ai/insights", {
        method: "POST",
        body: { surface: "activity", object: "Account", recordId: isolatedAccount.id },
        expected: [404]
      });
      assert(isolatedInsight.code === "record_not_found", "AI activity lookup exposed another organization's record");
      await request("/api/organizations/active", {
        method: "POST",
        body: { organizationId: isolatedOrganization.id },
        expected: [404]
      });
      await request("/api/actions/product-categories", {
        method: "POST",
        body: {
          object: "Product2",
          selectedIds: [isolatedProduct.id],
          values: { category: "Cross tenant category" }
        },
        expected: [404]
      });
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
    assert(
      sessions.appSessions?.some((session) => session.current),
      "current application session was not registered"
    );
    const result = await request("/api/account/sessions", { method: "POST", body: { action: "logout-others" } });
    assert(result.ok, "logout-others did not complete");
  });

  Object.assign(state, { account, contact, product, invoice });
}
