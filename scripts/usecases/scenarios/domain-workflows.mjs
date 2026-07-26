export async function runDomainWorkflowsScenarios(context, state) {
  const {
    assert,
    check,
    created,
    currentUserId,
    organizationId,
    postRecord,
    prisma,
    request,
    remember,
    tag,
    workflow
  } = context;
  let { account, contact, lead, opportunity, caseA, caseB, product, event, knowledge } = state;

  await check("bulk list and sales workflows", async () => {
    const labelResult = await workflow("Assign Label", "Contact", [contact.id], {
      label: `${tag} Label`,
      color: "blue"
    });
    labelResult.labels?.forEach((label) => remember("labels", label));
    assert(labelResult.labels?.length === 1, "Assign Label did not return one label");

    const campaignResult = await workflow("Add to Campaign", "Contact", [contact.id], {
      campaign: `${tag} Campaign`,
      status: "Sent"
    });
    remember("campaigns", campaignResult.campaign);
    assert(campaignResult.campaignMembers?.length === 1, "Add to Campaign did not return one member");

    const ownerResult = await workflow("Change Owner", "Lead", [lead.id], { ownerId: currentUserId });
    assert(ownerResult.records?.[0]?.ownerId === currentUserId, "Change Owner did not update lead owner");

    const productCategoryResult = await workflow("Add to Category", "Product2", [product.id], {
      category: `${tag} Category`
    });
    assert(
      productCategoryResult.records?.[0]?.category === `${tag} Category`,
      "Add to Category did not return categorized product"
    );
    const categorizedProduct = await prisma.product.findUnique({ where: { id: product.id } });
    assert(categorizedProduct?.category === `${tag} Category`, "Add to Category did not persist product category");

    const convertLead = await postRecord(
      "Lead",
      {
        status: "New",
        firstName: "Convert",
        lastName: `${tag} Convert`,
        company: `${tag} Convert Co`,
        email: `convert-${tag}@example.com`
      },
      "leads"
    );
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
    assert(
      persistedConversion?.convertedAccountId === conversion.accounts[0].id,
      "Convert Lead did not persist the converted Account link"
    );
    assert(
      persistedConversion?.convertedContactId === conversion.contacts[0].id,
      "Convert Lead did not persist the converted Contact link"
    );
    assert(
      persistedConversion?.convertedOpportunityId === conversion.opportunities[0].id,
      "Convert Lead did not persist the converted Opportunity link"
    );
    await request("/api/actions/lead-conversion", {
      method: "POST",
      body: { object: "Lead", selectedIds: [convertLead.id], values: {} },
      expected: [409]
    });
    await request(`/api/records/Lead/${convertLead.id}`, { method: "PATCH", body: { status: "New" }, expected: [409] });
    await request(`/api/records/Lead/${convertLead.id}`, { method: "DELETE", expected: [409] });
    const convertedLeadHtml = await request(`/lightning/r/Lead/${convertLead.id}/view`);
    for (const fragment of [
      "Conversion Date",
      "Converted Leads are read-only",
      conversion.accounts[0].name,
      conversion.opportunities[0].name
    ]) {
      assert(convertedLeadHtml.includes(fragment), `converted Lead detail missing ${fragment}`);
    }

    // Segment fields used to be dropped on conversion; they must now reach the created records.
    const mappingLead = await postRecord(
      "Lead",
      {
        status: "New",
        firstName: "Mapping",
        lastName: `${tag} Mapping`,
        company: `${tag} Mapping Co`,
        email: `mapping-${tag}@example.com`,
        phone: "+1 (415) 555-0142",
        rating: "Hot",
        leadSource: "Web",
        industry: "Technology",
        numberOfEmployees: 250,
        annualRevenue: "4200000"
      },
      "leads"
    );
    const mappingConversion = await workflow("Convert Lead", "Lead", [mappingLead.id], {
      accountName: `${tag} Mapping Account`,
      opportunityName: `${tag} Mapping Opportunity`,
      createOpportunity: true,
      amount: "75000",
      stage: "Propose",
      forecastCategory: "Best Case",
      closeDate: "2026-10-15",
      convertedStatus: "Qualified"
    });
    mappingConversion.accounts?.forEach((record) => remember("accounts", record));
    mappingConversion.contacts?.forEach((record) => remember("contacts", record));
    mappingConversion.opportunities?.forEach((record) => remember("opportunities", record));
    const mappedAccount = await prisma.account.findUnique({ where: { id: mappingConversion.accounts[0].id } });
    assert(mappedAccount?.industry === "Technology", "Convert Lead did not carry industry onto the account");
    assert(mappedAccount?.rating === "Hot", "Convert Lead did not carry rating onto the account");
    assert(mappedAccount?.numberOfEmployees === 250, "Convert Lead did not carry employee count onto the account");
    assert(
      Number(mappedAccount?.annualRevenue) === 4200000,
      "Convert Lead did not carry annual revenue onto the account"
    );
    const mappedContact = await prisma.contact.findUnique({ where: { id: mappingConversion.contacts[0].id } });
    assert(mappedContact?.leadSource === "Web", "Convert Lead did not carry lead source onto the contact");
    const mappedOpportunity = await prisma.opportunity.findUnique({
      where: { id: mappingConversion.opportunities[0].id }
    });
    assert(Number(mappedOpportunity?.amount) === 75000, "Convert Lead ignored the opportunity amount");
    assert(mappedOpportunity?.stage === "Propose", "Convert Lead ignored the chosen stage");
    assert(mappedOpportunity?.forecastCategory === "Best Case", "Convert Lead ignored the chosen forecast category");
    assert(mappedOpportunity?.probability === 50, "Convert Lead did not derive probability from the stage");
    assert(mappedOpportunity?.leadSource === "Web", "Convert Lead did not carry lead source onto the opportunity");

    // A converted lead is read-only, so its history has to follow the new contact.
    const historyLead = await postRecord(
      "Lead",
      {
        status: "New",
        firstName: "History",
        lastName: `${tag} History`,
        company: `${tag} History Co`,
        email: `history-${tag}@example.com`
      },
      "leads"
    );
    const historyTask = remember(
      "tasks",
      await prisma.task.create({
        data: {
          organizationId,
          subject: `${tag} Lead Task`,
          status: "Not Started",
          priority: "Normal",
          ownerId: currentUserId,
          relatedObjectType: "Lead",
          relatedRecordId: historyLead.id
        }
      })
    );
    // The activity dialogs write the plural spelling, record pages write the singular one.
    const historyEvent = remember(
      "events",
      await prisma.event.create({
        data: {
          organizationId,
          subject: `${tag} Lead Event`,
          startAt: new Date("2026-08-01T10:00:00.000Z"),
          endAt: new Date("2026-08-01T11:00:00.000Z"),
          assignedToId: currentUserId,
          relatedObjectType: "Leads",
          relatedRecordId: historyLead.id,
          nameObjectType: "Leads",
          nameRecordId: historyLead.id
        }
      })
    );
    const sharedCampaignName = `${tag} Shared Campaign`;
    await workflow("Add to Campaign", "Lead", [historyLead.id], { campaign: sharedCampaignName, status: "Sent" });
    await workflow("Assign Label", "Lead", [historyLead.id], { label: `${tag} Priority`, color: "blue" });
    const sharedCampaign = await prisma.campaign.findFirst({ where: { organizationId, name: sharedCampaignName } });
    assert(sharedCampaign, "Add to Campaign did not create the shared campaign");
    remember("campaigns", sharedCampaign);
    // Pre-load the target contact into the same campaign so the move hits the unique constraint.
    const historyContact = await postRecord(
      "Contact",
      {
        lastName: `${tag} History`,
        accountId: account.id,
        email: `history-contact-${tag}@example.com`
      },
      "contacts"
    );
    await workflow("Add to Campaign", "Contact", [historyContact.id], { campaign: sharedCampaignName, status: "Sent" });

    const historyConversion = await workflow("Convert Lead", "Lead", [historyLead.id], {
      existingContactId: historyContact.id,
      accountName: `${tag} History Account`,
      createOpportunity: false,
      convertedStatus: "Qualified"
    });
    historyConversion.accounts?.forEach((record) => remember("accounts", record));
    assert(historyConversion.opportunities?.length === 0, "createOpportunity:false still created an opportunity");
    const reparentedTask = await prisma.task.findUnique({ where: { id: historyTask.id } });
    assert(
      reparentedTask?.relatedObjectType === "Contact" && reparentedTask?.relatedRecordId === historyContact.id,
      "Convert Lead stranded the task on the converted lead"
    );
    const reparentedEvent = await prisma.event.findUnique({ where: { id: historyEvent.id } });
    assert(
      reparentedEvent?.relatedObjectType === "Contacts" && reparentedEvent?.relatedRecordId === historyContact.id,
      "Convert Lead stranded the plural-typed event"
    );
    assert(
      reparentedEvent?.nameObjectType === "Contacts" && reparentedEvent?.nameRecordId === historyContact.id,
      "Convert Lead did not move the event Name link"
    );
    const remainingLeadMembers = await prisma.campaignMember.count({
      where: { organizationId, objectType: "Lead", recordId: historyLead.id }
    });
    assert(remainingLeadMembers === 0, "Convert Lead left campaign members on the lead");
    const contactMembers = await prisma.campaignMember.count({
      where: { organizationId, campaignId: sharedCampaign.id, objectType: "Contact", recordId: historyContact.id }
    });
    assert(contactMembers === 1, "Convert Lead duplicated a campaign membership instead of dropping the collision");
    const movedLabels = await prisma.recordLabel.count({
      where: { organizationId, objectType: "Contact", recordId: historyContact.id, label: `${tag} Priority` }
    });
    assert(movedLabels === 1, "Convert Lead did not move the record label onto the contact");

    // Account dedup must ignore case rather than creating a near-duplicate account.
    const dedupeLead = await postRecord(
      "Lead",
      {
        status: "New",
        lastName: `${tag} Dedupe`,
        company: `${tag} Mapping Co`,
        email: `dedupe-${tag}@example.com`
      },
      "leads"
    );
    const dedupeConversion = await workflow("Convert Lead", "Lead", [dedupeLead.id], {
      accountName: `${tag} mapping account`,
      createOpportunity: false,
      convertedStatus: "Qualified"
    });
    dedupeConversion.contacts?.forEach((record) => remember("contacts", record));
    assert(
      dedupeConversion.accounts?.[0]?.id === mappingConversion.accounts[0].id,
      "Convert Lead created a case-variant duplicate account"
    );

    // Existing account and opportunity are re-pointed rather than duplicated.
    const reuseAccount = await postRecord("Account", { name: `${tag} Reuse Account`, type: "Prospect" }, "accounts");
    const reuseOpportunity = await postRecord(
      "Opportunity",
      {
        name: `${tag} Reuse Opportunity`,
        accountId: reuseAccount.id,
        closeDate: "2026-11-01",
        stage: "Qualify",
        forecastCategory: "Pipeline"
      },
      "opportunities"
    );
    const reuseLead = await postRecord(
      "Lead",
      {
        status: "New",
        lastName: `${tag} Reuse`,
        company: `${tag} Reuse Co`,
        email: `reuse-${tag}@example.com`
      },
      "leads"
    );
    const reuseConversion = await workflow("Convert Lead", "Lead", [reuseLead.id], {
      existingAccountId: reuseAccount.id,
      existingOpportunityId: reuseOpportunity.id,
      createOpportunity: true,
      convertedStatus: "Qualified"
    });
    reuseConversion.contacts?.forEach((record) => remember("contacts", record));
    assert(reuseConversion.accounts?.[0]?.id === reuseAccount.id, "Convert Lead did not reuse the selected account");
    assert(
      reuseConversion.opportunities?.[0]?.id === reuseOpportunity.id,
      "Convert Lead did not reuse the selected opportunity"
    );
    const reusedOpportunity = await prisma.opportunity.findUnique({ where: { id: reuseOpportunity.id } });
    assert(
      reusedOpportunity?.contactId === reuseConversion.contacts[0].id,
      "Convert Lead did not re-point the reused opportunity at the new contact"
    );

    // Bulk conversion derives each account from its own lead.
    const bulkLeads = [];
    for (const index of [1, 2]) {
      bulkLeads.push(
        await postRecord(
          "Lead",
          {
            status: "New",
            lastName: `${tag} Bulk ${index}`,
            company: `${tag} Bulk Co ${index}`,
            email: `bulk-${index}-${tag}@example.com`
          },
          "leads"
        )
      );
    }
    const bulkConversion = await workflow(
      "Convert Lead",
      "Lead",
      bulkLeads.map((lead) => lead.id),
      {
        createOpportunity: true,
        convertedStatus: "Qualified"
      }
    );
    bulkConversion.accounts?.forEach((record) => remember("accounts", record));
    bulkConversion.contacts?.forEach((record) => remember("contacts", record));
    bulkConversion.opportunities?.forEach((record) => remember("opportunities", record));
    assert(bulkConversion.accounts?.length === 2, "Bulk Convert Lead did not create one account per lead");
    assert(bulkConversion.opportunities?.length === 2, "Bulk Convert Lead did not create one opportunity per lead");
    const bulkNames = bulkConversion.accounts.map((record) => record.name).sort();
    assert(
      bulkNames[0] === `${tag} Bulk Co 1` && bulkNames[1] === `${tag} Bulk Co 2`,
      "Bulk Convert Lead ignored each lead's own company"
    );

    // Bad input must be rejected with a 400 rather than persisting or blowing up as a 500.
    const rejectLead = await postRecord(
      "Lead",
      {
        status: "New",
        lastName: `${tag} Reject`,
        company: `${tag} Reject Co`,
        email: `reject-${tag}@example.com`
      },
      "leads"
    );
    for (const badValues of [
      { convertedStatus: "Banana" },
      { closeDate: "not-a-date" },
      { stage: "Banana" },
      { forecastCategory: "Banana" },
      { amount: "-10" },
      { contact: { lastName: "  " } },
      { contact: { email: "nope" } }
    ]) {
      await request("/api/actions/lead-conversion", {
        method: "POST",
        body: { object: "Lead", selectedIds: [rejectLead.id], values: badValues },
        expected: [400]
      });
    }
    const stillUnconverted = await prisma.lead.findUnique({ where: { id: rejectLead.id } });
    assert(!stillUnconverted?.convertedAt, "A rejected conversion still marked the lead as converted");

    const mergeTask = remember(
      "tasks",
      await prisma.task.create({
        data: {
          organizationId,
          subject: `${tag} Secondary Case Task`,
          status: "Not Started",
          priority: "Normal",
          ownerId: currentUserId,
          relatedObjectType: "Case",
          relatedRecordId: caseB.id
        }
      })
    );

    const mergeResult = await workflow("Merge Cases", "Case", [caseA.id, caseB.id], { primaryCase: caseA.id });
    assert(mergeResult.ok, "Merge Cases did not complete");
    const closedCase = await prisma.caseRecord.findUnique({ where: { id: caseB.id } });
    assert(closedCase?.status === "Closed", "Merge Cases did not close the secondary case");
    const movedTask = await prisma.task.findUnique({ where: { id: mergeTask.id } });
    assert(movedTask?.relatedRecordId === caseA.id, "Merge Cases did not preserve and re-parent related activity");
  });

  await check("knowledge lifecycle workflows", async () => {
    const [concurrentArticleA, concurrentArticleB] = await Promise.all([
      request("/api/records/Knowledge__kav", {
        method: "POST",
        body: {
          title: `${tag} Concurrent Knowledge A`,
          urlName: `${tag}-concurrent-knowledge-a`,
          bodyRichText: "<p>A</p>"
        },
        expected: [201]
      }),
      request("/api/records/Knowledge__kav", {
        method: "POST",
        body: {
          title: `${tag} Concurrent Knowledge B`,
          urlName: `${tag}-concurrent-knowledge-b`,
          bodyRichText: "<p>B</p>"
        },
        expected: [201]
      })
    ]);
    remember("knowledgeArticles", concurrentArticleA.record);
    remember("knowledgeArticles", concurrentArticleB.record);
    assert(
      /^KA-\d{6}$/.test(concurrentArticleA.record.articleNumber),
      "Knowledge article number did not use the expected sequence format"
    );
    assert(
      concurrentArticleA.record.articleNumber !== concurrentArticleB.record.articleNumber,
      "concurrent Knowledge creation allocated a duplicate article number"
    );
    await request("/api/records/Knowledge__kav", {
      method: "POST",
      body: { title: `${tag} Duplicate URL`, urlName: knowledge.urlName },
      expected: [409]
    });

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

    const draft = await postRecord(
      "Knowledge__kav",
      {
        title: `${tag} Draft Delete`,
        urlName: `${tag}-draft-delete`,
        bodyRichText: "<p>Draft delete</p>"
      },
      "knowledgeArticles"
    );
    await workflow("Delete Draft", "Knowledge__kav", [draft.id], {});
    const deletedDraft = await prisma.knowledgeArticle.findUnique({ where: { id: draft.id } });
    assert(!deletedDraft, "Delete Draft did not remove draft article");
    created.knowledgeArticles = created.knowledgeArticles.filter((id) => id !== draft.id);
  });

  Object.assign(state, { account, contact, lead, opportunity, caseA, caseB, product, event, knowledge });
}
