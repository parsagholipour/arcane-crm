import "server-only";

import { dataKeyForObject, decorateScopedData } from "@/lib/crm-data";
import type { ListQuery, ScreenDescriptor, ShellPayload } from "@/lib/api/contracts";
import type { ScopedCrmData, CrmObject, UserRecord } from "@/lib/crm-types";
import { bootstrapEventWindow, loadEventsForWindow } from "@/lib/calendar-events";
import { campaignInclude, hydrateCampaign } from "@/lib/campaigns";
import { commerceOrderInclude, commerceStoreInclude } from "@/lib/commerce";
import { markPastDueInvoices } from "@/lib/invoices";
import { marketingLandingPageInclude } from "@/lib/marketing-pages";
import { prisma } from "@/lib/prisma";
import { attachShipmentTracking, shipmentTrackingBySubject } from "@/lib/shipment-tracking-sync";
import { videoCallInclude } from "@/lib/video-calls";
import { getRecordDetail } from "@/server/records/get-record-detail";
import { listRecords } from "@/server/records/list-records";
import {
  calendarEditorLookups,
  editorLookupObjects,
  mergeScopedRecordCollections,
  needsPriceBookEntries
} from "@/server/screens/screen-data-model";

export type ScopedScreenPayload = {
  descriptor: ScreenDescriptor;
  data: ScopedCrmData;
  list?: {
    total: number;
    nextCursor: string | null;
  };
};

const defaultListQuery: ListQuery = {
  limit: 200,
  search: "",
  view: "",
  sort: "",
  direction: "asc"
};

const storedFileMetadataSelect = {
  id: true,
  organizationId: true,
  name: true,
  size: true,
  contentType: true,
  checksum: true,
  relatedObjectType: true,
  relatedRecordId: true,
  uploadedById: true,
  uploadedAt: true
} as const;

function emptyScreenData(shell: ShellPayload, users: UserRecord[]): ScopedCrmData {
  return {
    ...shell,
    users,
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
    quickTextFavorites: [],
    knowledgeArticles: [],
    listEmails: [],
    messagingSessions: [],
    invoices: [],
    videoCalls: [],
    files: [],
    attachments: [],
    tasks: [],
    emailActivities: [],
    emailDeliveries: [],
    callActivities: [],
    partners: [],
    stores: [],
    commerceOrders: [],
    inventoryItems: [],
    commercePromotions: [],
    commerceFulfillments: [],
    campaigns: [],
    campaignMembers: [],
    recordLabels: [],
    marketingActivations: [],
    marketingLandingPages: [],
    customReports: [],
    customDashboards: []
  };
}

function serialized<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function organizationUsers(organizationId: string) {
  const memberships = await prisma.organizationMembership.findMany({
    where: { organizationId, status: "ACTIVE", user: { status: "ACTIVE" } },
    include: { user: true },
    orderBy: { user: { name: "asc" } }
  });
  return memberships.map((membership) => membership.user);
}

async function loadObjectRecords(
  organizationId: string,
  userId: string,
  object: CrmObject,
  values: Partial<ListQuery> = {}
) {
  return listRecords(organizationId, userId, object, { ...defaultListQuery, ...values });
}

async function loadLookupCollections(
  organizationId: string,
  userId: string,
  objects: CrmObject[]
): Promise<Partial<ScopedCrmData>> {
  const uniqueObjects = [...new Set(objects)];
  const results = await Promise.all(
    uniqueObjects.map(async (object) => [object, await loadObjectRecords(organizationId, userId, object)] as const)
  );
  return Object.fromEntries(
    results.map(([object, result]) => [dataKeyForObject(object), result.items])
  ) as Partial<ScopedCrmData>;
}

async function loadPriceBookEntries(organizationId: string) {
  return prisma.priceBookEntry.findMany({
    where: { organizationId },
    include: { product: true, priceBook: true }
  });
}

async function loadHomeData(organizationId: string, userId: string) {
  const eventWindow = bootstrapEventWindow();
  const [opportunities, tasks, events] = await Promise.all([
    loadObjectRecords(organizationId, userId, "Opportunity"),
    prisma.task.findMany({ where: { organizationId }, orderBy: { updatedAt: "desc" }, take: 200 }),
    loadEventsForWindow(organizationId, userId, eventWindow.start, eventWindow.end)
  ]);
  return { opportunities: opportunities.items, tasks, events };
}

async function loadAnalyticsData(organizationId: string, userId: string) {
  const personalWhere = { organizationId, userId };
  const [collections, customReports, customDashboards] = await Promise.all([
    loadLookupCollections(organizationId, userId, ["Account", "Contact", "Lead", "Opportunity", "Case"]),
    prisma.customReport.findMany({ where: personalWhere, orderBy: { updatedAt: "desc" } }),
    prisma.customDashboard.findMany({ where: personalWhere, orderBy: { updatedAt: "desc" } })
  ]);
  return { ...collections, customReports, customDashboards };
}

async function loadCalendarData(organizationId: string, userId: string) {
  const eventWindow = bootstrapEventWindow();
  const personalWhere = { organizationId, userId };
  const [collections, events, tasks, calendarSources, videoCalls, quickTexts] = await Promise.all([
    loadLookupCollections(organizationId, userId, [...calendarEditorLookups]),
    loadEventsForWindow(organizationId, userId, eventWindow.start, eventWindow.end),
    prisma.task.findMany({ where: { organizationId }, orderBy: { updatedAt: "desc" }, take: 200 }),
    prisma.calendarSource.findMany({ where: personalWhere, orderBy: { updatedAt: "desc" } }),
    prisma.videoCall.findMany({
      where: { organizationId },
      include: videoCallInclude,
      orderBy: { scheduledStartAt: "desc" },
      take: 200
    }),
    prisma.quickText.findMany({ where: { organizationId }, orderBy: { updatedAt: "desc" }, take: 200 })
  ]);
  return { ...collections, events, tasks, calendarSources, videoCalls, quickTexts };
}

async function loadQuickTextData(organizationId: string, userId: string) {
  const [quickTexts, quickTextFolders, quickTextFavorites] = await Promise.all([
    prisma.quickText.findMany({ where: { organizationId }, orderBy: { updatedAt: "desc" } }),
    prisma.quickTextFolder.findMany({ where: { organizationId }, orderBy: { updatedAt: "desc" } }),
    prisma.quickTextFavorite.findMany({
      where: { organizationId, userId },
      orderBy: { createdAt: "desc" }
    })
  ]);
  return { quickTexts, quickTextFolders, quickTextFavorites };
}

async function loadMarketingData(organizationId: string, userId: string) {
  const [collections, listEmails, campaigns, campaignMembers, marketingActivations, marketingLandingPages] =
    await Promise.all([
      loadLookupCollections(organizationId, userId, ["Account", "Contact", "Lead"]),
      prisma.listEmail.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" } }),
      prisma.campaign
        .findMany({
          where: { organizationId },
          include: campaignInclude,
          orderBy: { updatedAt: "desc" }
        })
        .then((rows) => Promise.all(rows.map((campaign) => hydrateCampaign(organizationId, campaign)))),
      prisma.campaignMember.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" } }),
      prisma.marketingActivation.findMany({
        where: { organizationId },
        orderBy: { activatedAt: "desc" }
      }),
      prisma.marketingLandingPage.findMany({
        where: { organizationId },
        include: marketingLandingPageInclude,
        orderBy: { updatedAt: "desc" }
      })
    ]);
  return {
    ...collections,
    listEmails,
    campaigns,
    campaignMembers,
    marketingActivations,
    marketingLandingPages
  };
}

async function loadCommerceData(organizationId: string, userId: string) {
  const [
    collections,
    priceBookEntries,
    stores,
    commerceOrders,
    inventoryItems,
    commercePromotions,
    commerceFulfillments
  ] = await Promise.all([
    loadLookupCollections(organizationId, userId, ["Account", "Contact", "Product2", "Pricebook2"]),
    prisma.priceBookEntry.findMany({
      where: { organizationId },
      include: { product: true, priceBook: true }
    }),
    prisma.marketingStore.findMany({
      where: { organizationId },
      include: commerceStoreInclude,
      orderBy: { updatedAt: "desc" }
    }),
    prisma.commerceOrder.findMany({
      where: { organizationId },
      include: commerceOrderInclude,
      orderBy: { orderDate: "desc" }
    }),
    prisma.inventoryItem.findMany({
      where: { organizationId },
      include: { product: true, store: true },
      orderBy: { updatedAt: "desc" }
    }),
    prisma.commercePromotion.findMany({
      where: { organizationId },
      include: { store: true },
      orderBy: { updatedAt: "desc" }
    }),
    prisma.commerceFulfillment.findMany({
      where: { organizationId },
      include: { order: true, lines: true },
      orderBy: { createdAt: "desc" }
    })
  ]);
  // Carrier status hangs off the fulfillments nested in each order, which is what the order
  // detail panel renders. One query covers every fulfillment on the screen.
  const shipments = await shipmentTrackingBySubject(organizationId, "CommerceFulfillment", [
    ...commerceFulfillments.map((fulfillment) => fulfillment.id),
    ...commerceOrders.flatMap((order) => order.fulfillments.map((fulfillment) => fulfillment.id))
  ]);
  return {
    ...collections,
    priceBookEntries,
    stores,
    commerceOrders: commerceOrders.map((order) => ({
      ...order,
      fulfillments: attachShipmentTracking(order.fulfillments, shipments)
    })),
    inventoryItems,
    commercePromotions,
    commerceFulfillments: attachShipmentTracking(commerceFulfillments, shipments)
  };
}

async function loadRecordData(organizationId: string, userId: string, object: CrmObject, id: string) {
  const detail = await getRecordDetail(organizationId, object, id);
  const data: Partial<ScopedCrmData> = {
    [dataKeyForObject(object)]: [detail.record]
  };
  const related = detail.related as Record<string, unknown>;
  const relatedMapping: Record<string, keyof ScopedCrmData> = {
    contacts: "contacts",
    opportunities: "opportunities",
    cases: "cases",
    partners: "partners",
    files: "files",
    attachments: "attachments",
    tasks: "tasks",
    emails: "emailActivities",
    calls: "callActivities",
    events: "events"
  };
  for (const [source, destination] of Object.entries(relatedMapping)) {
    if (Array.isArray(related[source])) {
      (data as Record<string, unknown>)[destination] = related[source];
    }
  }

  const [lookups, priceBookEntries] = await Promise.all([
    loadLookupCollections(organizationId, userId, editorLookupObjects(object, true)),
    needsPriceBookEntries(object, "record") ? loadPriceBookEntries(organizationId) : Promise.resolve([])
  ]);

  const relationship = { organizationId, relatedObjectType: object, relatedRecordId: id };
  const [recordLabels, campaignMembers, activities, emailDeliveries] = await Promise.all([
    prisma.recordLabel.findMany({ where: { organizationId, objectType: object, recordId: id } }),
    prisma.campaignMember.findMany({
      where: { organizationId, objectType: object, recordId: id },
      include: { campaign: true }
    }),
    Promise.all([
      prisma.task.findMany({ where: relationship, orderBy: { updatedAt: "desc" } }),
      prisma.emailActivity.findMany({ where: relationship, orderBy: { sentAt: "desc" } }),
      prisma.callActivity.findMany({ where: relationship, orderBy: { completedAt: "desc" } }),
      prisma.event.findMany({ where: relationship, orderBy: { startAt: "desc" } }),
      prisma.fileRecord.findMany({
        where: relationship,
        select: storedFileMetadataSelect,
        orderBy: { uploadedAt: "desc" }
      }),
      prisma.attachmentRecord.findMany({
        where: relationship,
        select: storedFileMetadataSelect,
        orderBy: { uploadedAt: "desc" }
      })
    ]),
    prisma.emailDelivery.findMany({
      where: { organizationId, sourceType: object, sourceId: id },
      include: { events: { orderBy: { occurredAt: "desc" }, take: 20 } },
      orderBy: { acceptedAt: "desc" }
    })
  ]);
  const [tasks, emailActivities, callActivities, events, files, attachments] = activities;
  return {
    ...mergeScopedRecordCollections(lookups, data),
    ...(needsPriceBookEntries(object, "record") ? { priceBookEntries } : {}),
    recordLabels,
    campaignMembers,
    tasks,
    emailActivities,
    callActivities,
    events,
    files,
    attachments,
    emailDeliveries
  };
}

export async function loadScopedScreenData({
  organizationId,
  userId,
  shell,
  descriptor,
  search = "",
  view = ""
}: {
  organizationId: string;
  userId: string;
  shell: ShellPayload;
  descriptor: ScreenDescriptor;
  search?: string;
  view?: string;
}): Promise<ScopedScreenPayload> {
  const users = await organizationUsers(organizationId);
  const base = emptyScreenData(shell, users);
  let screenData: Partial<ScopedCrmData> = {};
  let list: ScopedScreenPayload["list"];

  switch (descriptor.kind) {
    case "home":
      screenData = await loadHomeData(organizationId, userId);
      break;
    case "list": {
      if (descriptor.object === "Invoice") await markPastDueInvoices(organizationId, userId);
      const result = await loadObjectRecords(organizationId, userId, descriptor.object, {
        search,
        view
      });
      const ids = result.items.map((item) => String(item.id)).filter(Boolean);
      const [lookups, priceBookEntries, recordLabels, campaignMembers] = await Promise.all([
        loadLookupCollections(organizationId, userId, editorLookupObjects(descriptor.object, false)),
        needsPriceBookEntries(descriptor.object, "list") ? loadPriceBookEntries(organizationId) : Promise.resolve([]),
        prisma.recordLabel.findMany({
          where: { organizationId, objectType: descriptor.object, recordId: { in: ids } }
        }),
        prisma.campaignMember.findMany({
          where: { organizationId, objectType: descriptor.object, recordId: { in: ids } },
          include: { campaign: true }
        })
      ]);
      screenData = {
        ...lookups,
        ...(needsPriceBookEntries(descriptor.object, "list") ? { priceBookEntries } : {}),
        [dataKeyForObject(descriptor.object)]: result.items,
        recordLabels,
        campaignMembers
      };
      list = { total: result.total, nextCursor: result.nextCursor };
      break;
    }
    case "record":
      screenData = await loadRecordData(organizationId, userId, descriptor.object, descriptor.id);
      break;
    case "calendar":
      screenData = await loadCalendarData(organizationId, userId);
      break;
    case "quickText":
      screenData = await loadQuickTextData(organizationId, userId);
      break;
    case "marketing":
      screenData = await loadMarketingData(organizationId, userId);
      break;
    case "commerce":
      screenData = await loadCommerceData(organizationId, userId);
      break;
    case "analytics":
      screenData = await loadAnalyticsData(organizationId, userId);
      break;
    case "account":
      break;
  }

  return serialized({
    descriptor,
    data: decorateScopedData({ ...base, ...screenData } as ScopedCrmData),
    ...(list ? { list } : {})
  });
}
