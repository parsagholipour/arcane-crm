export async function runPlatformResourcesScenarios(context, state) {
  const {
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
    request,
    requestRaw,
    remember,
    setOriginalLeadGuidanceState,
    tag,
    utility,
    workflow
  } = context;
  let { account, event } = state;

  await check("marketing, commerce, and utility workflows", async () => {
    const storeResult = await workflow("Create Store", "ListEmail", [], {
      name: `${tag} Store`,
      currency: "USD",
      status: "Draft"
    });
    remember("stores", storeResult.store);
    assert(storeResult.store?.name === `${tag} Store`, "Create Store did not create store");

    const activationResult = await workflow("Activate Marketing", "ListEmail", [], {
      senderName: `${tag} Sender`,
      senderEmail: `${tag}@example.com`,
      tracking: true
    });
    remember("marketingActivations", activationResult.activation);
    assert(activationResult.activation?.active === true, "Activate Marketing did not create an active activation");
    const editedActivation = await workflow("Activate Marketing", "ListEmail", [], {
      id: activationResult.activation.id,
      senderName: `${tag} Sender Updated`,
      senderEmail: `${tag}@example.com`,
      tracking: false
    });
    assert(
      editedActivation.activation?.id === activationResult.activation.id &&
        editedActivation.activation?.tracking === false,
      "Edit Activation created a duplicate instead of updating settings"
    );

    const partnerResult = await utility("createPartner", {
      accountId: account.id,
      name: `${tag} Partner`,
      role: "Integrator"
    });
    remember("partners", partnerResult.partner);

    const calendarResult = await utility("createCalendarSource", {
      name: `${tag} Calendar`,
      type: "My",
      color: "#0176d3",
      visible: true
    });
    remember("calendarSources", calendarResult.source);
    assert(
      calendarResult.source?.provider === "Local" && calendarResult.source?.connectionStatus === "Local",
      "calendar source did not disclose its local provider state"
    );
    event = await patchRecord("Event", event.id, { calendarSourceId: calendarResult.source.id });
    assert(event.calendarSourceId === calendarResult.source.id, "event was not assigned to its calendar source");
    const calendarHtml = await request("/lightning/o/Event/home");
    for (const fragment of ["Calendar", "Export .ics", `${tag} Calendar`])
      assert(calendarHtml.includes(fragment), `Calendar workspace missing ${fragment}`);
    const icsResponse = await requestRaw("/api/calendar/export");
    const icsText = await icsResponse.text();
    assert(
      icsResponse.headers.get("content-type")?.includes("text/calendar"),
      "calendar export did not return text/calendar"
    );
    assert(
      icsResponse.headers.get("content-disposition")?.includes("calendar.ics"),
      "calendar export filename was incorrect"
    );
    for (const fragment of ["BEGIN:VCALENDAR", "BEGIN:VEVENT", `${tag} event`, "END:VCALENDAR"])
      assert(icsText.includes(fragment), `calendar export missing ${fragment}`);
    const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const windowEnd = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString();
    const windowResponse = await request(
      `/api/calendar/events?start=${encodeURIComponent(windowStart)}&end=${encodeURIComponent(windowEnd)}`
    );
    assert(Array.isArray(windowResponse.items), "windowed calendar endpoint did not return an items array");
    await request(
      `/api/calendar/events?start=${encodeURIComponent(windowEnd)}&end=${encodeURIComponent(windowStart)}`,
      { expected: [400] }
    );
    await request(`/api/calendar/events?start=not-a-date&end=${encodeURIComponent(windowEnd)}`, { expected: [400] });

    const editedEvent = await patchRecord("Event", event.id, { subject: "Meeting", location: `${tag} Room` });
    assert(editedEvent.location === `${tag} Room`, "event edit did not persist through PATCH");

    const seriesStart = new Date(Date.now() + 24 * 60 * 60 * 1000);
    seriesStart.setUTCHours(9, 0, 0, 0);
    const seriesEnd = new Date(seriesStart.getTime() + 60 * 60 * 1000);
    const series = await postRecord(
      "Event",
      {
        subject: "Meeting",
        description: `${tag} standup`,
        startAt: seriesStart.toISOString(),
        endAt: seriesEnd.toISOString(),
        assignedToId: currentUserId,
        recurrenceRule: "FREQ=DAILY;COUNT=5",
        reminderMinutes: 15
      },
      "events"
    );
    assert(
      series.recurrenceRule === "FREQ=DAILY;COUNT=5" && series.reminderMinutes === 15,
      "recurrence and reminder fields did not persist on create"
    );
    await request("/api/records/Event", {
      method: "POST",
      body: {
        subject: "Meeting",
        startAt: seriesStart.toISOString(),
        endAt: seriesEnd.toISOString(),
        assignedToId: currentUserId,
        recurrenceRule: "FREQ=HOURLY"
      },
      expected: [400]
    });

    const expanded = await request(
      `/api/calendar/events?start=${encodeURIComponent(windowStart)}&end=${encodeURIComponent(windowEnd)}`
    );
    const seriesItems = expanded.items.filter((item) => item.id === series.id);
    assert(seriesItems.length === 5, `daily COUNT=5 series expanded to ${seriesItems.length} occurrences instead of 5`);
    assert(
      seriesItems.every((item) => item.recurring && item.occurrenceStart),
      "expanded occurrences did not carry recurrence identity"
    );

    const secondSlot = seriesItems[1].occurrenceStart;
    await request(`/api/records/Event/${series.id}`, {
      method: "PATCH",
      body: { subject: "Call", recurrenceScope: "single", occurrenceStart: secondSlot },
      expected: [200]
    });
    const afterSingleEdit = await request(
      `/api/calendar/events?start=${encodeURIComponent(windowStart)}&end=${encodeURIComponent(windowEnd)}`
    );
    const detached = afterSingleEdit.items.filter((item) => item.record?.recurrenceParentId === series.id);
    assert(
      detached.length === 1 && detached[0].title === "Call",
      "editing a single occurrence did not detach exactly one overridden event"
    );
    assert(
      afterSingleEdit.items.filter((item) => item.id === series.id).length === 4,
      "the detached slot was not removed from the series"
    );
    detached.forEach((item) => remember("events", item.record));

    const thirdSlot = seriesItems[2].occurrenceStart;
    await request(`/api/records/Event/${series.id}?scope=single&occurrenceStart=${encodeURIComponent(thirdSlot)}`, {
      method: "DELETE"
    });
    const afterSingleDelete = await request(
      `/api/calendar/events?start=${encodeURIComponent(windowStart)}&end=${encodeURIComponent(windowEnd)}`
    );
    assert(
      afterSingleDelete.items.filter((item) => item.id === series.id).length === 3,
      "deleting a single occurrence removed the wrong number of occurrences"
    );

    const seriesIcs = await (await requestRaw("/api/calendar/export")).text();
    for (const fragment of ["RRULE:FREQ=DAILY;COUNT=5", "EXDATE:", "BEGIN:VALARM", "TRIGGER:-PT15M"]) {
      assert(seriesIcs.includes(fragment), `calendar export missing ${fragment}`);
    }

    const reminderSweep = await request("/api/calendar/reminders", { method: "POST" });
    assert(reminderSweep.ok, "reminder sweep did not return ok");
    assert(Array.isArray(reminderSweep.notifications), "reminder sweep did not return a notifications array");

    await request(`/api/records/Event/${series.id}?scope=all`, { method: "DELETE" });
    created.events = created.events.filter((id) => id !== series.id);

    await utility(
      "updateCalendarSource",
      {
        id: calendarResult.source.id,
        name: `${tag} Calendar Updated`,
        type: "Other",
        color: "#2e844a",
        visible: false
      },
      calendarResult.source.id
    );
    await utility("deleteCalendarSource", { id: calendarResult.source.id }, calendarResult.source.id);
    const eventAfterCalendarDelete = await prisma.event.findUnique({ where: { id: event.id } });
    assert(
      eventAfterCalendarDelete?.calendarSourceId === null,
      "deleting a calendar source did not safely retain and unassign its events"
    );
    created.calendarSources = created.calendarSources.filter((id) => id !== calendarResult.source.id);

    const reportResult = await utility("saveCustomReport", {
      name: `${tag} Report`,
      object: "Lead",
      groupField: "status",
      columns: ["displayName", "company", "status"]
    });
    remember("customReports", reportResult.report);
    const dashboardResult = await utility("saveCustomDashboard", {
      name: `${tag} Dashboard`,
      reportIds: [reportResult.report.id]
    });
    remember("customDashboards", dashboardResult.dashboard);
    const updatedReport = await utility(
      "updateCustomReport",
      {
        name: `${tag} Report Updated`,
        object: "Lead",
        groupField: "rating",
        columns: ["displayName", "company", "rating"]
      },
      reportResult.report.id
    );
    assert(
      updatedReport.report?.name === `${tag} Report Updated` && updatedReport.report?.groupField === "rating",
      "saved report update did not persist"
    );
    const updatedDashboard = await utility(
      "updateCustomDashboard",
      { name: `${tag} Dashboard Updated`, reportIds: [reportResult.report.id] },
      dashboardResult.dashboard.id
    );
    assert(updatedDashboard.dashboard?.name === `${tag} Dashboard Updated`, "saved dashboard update did not persist");
    const analyticsHtml = await request(
      `/lightning/page/analytics?report=${encodeURIComponent(`${tag} Report Updated`)}`
    );
    for (const fragment of [`${tag} Report Updated`, `${tag} Dashboard Updated`, "Edit", "Export", "Saved Dashboards"])
      assert(analyticsHtml.includes(fragment), `Analytics workspace missing ${fragment}`);
    const reportExportForm = new FormData();
    reportExportForm.set("filename", `${tag} Forecast.csv`);
    reportExportForm.set("csv", '"Rating","Records"\n"Hot","1"');
    const reportExportResponse = await fetch(`${baseUrl}/api/analytics/export`, {
      method: "POST",
      headers: { Cookie: authCookie },
      body: reportExportForm
    });
    assert(reportExportResponse.status === 200, `report export returned ${reportExportResponse.status}`);
    assert(
      reportExportResponse.headers.get("content-type")?.includes("text/csv"),
      "report export did not return text/csv"
    );
    assert(
      reportExportResponse.headers.get("content-disposition") === `attachment; filename="${tag}-forecast.csv"`,
      "report export filename was not constrained"
    );
    assert((await reportExportResponse.text()).includes('"Hot","1"'), "report export did not preserve the CSV rows");
    await utility("deleteCustomDashboard", {}, dashboardResult.dashboard.id);
    await utility("deleteCustomReport", {}, reportResult.report.id);
    assert(
      !(await prisma.customDashboard.findUnique({ where: { id: dashboardResult.dashboard.id } })),
      "saved dashboard delete did not persist"
    );
    assert(
      !(await prisma.customReport.findUnique({ where: { id: reportResult.report.id } })),
      "saved report delete did not persist"
    );
    created.customDashboards = created.customDashboards.filter((id) => id !== dashboardResult.dashboard.id);
    created.customReports = created.customReports.filter((id) => id !== reportResult.report.id);

    const notificationResult = await utility("createNotification", {
      title: `${tag} Notification`,
      body: "Use-case notification",
      category: tag,
      href: "/lightning/page/home"
    });
    remember("notifications", notificationResult.notification);
    await utility("markNotificationRead", {}, notificationResult.notification.id);
    const preferenceResult = await utility("updateNotificationPreference", { category: tag, enabled: false });
    remember("notificationPreferences", preferenceResult.preference);

    const setupResult = await utility("updateSetupShortcutState", {
      shortcutId: tag,
      pinned: true,
      lastOpenedAt: "2026-08-01T00:00:00.000Z"
    });
    remember("setupShortcutStates", setupResult.state);
    const helpResult = await utility("updateHelpArticleState", {
      articleId: tag,
      saved: true,
      helpful: true,
      viewedAt: "2026-08-01T00:00:00.000Z"
    });
    remember("helpArticleStates", helpResult.state);
    const originalLeadGuidanceState = await prisma.userGuidanceState.findFirst({
      where: { organizationId, userId: currentUserId, itemId: "lead" }
    });
    setOriginalLeadGuidanceState(originalLeadGuidanceState);
    const guidanceResult = await utility("updateGuidance", { status: "DONE" }, "lead");
    if (!originalLeadGuidanceState) remember("guidanceStates", guidanceResult.state);

    const appNavResult = await utility("updateAppNavPreference", {
      app: "home",
      items: [
        { label: "Home", href: "/lightning/page/home" },
        { label: `${tag} Nav`, href: "/lightning/o/Lead/list", object: "Lead" }
      ]
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
    created.listViewPreferences = created.listViewPreferences.filter(
      (id) => id !== listViewResult.listViewPreference.id
    );

    const searchResult = await utility("saveGlobalSearchRecent", {
      href: `/lightning/o/Lead/list?search=${tag}`,
      label: tag,
      context: "Lead",
      category: "Record",
      query: tag
    });
    remember("globalSearchRecents", searchResult.recent);

    const invalidChat = await request("/api/ai/chat", {
      method: "POST",
      body: { message: "", pathname: "/lightning/page/home" },
      expected: [400]
    });
    assert(invalidChat.code === "invalid_request", "AI chat did not validate an empty message before provider access");
    const oversizedChat = await request("/api/ai/chat", {
      method: "POST",
      body: { message: "x".repeat(2001), pathname: "/lightning/page/home" },
      expected: [400]
    });
    assert(oversizedChat.code === "invalid_request", "AI chat did not enforce its 2,000-character prompt limit");
    const invalidInsight = await request("/api/ai/insights", {
      method: "POST",
      body: { surface: "unknown" },
      expected: [400]
    });
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
      await prisma.agentforceMessage.deleteMany({
        where: { organizationId, userId: currentUserId, text: { in: rateLimitTexts } }
      });
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
        body: {
          message: "Draft a concise follow-up email for Rober Antonio about next steps.",
          pathname: "/lightning/r/Contact/con-rober-antonio/view"
        },
        expected: [200]
      });
      draftResult.messages?.forEach((message) => remember("agentforceMessages", message));
      const draft = draftResult.messages?.[1]?.metadata?.draft;
      assert(draft?.subject && draft?.body, "Agentforce did not return a follow-up draft");
      assert(
        draft?.recipientIds?.includes("con-rober-antonio"),
        "Agentforce did not securely resolve the draft recipient"
      );

      const homeInsight = await request("/api/ai/insights", {
        method: "POST",
        body: { surface: "home" },
        expected: [200]
      });
      assert(homeInsight.payload?.summary, "Home AI did not return a summary");
      const cachedHomeInsight = await request("/api/ai/insights", {
        method: "POST",
        body: { surface: "home" },
        expected: [200]
      });
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

  Object.assign(state, { account, event });
}
