export async function runRecordExperienceScenarios(context, state) {
  const {
    assert,
    check,
    currentUserId,
    organizationId,
    patchRecord,
    prisma,
    randomUUID,
    request,
    requestAnonymous,
    requestForm,
    requestRaw,
    remember,
    tag
  } = context;
  let { contact, lead, opportunity, caseA, event, knowledge, listEmail, invoice } = state;

  await check("record detail routes and customer Knowledge lifecycle", async () => {
    const leadHtml = await request(`/lightning/r/Lead/${lead.id}/view`);
    for (const fragment of [`${tag} Lead`, "Lead Details", "Convert", "Activity"])
      assert(leadHtml.includes(fragment), `Lead detail missing ${fragment}`);

    const opportunityHtml = await request(`/lightning/r/Opportunity/${opportunity.id}/view`);
    for (const fragment of [
      opportunity.name,
      "Opportunity Details",
      "Related Invoices",
      invoice.invoiceNumber,
      "Activity"
    ])
      assert(opportunityHtml.includes(fragment), `Opportunity detail missing ${fragment}`);

    const caseHtml = await request(`/lightning/r/Case/${caseA.id}/view`);
    for (const fragment of [caseA.caseNumber, "Case Details", "Related Records", "Activity"])
      assert(caseHtml.includes(fragment), `Case detail missing ${fragment}`);

    const trackedDelivery = remember(
      "emailDeliveries",
      await prisma.emailDelivery.create({
        data: {
          organizationId,
          trackingKey: randomUUID(),
          provider: "sendgrid",
          providerMessageId: `${tag}-provider`,
          sourceType: "ListEmail",
          sourceId: listEmail.id,
          recipient: contact.email,
          sender: "verified@example.com",
          subject: listEmail.subject,
          status: "Delivered",
          recordedById: currentUserId,
          acceptedAt: new Date(),
          deliveredAt: new Date(),
          lastEventAt: new Date()
        }
      })
    );
    remember(
      "emailDeliveryEvents",
      await prisma.emailDeliveryEvent.create({
        data: {
          organizationId,
          deliveryId: trackedDelivery.id,
          providerEventId: randomUUID(),
          providerMessageId: trackedDelivery.providerMessageId,
          eventType: "delivered",
          occurredAt: new Date(),
          raw: { event: "delivered", email: contact.email }
        }
      })
    );
    const deliveryApi = await request(`/api/email/deliveries?sourceType=ListEmail&sourceId=${listEmail.id}`);
    assert(
      deliveryApi.deliveries?.length === 1 && deliveryApi.deliveries[0].events?.length === 1,
      "tenant-scoped email delivery API omitted tracking history"
    );
    const listEmailHtml = await request(`/lightning/r/ListEmail/${listEmail.id}/view`);
    for (const fragment of [
      `${tag} List Email Draft`,
      "List Email",
      "Message",
      "Delivery Details",
      "Recipients (2)",
      "Provider Delivery Tracking (1)",
      "Delivered",
      contact.email
    ])
      assert(listEmailHtml.includes(fragment), `List Email detail missing ${fragment}`);
    const shell = await request("/api/shell");
    if (!shell.emailDeliveryConfigured)
      assert(
        listEmailHtml.includes("Email delivery is disabled"),
        "List Email detail did not disclose the provider limitation"
      );

    knowledge = await patchRecord("Knowledge__kav", knowledge.id, {
      visibleToCustomer: true,
      bodyRichText: `<p>${tag} public knowledge body</p>`
    });
    const published = await request(`/api/knowledge/${knowledge.id}/actions`, {
      method: "POST",
      body: { action: "publish" }
    });
    knowledge = published.article;
    published.notifications?.forEach((notification) => remember("notifications", notification));
    assert(
      knowledge.publicationStatus === "Published" && knowledge.publishedAt,
      "dedicated Knowledge publish action did not persist lifecycle timestamps"
    );

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { slug: true }
    });
    assert(organization?.slug, "active organization has no public slug");
    const publicPath = `/knowledge/${encodeURIComponent(organization.slug)}/${encodeURIComponent(knowledge.urlName)}`;
    const publicHtml = await requestAnonymous(publicPath);
    for (const fragment of [
      knowledge.title,
      "Help Center",
      `${tag} public knowledge body`,
      "Was this article helpful?"
    ])
      assert(publicHtml.includes(fragment), `public Knowledge article missing ${fragment}`);

    const feedbackResult = await requestAnonymous(
      `/api/knowledge/public/${encodeURIComponent(organization.slug)}/${encodeURIComponent(knowledge.urlName)}/feedback`,
      { method: "POST", body: { helpful: true, comment: `${tag} helpful article` } }
    );
    assert(feedbackResult.ok, "anonymous Knowledge feedback was not accepted");
    const feedback = await prisma.knowledgeFeedback.findFirst({
      where: { organizationId, articleId: knowledge.id, comment: `${tag} helpful article` }
    });
    assert(feedback, "anonymous Knowledge feedback was not persisted");
    remember("knowledgeFeedback", feedback);

    const internalKnowledge = await request(`/api/knowledge/${knowledge.id}`);
    assert(internalKnowledge.article.totalViewCount >= 1, "public Knowledge view was not counted");
    assert(
      internalKnowledge.metrics.helpful >= 1 && internalKnowledge.metrics.total >= 1,
      "internal Knowledge metrics omitted public feedback"
    );
    const knowledgeHtml = await request(`/lightning/r/Knowledge__kav/${knowledge.id}/view`);
    for (const fragment of [knowledge.title, "Article Content", "Customer Feedback", "Open customer article"])
      assert(knowledgeHtml.includes(fragment), `Knowledge detail missing ${fragment}`);

    const archived = await request(`/api/knowledge/${knowledge.id}/actions`, {
      method: "POST",
      body: { action: "archive" }
    });
    archived.notifications?.forEach((notification) => remember("notifications", notification));
    assert(
      archived.article.publicationStatus === "Archived" && archived.article.archivedAt,
      "Knowledge archive action did not persist lifecycle state"
    );
    await requestAnonymous(publicPath, { expected: [404] });
    const restored = await request(`/api/knowledge/${knowledge.id}/actions`, {
      method: "POST",
      body: { action: "restore" }
    });
    restored.notifications?.forEach((notification) => remember("notifications", notification));
    knowledge = restored.article;
    assert(
      knowledge.publicationStatus === "Draft" && !knowledge.archivedAt,
      "Knowledge restore action did not return the article to Draft"
    );
    await request(`/api/knowledge/${knowledge.id}/actions`, {
      method: "POST",
      body: { action: "restore" },
      expected: [409]
    });
  });

  await check("activity and file workflows", async () => {
    const invalidActivity = await request("/api/activity", {
      method: "POST",
      body: { type: "pretend", relatedObjectType: "Contact", relatedRecordId: contact.id },
      expected: [400]
    });
    assert(invalidActivity.error?.includes("activity type"), "unknown activity type was silently stored as a Task");
    const email = await request("/api/activity", {
      method: "POST",
      body: {
        type: "email",
        emailAction: "log",
        to: contact.email,
        subject: `${tag} Email`,
        body: "Email body",
        relatedObjectType: "Contact",
        relatedRecordId: contact.id
      },
      expected: [201]
    });
    remember("emailActivities", email.record);

    const call = await request("/api/activity", {
      method: "POST",
      body: {
        type: "call",
        subject: `${tag} Call`,
        comments: "Connected",
        relatedObjectType: "Contact",
        relatedRecordId: contact.id
      },
      expected: [201]
    });
    remember("callActivities", call.record);

    const task = await request("/api/activity", {
      method: "POST",
      body: {
        type: "task",
        subject: `${tag} Task`,
        dueDate: "2026-08-21",
        status: "Not Started",
        priority: "Normal",
        relatedObjectType: "Contact",
        relatedRecordId: contact.id
      },
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
    attachmentForm.set(
      "file",
      new Blob([`Attachment content ${tag}`], { type: "text/plain" }),
      `${tag}-attachment.txt`
    );
    attachmentForm.set("relatedObjectType", "Contact");
    attachmentForm.set("relatedRecordId", contact.id);
    attachmentForm.set("attachment", "true");
    const attachment = await requestForm("/api/files", attachmentForm, { expected: [201] });
    remember("attachments", attachment.record);

    assert(file.record.checksum?.length === 64, "file upload did not return a SHA-256 checksum");
    const downloaded = await requestRaw(`/api/files/${file.record.id}?kind=file`);
    const downloadedBytes = new Uint8Array(await downloaded.arrayBuffer());
    assert(downloaded.headers.get("content-type") === "application/pdf", "file download did not preserve content type");
    assert(
      downloaded.headers.get("content-disposition")?.startsWith("attachment"),
      "file download did not use attachment disposition"
    );
    assert(Buffer.from(downloadedBytes).equals(Buffer.from(fileBytes)), "file download bytes did not match the upload");
    const preview = await requestRaw(`/api/files/${file.record.id}?kind=file&disposition=inline`);
    assert(
      preview.headers.get("content-disposition")?.startsWith("inline"),
      "safe PDF preview was not rendered inline"
    );

    const rejectedMetadataUpload = await request("/api/files", {
      method: "POST",
      body: { name: `${tag}-fake.txt`, size: 10 },
      expected: [415]
    });
    assert(rejectedMetadataUpload.error?.includes("multipart"), "metadata-only upload was not rejected");

    const detail = await request(`/api/records/Contact/${contact.id}`);
    assert(
      detail.related.emails.some((item) => item.id === email.record.id),
      "email activity missing from record detail"
    );
    assert(
      detail.related.calls.some((item) => item.id === call.record.id),
      "call activity missing from record detail"
    );
    assert(
      detail.related.tasks.some((item) => item.id === task.record.id),
      "task missing from scoped record detail"
    );
    assert(
      detail.related.files.some((item) => item.id === file.record.id),
      "file missing from scoped record detail"
    );
    assert(
      detail.related.attachments.some((item) => item.id === attachment.record.id),
      "attachment missing from scoped record detail"
    );
    assert(
      !detail.related.files.find((item) => item.id === file.record.id)?.content,
      "record detail exposed stored file bytes"
    );
  });

  Object.assign(state, { contact, lead, opportunity, caseA, event, knowledge, listEmail, invoice });
}
