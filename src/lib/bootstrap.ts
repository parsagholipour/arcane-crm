import { decorateBootstrap } from "@/lib/crm-data";
import { CURRENT_USER } from "@/lib/crm-metadata";
import { prisma } from "@/lib/prisma";
import type { BootstrapData } from "@/lib/crm-types";

export const emptyBootstrap: BootstrapData = {
  user: CURRENT_USER,
  accounts: [],
  contacts: [],
  leads: [],
  opportunities: [],
  cases: [],
  products: [],
  priceBooks: [],
  priceBookEntries: [],
  events: [],
  calendarSources: [],
  quickTexts: [],
  quickTextFolders: [],
  knowledgeArticles: [],
  listEmails: [],
  messagingSessions: [],
  invoices: [],
  videoCalls: [],
  files: [],
  attachments: [],
  tasks: [],
  emailActivities: [],
  callActivities: [],
  partners: [],
  stores: [],
  campaigns: [],
  campaignMembers: [],
  recordLabels: [],
  marketingActivations: [],
  subscriptionCheckouts: [],
  customReports: [],
  customDashboards: [],
  notifications: [],
  notificationPreferences: [],
  guidanceItems: [],
  guidanceStates: [],
  userPreferences: [],
  setupShortcutStates: [],
  helpArticleStates: [],
  appNavPreferences: [],
  listViewPreferences: [],
  globalSearchRecents: [],
  agentforceMessages: []
};

export function fixtureBootstrapData(): BootstrapData {
  const now = "2026-07-08T08:00:00.000Z";
  const base: BootstrapData = {
    ...emptyBootstrap,
    accounts: [
      {
        id: "acc-robert",
        name: "Robert",
        type: "Customer",
        ownerId: CURRENT_USER.id,
        createdById: CURRENT_USER.id,
        updatedById: CURRENT_USER.id,
        createdAt: now,
        updatedAt: now
      }
    ],
    contacts: [
      {
        id: "con-rober-antonio",
        salutation: "Mr.",
        firstName: "Rober",
        lastName: "Antonio",
        accountId: "acc-robert",
        ownerId: CURRENT_USER.id,
        createdById: CURRENT_USER.id,
        updatedById: CURRENT_USER.id,
        createdAt: now,
        updatedAt: now
      }
    ],
    quickTextFolders: [
      {
        id: "qtf-personal",
        name: "Personal Quick Text",
        ownerId: CURRENT_USER.id,
        sharing: "Private"
      }
    ]
  };

  return decorateBootstrap(base);
}

export async function loadBootstrapData(): Promise<BootstrapData> {
  if (!process.env.DATABASE_URL) {
    return fixtureBootstrapData();
  }

  try {
    const [
      user,
      accounts,
      contacts,
      leads,
      opportunities,
      cases,
      products,
      priceBooks,
      priceBookEntries,
      events,
      calendarSources,
      quickTexts,
      quickTextFolders,
      knowledgeArticles,
      listEmails,
      messagingSessions,
      invoices,
      videoCalls,
      files,
      attachments,
      tasks,
      emailActivities,
      callActivities,
      partners,
      stores,
      campaigns,
      campaignMembers,
      recordLabels,
      marketingActivations,
      subscriptionCheckouts,
      customReports,
      customDashboards,
      notifications,
      notificationPreferences,
      guidanceItems,
      guidanceStates,
      userPreferences,
      setupShortcutStates,
      helpArticleStates,
      appNavPreferences,
      listViewPreferences,
      globalSearchRecents,
      agentforceMessages
    ] = await Promise.all([
      prisma.user.findFirst(),
      prisma.account.findMany({ orderBy: { updatedAt: "desc" } }),
      prisma.contact.findMany({ include: { account: true }, orderBy: { updatedAt: "desc" } }),
      prisma.lead.findMany({ orderBy: { updatedAt: "desc" } }),
      prisma.opportunity.findMany({ include: { account: true, contact: true }, orderBy: { updatedAt: "desc" } }),
      prisma.caseRecord.findMany({ include: { account: true, contact: true }, orderBy: { updatedAt: "desc" } }),
      prisma.product.findMany({ orderBy: { updatedAt: "desc" } }),
      prisma.priceBook.findMany({ orderBy: { updatedAt: "desc" } }),
      prisma.priceBookEntry.findMany({ include: { product: true, priceBook: true } }),
      prisma.event.findMany({ orderBy: { startAt: "asc" } }),
      prisma.calendarSource.findMany({ where: { userId: CURRENT_USER.id }, orderBy: { updatedAt: "desc" } }),
      prisma.quickText.findMany({ orderBy: { updatedAt: "desc" } }),
      prisma.quickTextFolder.findMany(),
      prisma.knowledgeArticle.findMany({ orderBy: { updatedAt: "desc" } }),
      prisma.listEmail.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.messagingSession.findMany({ orderBy: { updatedAt: "desc" } }),
      prisma.invoice.findMany({ orderBy: { updatedAt: "desc" } }),
      prisma.videoCall.findMany({ orderBy: { updatedAt: "desc" } }),
      prisma.fileRecord.findMany({ orderBy: { uploadedAt: "desc" } }),
      prisma.attachmentRecord.findMany({ orderBy: { uploadedAt: "desc" } }),
      prisma.task.findMany({ orderBy: { updatedAt: "desc" } }),
      prisma.emailActivity.findMany({ orderBy: { sentAt: "desc" } }),
      prisma.callActivity.findMany({ orderBy: { completedAt: "desc" } }),
      prisma.partner.findMany(),
      prisma.marketingStore.findMany({ orderBy: { updatedAt: "desc" } }),
      prisma.campaign.findMany({ orderBy: { updatedAt: "desc" } }),
      prisma.campaignMember.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.recordLabel.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.marketingActivation.findMany({ orderBy: { activatedAt: "desc" } }),
      prisma.subscriptionCheckout.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.customReport.findMany({ where: { userId: CURRENT_USER.id }, orderBy: { updatedAt: "desc" } }),
      prisma.customDashboard.findMany({ where: { userId: CURRENT_USER.id }, orderBy: { updatedAt: "desc" } }),
      prisma.notification.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.notificationPreference.findMany({ where: { userId: CURRENT_USER.id } }),
      prisma.guidanceItem.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.userGuidanceState.findMany(),
      prisma.userPreference.findMany(),
      prisma.setupShortcutState.findMany({ where: { userId: CURRENT_USER.id }, orderBy: { updatedAt: "desc" } }),
      prisma.helpArticleState.findMany({ where: { userId: CURRENT_USER.id }, orderBy: { updatedAt: "desc" } }),
      prisma.appNavPreference.findMany(),
      prisma.listViewPreference.findMany(),
      prisma.globalSearchRecent.findMany({ where: { userId: CURRENT_USER.id }, orderBy: { updatedAt: "desc" }, take: 8 }),
      prisma.agentforceMessage.findMany({ orderBy: { createdAt: "asc" }, take: 30 })
    ]);

    return decorateBootstrap(
      JSON.parse(
        JSON.stringify({
          user: user ?? CURRENT_USER,
          accounts,
          contacts,
          leads,
          opportunities,
          cases,
          products,
          priceBooks,
          priceBookEntries,
          events,
          calendarSources,
          quickTexts,
          quickTextFolders,
          knowledgeArticles,
          listEmails,
          messagingSessions,
          invoices,
          videoCalls,
          files,
          attachments,
          tasks,
          emailActivities,
          callActivities,
          partners,
          stores,
          campaigns,
          campaignMembers,
          recordLabels,
          marketingActivations,
          subscriptionCheckouts,
          customReports,
          customDashboards,
          notifications,
          notificationPreferences,
          guidanceItems,
          guidanceStates,
          userPreferences,
          setupShortcutStates,
          helpArticleStates,
          appNavPreferences,
          listViewPreferences,
          globalSearchRecents,
          agentforceMessages
        })
      )
    );
  } catch (error) {
    console.warn("Falling back to fixture CRM data:", error);
    return fixtureBootstrapData();
  }
}
