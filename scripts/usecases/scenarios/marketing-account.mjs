export async function runMarketingAccountScenarios(context, state) {
  const {
    assert,
    check,
    created,
    currentUserId,
    organizationId,
    postRecord,
    prisma,
    request,
    requestAnonymous,
    remember,
    restoreProfileAndPreferences,
    setOriginalPreference,
    setOriginalUser,
    tag,
    utility
  } = context;
  let { lead, quickText } = state;

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
    for (const requiredField of ["lastName", "email", "company"])
      assert(landingPage.fields.includes(requiredField), `landing page omitted required ${requiredField} field`);

    await request("/api/marketing/landing-pages", {
      method: "POST",
      body: {
        name: `${tag} Duplicate Form`,
        slug: landingPage.slug,
        headline: "Duplicate",
        ownerId: currentUserId,
        fields: []
      },
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

    const publishResult = await request(`/api/marketing/landing-pages/${landingPage.id}/actions`, {
      method: "POST",
      body: { action: "publish" }
    });
    landingPage = publishResult.page;
    publishResult.notifications?.forEach((notification) => remember("notifications", notification));
    assert(
      landingPage.status === "Published" && landingPage.publishedAt,
      "landing page publish did not set lifecycle state"
    );
    await request(`/api/marketing/landing-pages/${landingPage.id}`, {
      method: "PATCH",
      body: { headline: "Forbidden" },
      expected: [409]
    });
    await request(`/api/marketing/landing-pages/${landingPage.id}`, { method: "DELETE", expected: [409] });

    const publicHtml = await requestAnonymous(publicPath);
    for (const fragment of [landingPage.headline, "Contact Me", "Last Name", "Email", "Company"])
      assert(publicHtml.includes(fragment), `public marketing form missing ${fragment}`);
    await requestAnonymous(
      `/api/marketing/public/${encodeURIComponent(organization.slug)}/${encodeURIComponent(landingPage.slug)}/submissions`,
      {
        method: "POST",
        body: { lastName: "Missing Company", email: "invalid" },
        expected: [400]
      }
    );
    const submissionEmail = `form-${tag}@example.com`;
    const submissionResult = await requestAnonymous(
      `/api/marketing/public/${encodeURIComponent(organization.slug)}/${encodeURIComponent(landingPage.slug)}/submissions`,
      {
        method: "POST",
        body: {
          firstName: "Web",
          lastName: `${tag} Submitter`,
          company: `${tag} Prospect`,
          email: submissionEmail,
          phone: "555-0199",
          message: `${tag} form message`
        },
        expected: [201]
      }
    );
    assert(
      submissionResult.successMessage === "A representative will follow up.",
      "public form did not return its configured success message"
    );
    const submission = await prisma.marketingFormSubmission.findUnique({
      where: { id: submissionResult.submissionId },
      include: { lead: true }
    });
    assert(
      submission?.lead?.email === submissionEmail && submission.lead.leadSource === "Web",
      "form submission did not create the expected Web Lead"
    );
    remember("marketingFormSubmissions", submission);
    remember("leads", submission?.lead);
    const attributedMember = await prisma.campaignMember.findFirst({
      where: { organizationId, campaignId: formCampaign.id, objectType: "Lead", recordId: submission.lead.id }
    });
    assert(attributedMember?.responded === true, "form submission did not create a responded Campaign Member");
    await requestAnonymous(
      `/api/marketing/public/${encodeURIComponent(organization.slug)}/${encodeURIComponent(landingPage.slug)}/submissions`,
      {
        method: "POST",
        body: { lastName: `${tag} Submitter`, company: `${tag} Prospect`, email: submissionEmail },
        expected: [429]
      }
    );

    const pageResult = await request(`/api/marketing/landing-pages/${landingPage.id}`);
    assert(
      pageResult.page.submissions.some((item) => item.id === submission.id),
      "landing-page detail omitted its submission history"
    );
    const landingPages = await request("/api/marketing/landing-pages");
    assert(
      landingPages.landingPages.some((item) => item.id === landingPage.id),
      "marketing collection omitted the created landing page"
    );
    const marketingHtml = await request("/lightning/app/marketing");
    for (const fragment of ["Landing Pages &amp; Lead Forms", "New Landing Page", landingPage.name])
      assert(marketingHtml.includes(fragment), `Marketing workspace missing ${fragment}`);

    const archiveResult = await request(`/api/marketing/landing-pages/${landingPage.id}/actions`, {
      method: "POST",
      body: { action: "archive" }
    });
    archiveResult.notifications?.forEach((notification) => remember("notifications", notification));
    assert(archiveResult.page.status === "Archived", "landing page archive did not persist");
    await requestAnonymous(publicPath, { expected: [404] });
    const restoreResult = await request(`/api/marketing/landing-pages/${landingPage.id}/actions`, {
      method: "POST",
      body: { action: "restore" }
    });
    restoreResult.notifications?.forEach((notification) => remember("notifications", notification));
    assert(restoreResult.page.status === "Draft", "landing page restore did not return to Draft");
    await request(`/api/marketing/landing-pages/${landingPage.id}`, { method: "DELETE", expected: [409] });

    const disposable = await request("/api/marketing/landing-pages", {
      method: "POST",
      body: {
        name: `${tag} Disposable Form`,
        slug: `${tag}-disposable-form`,
        headline: "Disposable",
        ownerId: currentUserId,
        fields: []
      },
      expected: [201]
    });
    remember("marketingLandingPages", disposable.page);
    disposable.notifications?.forEach((notification) => remember("notifications", notification));
    await request(`/api/marketing/landing-pages/${disposable.page.id}`, { method: "DELETE" });
    created.marketingLandingPages = created.marketingLandingPages.filter((id) => id !== disposable.page.id);
  });

  await check("profile and preference utilities restore cleanly", async () => {
    const originalUser = await prisma.user.findUnique({ where: { id: currentUserId } });
    const originalPreference = await prisma.userPreference.findUnique({
      where: { organizationId_userId: { organizationId, userId: currentUserId } }
    });
    setOriginalUser(originalUser);
    setOriginalPreference(originalPreference);
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
    assert(
      preferencesResult.preferences?.displayDensity === "Compact",
      "preferences update did not change display density"
    );

    await restoreProfileAndPreferences();
  });

  await check("disposable API delete route works", async () => {
    const disposable = await postRecord(
      "QuickText",
      {
        name: `${tag} Disposable Delete`,
        message: "Delete me",
        category: "Greetings",
        channels: ["Email"],
        mergeFields: []
      },
      "quickTexts"
    );
    await request(`/api/records/QuickText/${disposable.id}`, { method: "DELETE", expected: [200] });
    const afterDelete = await prisma.quickText.findUnique({ where: { id: disposable.id } });
    assert(!afterDelete, "DELETE route did not remove quick text");
    created.quickTexts = created.quickTexts.filter((id) => id !== disposable.id);
  });

  Object.assign(state, { lead, quickText });
}
