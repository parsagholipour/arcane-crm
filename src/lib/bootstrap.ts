import { decorateBootstrap } from "@/lib/crm-data";
import { requireOrganizationContext } from "@/lib/organization-context";
import { prisma } from "@/lib/prisma";
import { isSuperAdminEmail } from "@/lib/super-admin-constants";
import { invoiceInclude, markPastDueInvoices } from "@/lib/invoices";
import { messagingSessionInclude } from "@/lib/messaging";
import { videoCallInclude } from "@/lib/video-calls";
import { campaignInclude, hydrateCampaign } from "@/lib/campaigns";
import { commerceOrderInclude, commerceStoreInclude } from "@/lib/commerce";
import { emailDeliveryConfigured } from "@/lib/email/service";
import { marketingLandingPageInclude } from "@/lib/marketing-pages";
import type { BootstrapData } from "@/lib/crm-types";

export async function loadBootstrapData(): Promise<BootstrapData> {
  const context = await requireOrganizationContext();
  const organizationId = context.organizationId;
  const userId = context.userId;
  const organizationWhere = { organizationId };
  const personalWhere = { organizationId, userId };

  await markPastDueInvoices(organizationId, userId);

  const [
    members,
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
    quickTextFavorites,
    knowledgeArticles,
    listEmails,
    messagingSessions,
    invoices,
    videoCalls,
    files,
    attachments,
    tasks,
    emailActivities,
    emailDeliveries,
    callActivities,
    partners,
    stores,
    commerceOrders,
    inventoryItems,
    commercePromotions,
    commerceFulfillments,
    campaigns,
    campaignMembers,
    recordLabels,
    marketingActivations,
    marketingLandingPages,
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
    prisma.organizationMembership.findMany({
      where: { organizationId, status: "ACTIVE", user: { status: "ACTIVE" } },
      include: { user: true },
      orderBy: { user: { name: "asc" } }
    }),
    prisma.account.findMany({ where: organizationWhere, orderBy: { updatedAt: "desc" } }),
    prisma.contact.findMany({ where: organizationWhere, include: { account: true }, orderBy: { updatedAt: "desc" } }),
    prisma.lead.findMany({ where: organizationWhere, orderBy: { updatedAt: "desc" } }),
    prisma.opportunity.findMany({ where: organizationWhere, include: { account: true, contact: true }, orderBy: { updatedAt: "desc" } }),
    prisma.caseRecord.findMany({ where: organizationWhere, include: { account: true, contact: true }, orderBy: { updatedAt: "desc" } }),
    prisma.product.findMany({ where: organizationWhere, orderBy: { updatedAt: "desc" } }),
    prisma.priceBook.findMany({ where: organizationWhere, orderBy: { updatedAt: "desc" } }),
    prisma.priceBookEntry.findMany({ where: organizationWhere, include: { product: true, priceBook: true } }),
    prisma.event.findMany({ where: { ...organizationWhere, OR: [{ private: false }, { assignedToId: userId }] }, orderBy: { startAt: "asc" } }),
    prisma.calendarSource.findMany({ where: personalWhere, orderBy: { updatedAt: "desc" } }),
    prisma.quickText.findMany({ where: organizationWhere, orderBy: { updatedAt: "desc" } }),
    prisma.quickTextFolder.findMany({ where: organizationWhere }),
    prisma.quickTextFavorite.findMany({ where: personalWhere, orderBy: { createdAt: "desc" } }),
    prisma.knowledgeArticle.findMany({ where: organizationWhere, orderBy: { updatedAt: "desc" } }),
    prisma.listEmail.findMany({ where: organizationWhere, orderBy: { createdAt: "desc" } }),
    prisma.messagingSession.findMany({ where: organizationWhere, include: messagingSessionInclude, orderBy: { updatedAt: "desc" } }),
    prisma.invoice.findMany({ where: organizationWhere, include: invoiceInclude, orderBy: { updatedAt: "desc" } }),
    prisma.videoCall.findMany({ where: organizationWhere, include: videoCallInclude, orderBy: { scheduledStartAt: "desc" } }),
    prisma.fileRecord.findMany({
      where: organizationWhere,
      select: { id: true, organizationId: true, name: true, size: true, contentType: true, checksum: true, relatedObjectType: true, relatedRecordId: true, uploadedById: true, uploadedAt: true },
      orderBy: { uploadedAt: "desc" }
    }),
    prisma.attachmentRecord.findMany({
      where: organizationWhere,
      select: { id: true, organizationId: true, name: true, size: true, contentType: true, checksum: true, relatedObjectType: true, relatedRecordId: true, uploadedById: true, uploadedAt: true },
      orderBy: { uploadedAt: "desc" }
    }),
    prisma.task.findMany({ where: organizationWhere, orderBy: { updatedAt: "desc" } }),
    prisma.emailActivity.findMany({ where: organizationWhere, orderBy: { sentAt: "desc" } }),
    prisma.emailDelivery.findMany({ where: organizationWhere, include: { events: { orderBy: { occurredAt: "desc" }, take: 20 } }, orderBy: { acceptedAt: "desc" }, take: 500 }),
    prisma.callActivity.findMany({ where: organizationWhere, orderBy: { completedAt: "desc" } }),
    prisma.partner.findMany({ where: organizationWhere }),
    prisma.marketingStore.findMany({ where: organizationWhere, include: commerceStoreInclude, orderBy: { updatedAt: "desc" } }),
    prisma.commerceOrder.findMany({ where: organizationWhere, include: commerceOrderInclude, orderBy: { orderDate: "desc" } }),
    prisma.inventoryItem.findMany({ where: organizationWhere, include: { product: true, store: true }, orderBy: { updatedAt: "desc" } }),
    prisma.commercePromotion.findMany({ where: organizationWhere, include: { store: true }, orderBy: { updatedAt: "desc" } }),
    prisma.commerceFulfillment.findMany({ where: organizationWhere, include: { order: true, lines: true }, orderBy: { createdAt: "desc" } }),
    prisma.campaign.findMany({ where: organizationWhere, include: campaignInclude, orderBy: { updatedAt: "desc" } }).then((rows) => Promise.all(rows.map((campaign) => hydrateCampaign(organizationId, campaign)))),
    prisma.campaignMember.findMany({ where: organizationWhere, orderBy: { createdAt: "desc" } }),
    prisma.recordLabel.findMany({ where: organizationWhere, orderBy: { createdAt: "desc" } }),
    prisma.marketingActivation.findMany({ where: organizationWhere, orderBy: { activatedAt: "desc" } }),
    prisma.marketingLandingPage.findMany({ where: organizationWhere, include: marketingLandingPageInclude, orderBy: { updatedAt: "desc" } }),
    prisma.subscriptionCheckout.findMany({ where: organizationWhere, orderBy: { createdAt: "desc" } }),
    prisma.customReport.findMany({ where: personalWhere, orderBy: { updatedAt: "desc" } }),
    prisma.customDashboard.findMany({ where: personalWhere, orderBy: { updatedAt: "desc" } }),
    prisma.notification.findMany({ where: personalWhere, orderBy: { createdAt: "desc" } }),
    prisma.notificationPreference.findMany({ where: personalWhere }),
    prisma.guidanceItem.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.userGuidanceState.findMany({ where: personalWhere }),
    prisma.userPreference.findMany({ where: personalWhere }),
    prisma.setupShortcutState.findMany({ where: personalWhere, orderBy: { updatedAt: "desc" } }),
    prisma.helpArticleState.findMany({ where: personalWhere, orderBy: { updatedAt: "desc" } }),
    prisma.appNavPreference.findMany({ where: personalWhere }),
    prisma.listViewPreference.findMany({ where: personalWhere }),
    prisma.globalSearchRecent.findMany({ where: personalWhere, orderBy: { updatedAt: "desc" }, take: 8 }),
    prisma.agentforceMessage.findMany({ where: personalWhere, orderBy: { createdAt: "desc" }, take: 30 }).then((rows) => rows.reverse())
  ]);

  const payload: BootstrapData = {
    user: context.user,
    users: members.map((row) => row.user),
    organization: { id: context.organization.id, name: context.organization.name, slug: context.organization.slug, role: context.role },
    organizations: context.availableOrganizations,
    organizationRole: context.role,
    isSuperAdmin: isSuperAdminEmail(context.user.email),
    emailDeliveryConfigured: emailDeliveryConfigured(),
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
    quickTextFavorites,
    knowledgeArticles,
    listEmails,
    messagingSessions,
    invoices,
    videoCalls,
    files,
    attachments,
    tasks,
    emailActivities,
    emailDeliveries,
    callActivities,
    partners,
    stores,
    commerceOrders,
    inventoryItems,
    commercePromotions,
    commerceFulfillments,
    campaigns,
    campaignMembers,
    recordLabels,
    marketingActivations,
    marketingLandingPages,
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
  };

  return decorateBootstrap(JSON.parse(JSON.stringify(payload)) as BootstrapData);
}
