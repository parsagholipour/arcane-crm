export async function restoreProfileAndPreferencesState(context) {
  const { originalPreference, originalUser, prisma } = context;
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
      where: {
        organizationId_userId: { organizationId: originalPreference.organizationId, userId: originalPreference.userId }
      },
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

export async function restoreLeadGuidanceState(context) {
  const { currentUserId, organizationId, originalLeadGuidanceState, prisma } = context;
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

export async function cleanupUsecaseState(context) {
  const { created, currentUserId, organizationId, prisma, tag } = context;
  await restoreProfileAndPreferencesState(context);
  await restoreLeadGuidanceState(context);

  await prisma.agentforceMessage.deleteMany({
    where: { OR: [{ id: { in: created.agentforceMessages } }, { text: { contains: tag } }] }
  });

  await prisma.aiInsightCache.deleteMany({ where: { organizationId, userId: currentUserId } });

  await prisma.globalSearchRecent.deleteMany({
    where: {
      OR: [
        { id: { in: created.globalSearchRecents } },
        { query: tag },
        { label: tag },
        { href: { in: created.invoices.map((id) => `/lightning/r/Invoice/${id}/view`) } }
      ]
    }
  });

  await prisma.listViewPreference.deleteMany({
    where: { OR: [{ id: { in: created.listViewPreferences } }, { viewName: { contains: tag } }] }
  });

  await prisma.appNavPreference.deleteMany({ where: { id: { in: created.appNavPreferences } } });

  await prisma.helpArticleState.deleteMany({
    where: { OR: [{ id: { in: created.helpArticleStates } }, { articleId: tag }] }
  });

  await prisma.setupShortcutState.deleteMany({
    where: { OR: [{ id: { in: created.setupShortcutStates } }, { shortcutId: tag }] }
  });

  await prisma.userGuidanceState.deleteMany({ where: { id: { in: created.guidanceStates } } });

  await prisma.notificationPreference.deleteMany({
    where: { OR: [{ id: { in: created.notificationPreferences } }, { category: tag }] }
  });

  await prisma.notification.deleteMany({
    where: {
      OR: [
        { id: { in: created.notifications } },
        { title: { contains: tag } },
        { body: { contains: tag } },
        { href: { in: created.invoices.map((id) => `/lightning/r/Invoice/${id}/view`) } }
      ]
    }
  });

  await prisma.customDashboard.deleteMany({
    where: { OR: [{ id: { in: created.customDashboards } }, { name: { contains: tag } }] }
  });

  await prisma.customReport.deleteMany({
    where: { OR: [{ id: { in: created.customReports } }, { name: { contains: tag } }] }
  });

  await prisma.calendarSource.deleteMany({
    where: { OR: [{ id: { in: created.calendarSources } }, { name: { contains: tag } }] }
  });

  await prisma.marketingFormSubmission.deleteMany({
    where: {
      OR: [
        { id: { in: created.marketingFormSubmissions } },
        { landingPageId: { in: created.marketingLandingPages } },
        { leadId: { in: created.leads } }
      ]
    }
  });

  await prisma.marketingLandingPage.deleteMany({
    where: {
      OR: [{ id: { in: created.marketingLandingPages } }, { name: { contains: tag } }, { slug: { contains: tag } }]
    }
  });

  await prisma.marketingActivation.deleteMany({
    where: {
      OR: [
        { id: { in: created.marketingActivations } },
        { senderName: { contains: tag } },
        { senderEmail: { contains: tag } }
      ]
    }
  });

  await prisma.commerceFulfillmentLine.deleteMany({
    where: {
      OR: [{ id: { in: created.commerceFulfillmentLines } }, { fulfillmentId: { in: created.commerceFulfillments } }]
    }
  });

  await prisma.commerceFulfillment.deleteMany({
    where: {
      OR: [
        { id: { in: created.commerceFulfillments } },
        { orderId: { in: created.commerceOrders } },
        { trackingNumber: { contains: tag } }
      ]
    }
  });

  await prisma.commerceOrderPromotion.deleteMany({
    where: { OR: [{ orderId: { in: created.commerceOrders } }, { promotionId: { in: created.commercePromotions } }] }
  });

  await prisma.commerceOrderLine.deleteMany({
    where: {
      OR: [
        { id: { in: created.commerceOrderLines } },
        { orderId: { in: created.commerceOrders } },
        { description: { contains: tag } }
      ]
    }
  });

  await prisma.commerceOrder.deleteMany({
    where: {
      OR: [
        { id: { in: created.commerceOrders } },
        { notes: { contains: tag } },
        { purchaseOrderNumber: { contains: tag } }
      ]
    }
  });

  await prisma.commercePromotion.deleteMany({
    where: {
      OR: [{ id: { in: created.commercePromotions } }, { name: { contains: tag } }, { code: { contains: tag } }]
    }
  });

  await prisma.inventoryItem.deleteMany({
    where: {
      OR: [
        { id: { in: created.inventoryItems } },
        { storeId: { in: created.stores } },
        { productId: { in: created.products } }
      ]
    }
  });

  await prisma.marketingStore.deleteMany({
    where: { OR: [{ id: { in: created.stores } }, { name: { contains: tag } }] }
  });

  await prisma.fileRecord.deleteMany({ where: { OR: [{ id: { in: created.files } }, { name: { contains: tag } }] } });

  await prisma.attachmentRecord.deleteMany({
    where: { OR: [{ id: { in: created.attachments } }, { name: { contains: tag } }] }
  });

  await prisma.task.deleteMany({ where: { OR: [{ id: { in: created.tasks } }, { subject: { contains: tag } }] } });

  await prisma.emailDeliveryEvent.deleteMany({
    where: { OR: [{ id: { in: created.emailDeliveryEvents } }, { deliveryId: { in: created.emailDeliveries } }] }
  });

  await prisma.emailDelivery.deleteMany({
    where: {
      OR: [
        { id: { in: created.emailDeliveries } },
        { subject: { contains: tag } },
        { providerMessageId: { contains: tag } }
      ]
    }
  });

  await prisma.emailActivity.deleteMany({
    where: { OR: [{ id: { in: created.emailActivities } }, { subject: { contains: tag } }] }
  });

  await prisma.callActivity.deleteMany({
    where: { OR: [{ id: { in: created.callActivities } }, { subject: { contains: tag } }] }
  });

  await prisma.event.deleteMany({
    where: {
      OR: [
        { id: { in: created.events } },
        { description: { contains: tag } },
        { relatedRecordId: { in: created.accounts } }
      ]
    }
  });

  await prisma.messagingMessage.deleteMany({
    where: {
      OR: [
        { id: { in: created.messagingMessages } },
        { body: { contains: tag } },
        { sessionId: { in: created.messagingSessions } }
      ]
    }
  });

  await prisma.messagingSessionParticipant.deleteMany({ where: { sessionId: { in: created.messagingSessions } } });

  await prisma.messagingSession.deleteMany({
    where: { OR: [{ id: { in: created.messagingSessions } }, { name: { contains: tag } }] }
  });

  await prisma.videoCallParticipant.deleteMany({
    where: { OR: [{ id: { in: created.videoCallParticipants } }, { videoCallId: { in: created.videoCalls } }] }
  });

  await prisma.videoCall.deleteMany({
    where: { OR: [{ id: { in: created.videoCalls } }, { name: { contains: tag } }] }
  });

  await prisma.recordLabel.deleteMany({
    where: {
      OR: [
        { id: { in: created.labels } },
        { label: { contains: tag } },
        { recordId: { in: [...created.accounts, ...created.contacts, ...created.leads] } }
      ]
    }
  });

  await prisma.campaignMember.deleteMany({
    where: {
      OR: [{ campaignId: { in: created.campaigns } }, { recordId: { in: [...created.contacts, ...created.leads] } }]
    }
  });

  await prisma.campaign.deleteMany({ where: { OR: [{ id: { in: created.campaigns } }, { name: { contains: tag } }] } });

  await prisma.listEmail.deleteMany({
    where: { OR: [{ id: { in: created.listEmails } }, { subject: { contains: tag } }] }
  });

  await prisma.knowledgeFeedback.deleteMany({
    where: {
      OR: [
        { id: { in: created.knowledgeFeedback } },
        { articleId: { in: created.knowledgeArticles } },
        { comment: { contains: tag } }
      ]
    }
  });

  await prisma.knowledgeArticle.deleteMany({
    where: {
      OR: [{ id: { in: created.knowledgeArticles } }, { title: { contains: tag } }, { urlName: { contains: tag } }]
    }
  });

  await prisma.quickTextFavorite.deleteMany({
    where: { OR: [{ id: { in: created.quickTextFavorites } }, { quickTextId: { in: created.quickTexts } }] }
  });

  await prisma.quickText.deleteMany({
    where: { OR: [{ id: { in: created.quickTexts } }, { name: { contains: tag } }, { message: { contains: tag } }] }
  });

  await prisma.quickTextFolder.deleteMany({
    where: { OR: [{ id: { in: created.quickTextFolders } }, { name: { contains: tag } }] }
  });

  await prisma.invoicePayment.deleteMany({
    where: { OR: [{ id: { in: created.invoicePayments } }, { invoiceId: { in: created.invoices } }] }
  });

  await prisma.invoiceLineItem.deleteMany({
    where: {
      OR: [
        { id: { in: created.invoiceLineItems } },
        { invoiceId: { in: created.invoices } },
        { description: { contains: tag } }
      ]
    }
  });

  await prisma.invoice.deleteMany({
    where: {
      OR: [{ id: { in: created.invoices } }, { notes: { contains: tag } }, { purchaseOrderNumber: { contains: tag } }]
    }
  });

  await prisma.priceBookEntry.deleteMany({
    where: {
      OR: [
        { id: { in: created.priceBookEntries } },
        { productId: { in: created.products } },
        { priceBookId: { in: created.priceBooks } }
      ]
    }
  });

  await prisma.partner.deleteMany({
    where: {
      OR: [{ id: { in: created.partners } }, { name: { contains: tag } }, { accountId: { in: created.accounts } }]
    }
  });

  await prisma.opportunity.deleteMany({
    where: {
      OR: [
        { id: { in: created.opportunities } },
        { name: { contains: tag } },
        { accountId: { in: created.accounts } },
        { contactId: { in: created.contacts } }
      ]
    }
  });

  await prisma.caseRecord.deleteMany({
    where: {
      OR: [
        { id: { in: created.cases } },
        { subject: { contains: tag } },
        { accountId: { in: created.accounts } },
        { contactId: { in: created.contacts } }
      ]
    }
  });

  await prisma.contact.deleteMany({
    where: {
      OR: [
        { id: { in: created.contacts } },
        { lastName: { contains: tag } },
        { email: { contains: tag } },
        { accountId: { in: created.accounts } }
      ]
    }
  });

  await prisma.lead.deleteMany({
    where: {
      OR: [
        { id: { in: created.leads } },
        { lastName: { contains: tag } },
        { company: { contains: tag } },
        { email: { contains: tag } }
      ]
    }
  });

  await prisma.product.deleteMany({
    where: { OR: [{ id: { in: created.products } }, { name: { contains: tag } }, { productCode: tag }] }
  });

  await prisma.priceBook.deleteMany({
    where: { OR: [{ id: { in: created.priceBooks } }, { name: { contains: tag } }] }
  });

  await prisma.account.deleteMany({ where: { OR: [{ id: { in: created.accounts } }, { name: { contains: tag } }] } });

  await prisma.appSession.deleteMany({ where: { userId: currentUserId } });

  await prisma.organizationMembership.deleteMany({ where: { organizationId, userId: currentUserId } });

  await prisma.userPreference.deleteMany({ where: { organizationId, userId: currentUserId } });

  await prisma.user.deleteMany({ where: { id: currentUserId } });
}
