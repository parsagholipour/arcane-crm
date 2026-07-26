export async function runRecordsScenarios(context, state) {
  const {
    assert,
    check,
    currentUserId,
    organizationId,
    patchRecord,
    postRecord,
    prisma,
    request,
    remember,
    tag,
    utility,
    workflow
  } = context;
  let {
    account,
    contact,
    lead,
    opportunity,
    caseA,
    caseB,
    product,
    priceBook,
    event,
    quickTextFolder,
    quickText,
    knowledge,
    listEmail
  } = state;

  await check("record create and update flows", async () => {
    account = await postRecord(
      "Account",
      {
        name: `${tag} Account`,
        type: "Prospect",
        phone: "555-0100",
        billingCountry: "United States",
        billingState: "California"
      },
      "accounts"
    );
    await patchRecord("Account", account.id, { phone: "555-0101" });

    contact = await postRecord(
      "Contact",
      {
        firstName: "Codex",
        lastName: `${tag} Contact`,
        accountId: account.id,
        email: `${tag}@example.com`,
        phone: "555-0102",
        birthDate: `1990-${String(new Date().getUTCMonth() + 1).padStart(2, "0")}-15`
      },
      "contacts"
    );
    await patchRecord("Contact", contact.id, { title: "QA Contact" });
    const invalidBirthdate = await request(`/api/records/Contact/${contact.id}`, {
      method: "PATCH",
      body: { birthDate: "not-a-date" },
      expected: [400]
    });
    assert(invalidBirthdate.fields?.includes("birthDate"), "Contact update accepted an invalid birthdate");

    lead = await postRecord(
      "Lead",
      {
        status: "New",
        firstName: "Codex",
        lastName: `${tag} Lead`,
        company: `${tag} Company`,
        email: `lead-${tag}@example.com`,
        country: "United States",
        state: "New York"
      },
      "leads"
    );
    await patchRecord("Lead", lead.id, { status: "Contacted" });

    opportunity = await postRecord(
      "Opportunity",
      {
        name: `${tag} Opportunity`,
        accountId: account.id,
        contactId: contact.id,
        closeDate: "2026-08-15",
        amount: "1234",
        stage: "Qualify",
        forecastCategory: "Pipeline"
      },
      "opportunities"
    );
    await patchRecord("Opportunity", opportunity.id, { stage: "Propose", probability: 40 });

    caseA = await postRecord(
      "Case",
      {
        status: "New",
        origin: "Email",
        priority: "High",
        accountId: account.id,
        contactId: contact.id,
        subject: `${tag} Case A`
      },
      "cases"
    );
    await patchRecord("Case", caseA.id, { status: "Working" });
    const closedCaseA = await patchRecord("Case", caseA.id, { status: "Closed" });
    assert(closedCaseA.closedAt, "closing a Case did not set its closed timestamp");
    const reopenedCaseA = await patchRecord("Case", caseA.id, { status: "Working" });
    assert(reopenedCaseA.closedAt === null, "reopening a Case did not clear its closed timestamp");

    caseB = await postRecord(
      "Case",
      {
        status: "New",
        origin: "Phone",
        priority: "Medium",
        accountId: account.id,
        contactId: contact.id,
        subject: `${tag} Case B`
      },
      "cases"
    );
    const [concurrentCaseA, concurrentCaseB] = await Promise.all([
      postRecord("Case", { status: "New", priority: "Low", subject: `${tag} Concurrent Case A` }, "cases"),
      postRecord("Case", { status: "New", priority: "Low", subject: `${tag} Concurrent Case B` }, "cases")
    ]);
    assert(/^\d{8}$/.test(concurrentCaseA.caseNumber), "Case number did not use the eight-digit sequence format");
    assert(
      concurrentCaseA.caseNumber !== concurrentCaseB.caseNumber,
      "concurrent Case creation allocated a duplicate number"
    );

    priceBook = await postRecord(
      "Pricebook2",
      {
        name: `${tag} Price Book`,
        active: true,
        description: "Use-case price book",
        validFrom: "2026-08-01",
        validFromTime: "09:00",
        validTo: "2026-12-31",
        validToTime: "17:00"
      },
      "priceBooks"
    );
    await patchRecord("Pricebook2", priceBook.id, { description: "Updated use-case price book" });

    product = await postRecord(
      "Product2",
      {
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
      },
      "products"
    );
    if (product.priceBookEntry?.id) remember("priceBookEntries", product.priceBookEntry);
    await patchRecord("Product2", product.id, { description: "Updated product" });

    const invalidEvent = await request("/api/records/Event", {
      method: "POST",
      body: {
        subject: "Meeting",
        startAt: "2026-08-20T10:00:00.000Z",
        endAt: "2026-08-20T09:00:00.000Z",
        assignedToId: currentUserId
      },
      expected: [400]
    });
    assert(invalidEvent.error?.includes("after its start"), "Event API accepted an end time before its start time");
    event = await postRecord(
      "Event",
      {
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
      },
      "events"
    );
    assert(event.reminderMinutes === 1440, "new events did not default to a 24-hour reminder");
    event = await patchRecord("Event", event.id, { reminderMinutes: null });
    assert(event.reminderMinutes === null, "explicitly disabling an event reminder did not persist");
    const invalidReminder = await request(`/api/records/Event/${event.id}`, {
      method: "PATCH",
      body: { reminderMinutes: -1 },
      expected: [400]
    });
    assert(
      invalidReminder.field === "reminderMinutes" || invalidReminder.fields?.includes("reminderMinutes"),
      "Event API did not identify the invalid reminder field"
    );
    await patchRecord("Event", event.id, { location: "Conference Room" });

    quickTextFolder = (await workflow("New Folder", "QuickText", [], { name: `${tag} Folder`, sharing: "Private" }))
      .folder;
    remember("quickTextFolders", quickTextFolder);
    quickText = await postRecord(
      "QuickText",
      {
        name: `${tag} Quick Text`,
        message: "Hello {!Contact.FirstName}",
        folderId: quickTextFolder.id,
        category: "Greetings",
        channels: ["Email", "Event"],
        mergeFields: ["Contact.FirstName"]
      },
      "quickTexts"
    );
    await patchRecord("QuickText", quickText.id, { message: "Updated {!Contact.FirstName}" });

    const favoriteResult = await utility("toggleQuickTextFavorite", {}, quickText.id);
    favoriteResult.quickTextFavorites?.forEach((favorite) => remember("quickTextFavorites", favorite));
    assert(favoriteResult.favorite === true, "Quick Text favorite was not created");
    const persistedFavorite = await prisma.quickTextFavorite.findUnique({
      where: {
        organizationId_userId_quickTextId: {
          organizationId,
          userId: currentUserId,
          quickTextId: quickText.id
        }
      }
    });
    assert(persistedFavorite?.quickTextId === quickText.id, "Quick Text favorite did not persist");
    const favoriteView = await request("/lightning/o/QuickText/home");
    assert(favoriteView.includes("All Favorites"), "Quick Text page omitted the persisted favorites view");

    knowledge = await postRecord(
      "Knowledge__kav",
      {
        title: `${tag} Knowledge`,
        urlName: `${tag}-knowledge`,
        summary: "Use-case article",
        bodyRichText: "<p>Use-case body</p>",
        visibleInInternalApp: true,
        visibleToCustomer: false
      },
      "knowledgeArticles"
    );
    await patchRecord("Knowledge__kav", knowledge.id, { summary: "Updated article" });

    listEmail = await postRecord(
      "ListEmail",
      {
        layoutType: "Sales",
        subject: `${tag} List Email`,
        body: "Use-case list email",
        recipientType: "Leads and Contacts",
        recipients: [lead.id, contact.id],
        status: "Draft"
      },
      "listEmails"
    );
    await patchRecord("ListEmail", listEmail.id, { subject: `${tag} List Email Draft` });

    const birthdayView = await request("/lightning/o/Contact/list?filterName=BirthdaysThisMonth");
    assert(
      birthdayView.includes("Birthdays This Month"),
      "Contact filterName did not select the requested standard list view"
    );
    assert(birthdayView.includes(contact.lastName), "Birthdays This Month did not include the matching Contact");
  });

  Object.assign(state, {
    account,
    contact,
    lead,
    opportunity,
    caseA,
    caseB,
    product,
    priceBook,
    event,
    quickTextFolder,
    quickText,
    knowledge,
    listEmail
  });
}
