export async function runCommunicationsScenarios(context, state) {
  const { assert, check, created, currentUserId, request, remember, tag } = context;
  let { account, contact, opportunity } = state;

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
    createdSession.session.participants?.forEach(
      (participant) => remember("messagingSessions", { id: session.id }) || participant
    );
    createdSession.notifications?.forEach((notification) => remember("notifications", notification));
    assert(
      session.status === "Open" && session.participants.length === 1,
      "messaging session did not create its participant aggregate"
    );

    const updated = await request(`/api/messaging-sessions/${session.id}`, {
      method: "PATCH",
      body: { subject: "Updated implementation follow-up", ownerId: currentUserId }
    });
    assert(updated.session.subject === "Updated implementation follow-up", "messaging session edit did not persist");
    const inbound = await request(`/api/messaging-sessions/${session.id}/messages`, {
      method: "POST",
      body: {
        direction: "Inbound",
        senderName: "Customer",
        body: `${tag} inbound transcript entry`,
        sentAt: "2026-08-01T09:00:00.000Z"
      },
      expected: [201]
    });
    remember("messagingMessages", inbound.message);
    inbound.notifications?.forEach((notification) => remember("notifications", notification));
    assert(inbound.message.status === "Received", "inbound message did not receive the correct truthful status");
    const outbound = await request(`/api/messaging-sessions/${session.id}/messages`, {
      method: "POST",
      body: { direction: "Outbound", senderName: "Agent", body: `${tag} externally sent reply`, deliver: false },
      expected: [201]
    });
    remember("messagingMessages", outbound.message);
    assert(
      outbound.message.status === "Recorded" && !outbound.delivery,
      "record-only outbound message claimed provider delivery"
    );

    await request(`/api/messaging-sessions/${session.id}/actions`, { method: "POST", body: { action: "wait" } });
    await request(`/api/messaging-sessions/${session.id}/actions`, { method: "POST", body: { action: "resume" } });
    const closed = await request(`/api/messaging-sessions/${session.id}/actions`, {
      method: "POST",
      body: { action: "close" }
    });
    closed.notifications?.forEach((notification) => remember("notifications", notification));
    assert(
      closed.session.status === "Closed" && closed.session.endedAt,
      "closing a messaging session did not set lifecycle fields"
    );
    await request(`/api/messaging-sessions/${session.id}/messages`, {
      method: "POST",
      body: { direction: "Inbound", body: "Must fail" },
      expected: [409]
    });
    await request(`/api/messaging-sessions/${session.id}`, { method: "DELETE", expected: [409] });
    const reopened = await request(`/api/messaging-sessions/${session.id}/actions`, {
      method: "POST",
      body: { action: "reopen" }
    });
    assert(
      reopened.session.status === "Open" && reopened.session.endedAt === null,
      "reopen did not restore an Open session"
    );

    const detail = await request(`/api/messaging-sessions/${session.id}`);
    assert(detail.session.messages.length === 2, "messaging detail omitted transcript history");
    const list = await request("/api/messaging-sessions");
    assert(
      list.sessions.some((item) => item.id === session.id),
      "messaging list omitted created session"
    );
    const listHtml = await request("/lightning/o/MessagingSession/list");
    for (const fragment of ["Messaging Sessions", "New", "Channel", "Last Message", session.name])
      assert(listHtml.includes(fragment), `messaging list missing ${fragment}`);
    const detailHtml = await request(`/lightning/r/MessagingSession/${session.id}/view`);
    for (const fragment of [session.name, "Session Details", "Participants", "Conversation", "Record Message"])
      assert(detailHtml.includes(fragment), `messaging detail missing ${fragment}`);

    const disposable = await request("/api/messaging-sessions", {
      method: "POST",
      body: { name: `${tag} Empty Session`, channel: "Web Chat", ownerId: currentUserId },
      expected: [201]
    });
    remember("messagingSessions", disposable.session);
    disposable.notifications?.forEach((notification) => remember("notifications", notification));
    await request(`/api/messaging-sessions/${disposable.session.id}`, { method: "DELETE" });
    created.messagingSessions = created.messagingSessions.filter((id) => id !== disposable.session.id);
  });

  await check("video call CRUD, attendance, lifecycle, provider links, and UI", async () => {
    const invalidDates = await request("/api/video-calls", {
      method: "POST",
      body: {
        name: `${tag} Invalid Call`,
        scheduledStartAt: "2026-08-01T11:00:00.000Z",
        scheduledEndAt: "2026-08-01T10:00:00.000Z"
      },
      expected: [400]
    });
    assert(invalidDates.error?.includes("after"), "video call did not validate its date range");
    const createdCall = await request("/api/video-calls", {
      method: "POST",
      body: {
        name: `${tag} Customer Review`,
        provider: "Google Meet",
        meetingUrl: "https://meet.google.com/example-room",
        scheduledStartAt: "2026-08-01T10:00:00.000Z",
        scheduledEndAt: "2026-08-01T11:00:00.000Z",
        accountId: account.id,
        contactId: contact.id,
        opportunityId: opportunity.id,
        organizerId: currentUserId,
        participants: [{ contactId: contact.id, role: "Attendee" }],
        notifyParticipants: false
      },
      expected: [201]
    });
    const videoCall = remember("videoCalls", createdCall.videoCall);
    createdCall.videoCall.participants?.forEach((participant) => remember("videoCallParticipants", participant));
    createdCall.notifications?.forEach((notification) => remember("notifications", notification));
    assert(
      videoCall.status === "Scheduled" && videoCall.meetingUrl.startsWith("https://"),
      "video call did not preserve its real provider link"
    );
    const participant = videoCall.participants[0];
    const attendance = await request(`/api/video-calls/${videoCall.id}/actions`, {
      method: "POST",
      body: { action: "attendance", participantId: participant.id, attendance: "Accepted" }
    });
    assert(attendance.videoCall.participants[0].attendance === "Accepted", "video-call attendance did not update");
    const updated = await request(`/api/video-calls/${videoCall.id}`, {
      method: "PATCH",
      body: { notes: `${tag} agenda ready`, organizerId: currentUserId }
    });
    assert(updated.videoCall.notes === `${tag} agenda ready`, "video-call edit did not persist");
    const started = await request(`/api/video-calls/${videoCall.id}/actions`, {
      method: "POST",
      body: { action: "start" }
    });
    assert(
      started.videoCall.status === "In Progress" && started.videoCall.startedAt,
      "video-call start transition failed"
    );
    const completed = await request(`/api/video-calls/${videoCall.id}/actions`, {
      method: "POST",
      body: { action: "complete" }
    });
    completed.notifications?.forEach((notification) => remember("notifications", notification));
    assert(
      completed.videoCall.status === "Completed" && completed.videoCall.endedAt,
      "video-call completion transition failed"
    );
    const terminalNotes = await request(`/api/video-calls/${videoCall.id}`, {
      method: "PATCH",
      body: { notes: `${tag} completed notes`, recordingUrl: "https://example.com/recording" }
    });
    assert(
      terminalNotes.videoCall.notes === `${tag} completed notes`,
      "completed video-call notes could not be updated"
    );
    await request(`/api/video-calls/${videoCall.id}`, {
      method: "PATCH",
      body: { name: "Forbidden terminal edit" },
      expected: [409]
    });
    await request(`/api/video-calls/${videoCall.id}`, { method: "DELETE", expected: [409] });

    const list = await request("/api/video-calls");
    assert(
      list.videoCalls.some((item) => item.id === videoCall.id),
      "video-call list omitted created call"
    );
    const listHtml = await request("/lightning/o/VideoCall/list");
    for (const fragment of ["Video Calls", "New", "Scheduled Start", "Organizer", videoCall.name])
      assert(listHtml.includes(fragment), `video-call list missing ${fragment}`);
    const detailHtml = await request(`/lightning/r/VideoCall/${videoCall.id}/view`);
    for (const fragment of [videoCall.name, "Schedule", "Related Records", "Participants", "Description &amp; Notes"])
      assert(detailHtml.includes(fragment), `video-call detail missing ${fragment}`);

    const disposable = await request("/api/video-calls", {
      method: "POST",
      body: {
        name: `${tag} Disposable Call`,
        scheduledStartAt: "2026-08-02T10:00:00.000Z",
        scheduledEndAt: "2026-08-02T11:00:00.000Z",
        organizerId: currentUserId
      },
      expected: [201]
    });
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
    assert(
      campaign.status === "Planned" && campaign.type === "Webinar",
      "campaign did not start as Planned with its selected type"
    );
    assert(Number(campaign.budgetedCost) === 1000.5, "campaign budget was not persisted as a decimal");

    await request("/api/campaigns", { method: "POST", body: { name: campaign.name }, expected: [409] });
    const selfParent = await request(`/api/campaigns/${campaign.id}`, {
      method: "PATCH",
      body: { parentCampaignId: campaign.id },
      expected: [400]
    });
    assert(selfParent.error?.includes("own parent"), "campaign hierarchy accepted a direct cycle");

    const updated = await request(`/api/campaigns/${campaign.id}`, {
      method: "PATCH",
      body: { actualCost: "125.25", description: `${tag} updated campaign` }
    });
    campaign = updated.campaign;
    assert(
      Number(campaign.actualCost) === 125.25 && campaign.description.includes("updated"),
      "campaign edit did not persist"
    );

    const added = await request(`/api/campaigns/${campaign.id}/members`, {
      method: "POST",
      body: { objectType: "Contact", recordIds: [contact.id], status: "Sent" }
    });
    campaign = added.campaign;
    added.notifications?.forEach((notification) => remember("notifications", notification));
    assert(
      campaign.members.length === 1 && campaign.metrics.memberCount === 1,
      "campaign member was not added or counted"
    );
    const member = campaign.members[0];
    const responded = await request(`/api/campaigns/${campaign.id}/members/${member.id}`, {
      method: "PATCH",
      body: { status: "Responded", notes: `${tag} response` }
    });
    campaign = responded.campaign;
    assert(
      campaign.members[0].responded === true && campaign.metrics.responseRate === 100,
      "campaign response metrics were not recalculated"
    );
    await request(`/api/campaigns/${campaign.id}`, { method: "DELETE", expected: [409] });

    const activated = await request(`/api/campaigns/${campaign.id}/actions`, {
      method: "POST",
      body: { action: "activate" }
    });
    campaign = activated.campaign;
    activated.notifications?.forEach((notification) => remember("notifications", notification));
    assert(
      campaign.status === "In Progress" && campaign.activatedAt,
      "campaign activation did not set lifecycle state"
    );
    await request(`/api/campaigns/${campaign.id}/actions`, {
      method: "POST",
      body: { action: "activate" },
      expected: [409]
    });
    const completed = await request(`/api/campaigns/${campaign.id}/actions`, {
      method: "POST",
      body: { action: "complete" }
    });
    campaign = completed.campaign;
    completed.notifications?.forEach((notification) => remember("notifications", notification));
    assert(campaign.status === "Completed" && campaign.completedAt, "campaign completion did not set lifecycle state");
    const archived = await request(`/api/campaigns/${campaign.id}/actions`, {
      method: "POST",
      body: { action: "archive" }
    });
    campaign = archived.campaign;
    archived.notifications?.forEach((notification) => remember("notifications", notification));
    assert(campaign.status === "Archived" && campaign.archivedAt, "campaign archive did not set lifecycle state");
    await request(`/api/campaigns/${campaign.id}`, {
      method: "PATCH",
      body: { description: "Forbidden" },
      expected: [409]
    });
    await request(`/api/campaigns/${campaign.id}/members/${member.id}`, { method: "DELETE", expected: [409] });

    const list = await request("/api/campaigns");
    assert(
      list.campaigns.some((item) => item.id === campaign.id),
      "campaign list API omitted the created campaign"
    );
    const detail = await request(`/api/campaigns/${campaign.id}`);
    assert(detail.campaign.members[0].name, "campaign detail did not hydrate its polymorphic member");
    const listHtml = await request("/lightning/o/Campaign/list");
    for (const fragment of ["Campaigns", "New", "Campaign Name", "Response Rate", campaign.name])
      assert(listHtml.includes(fragment), `campaign list missing ${fragment}`);
    const detailHtml = await request(`/lightning/r/Campaign/${campaign.id}/view`);
    for (const fragment of [campaign.name, "Campaign Details", "Campaign Members", "Response Rate", contact.lastName])
      assert(detailHtml.includes(fragment), `campaign detail missing ${fragment}`);

    const disposable = await request("/api/campaigns", {
      method: "POST",
      body: { name: `${tag} Disposable Campaign` },
      expected: [201]
    });
    remember("campaigns", disposable.campaign);
    disposable.notifications?.forEach((notification) => remember("notifications", notification));
    await request(`/api/campaigns/${disposable.campaign.id}`, { method: "DELETE" });
    created.campaigns = created.campaigns.filter((id) => id !== disposable.campaign.id);
  });

  Object.assign(state, { account, contact, opportunity });
}
