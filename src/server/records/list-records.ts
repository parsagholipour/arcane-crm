import "server-only";

import { invoiceInclude } from "@/lib/invoices";
import { OBJECT_DEFINITIONS } from "@/lib/crm-metadata";
import { prisma } from "@/lib/prisma";
import type { GenericRecord, ListQuery, ListResult } from "@/lib/api/contracts";
import type { CrmObject } from "@/lib/crm-types";

type QueryArguments = Record<string, unknown>;
type RecordDelegate = {
  findMany(arguments_: QueryArguments): Promise<GenericRecord[]>;
  count(arguments_: QueryArguments): Promise<number>;
};

type ModelConfig = {
  delegate: RecordDelegate;
  searchFields: string[];
  sortFields: string[];
  defaultSort: string;
  include?: Record<string, unknown>;
  ownerField?: string;
};

export class RecordListQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecordListQueryError";
  }
}

function delegate(value: unknown): RecordDelegate {
  return value as RecordDelegate;
}

function modelConfig(object: CrmObject): ModelConfig {
  switch (object) {
    case "Account":
      return {
        delegate: delegate(prisma.account),
        searchFields: ["name", "website", "phone"],
        sortFields: ["name", "updatedAt", "createdAt", "type"],
        defaultSort: "updatedAt",
        ownerField: "ownerId"
      };
    case "Contact":
      return {
        delegate: delegate(prisma.contact),
        searchFields: ["firstName", "lastName", "email", "phone", "title"],
        sortFields: ["firstName", "lastName", "email", "updatedAt"],
        defaultSort: "updatedAt",
        include: { account: true },
        ownerField: "ownerId"
      };
    case "Lead":
      return {
        delegate: delegate(prisma.lead),
        searchFields: ["firstName", "lastName", "company", "email", "phone"],
        sortFields: ["firstName", "lastName", "company", "status", "updatedAt"],
        defaultSort: "updatedAt",
        ownerField: "ownerId"
      };
    case "Opportunity":
      return {
        delegate: delegate(prisma.opportunity),
        searchFields: ["name", "stage", "trackingNumber"],
        sortFields: ["name", "stage", "amount", "closeDate", "updatedAt"],
        defaultSort: "updatedAt",
        include: { account: true, contact: true },
        ownerField: "ownerId"
      };
    case "Product2":
      return {
        delegate: delegate(prisma.product),
        searchFields: ["name", "productCode", "sku", "family", "category"],
        sortFields: ["name", "productCode", "family", "updatedAt"],
        defaultSort: "updatedAt"
      };
    case "Pricebook2":
      return {
        delegate: delegate(prisma.priceBook),
        searchFields: ["name", "description"],
        sortFields: ["name", "updatedAt", "validFrom", "validTo"],
        defaultSort: "updatedAt"
      };
    case "Event":
      return {
        delegate: delegate(prisma.event),
        searchFields: ["subject", "description", "location"],
        sortFields: ["subject", "startAt", "endAt", "updatedAt"],
        defaultSort: "startAt",
        ownerField: "assignedToId"
      };
    case "Case":
      return {
        delegate: delegate(prisma.caseRecord),
        searchFields: ["caseNumber", "subject", "status", "priority"],
        sortFields: ["caseNumber", "subject", "status", "priority", "updatedAt"],
        defaultSort: "updatedAt",
        include: { account: true, contact: true },
        ownerField: "ownerId"
      };
    case "QuickText":
      return {
        delegate: delegate(prisma.quickText),
        searchFields: ["name", "message", "category"],
        sortFields: ["name", "category", "updatedAt"],
        defaultSort: "updatedAt",
        include: { folder: true },
        ownerField: "createdById"
      };
    case "MessagingSession":
      return {
        delegate: delegate(prisma.messagingSession),
        searchFields: ["subject", "status", "channel"],
        sortFields: ["subject", "status", "updatedAt"],
        defaultSort: "updatedAt",
        include: { account: true, contact: true, participants: true },
        ownerField: "ownerId"
      };
    case "Knowledge__kav":
      return {
        delegate: delegate(prisma.knowledgeArticle),
        searchFields: ["title", "summary", "articleNumber", "publicationStatus"],
        sortFields: ["title", "articleNumber", "publicationStatus", "updatedAt"],
        defaultSort: "updatedAt"
      };
    case "ListEmail":
      return {
        delegate: delegate(prisma.listEmail),
        searchFields: ["subject", "body", "status"],
        sortFields: ["subject", "status", "createdAt", "scheduledAt", "sentAt"],
        defaultSort: "createdAt",
        ownerField: "createdById"
      };
    case "Campaign":
      return {
        delegate: delegate(prisma.campaign),
        searchFields: ["name", "status", "type", "description"],
        sortFields: ["name", "status", "startDate", "endDate", "updatedAt"],
        defaultSort: "updatedAt",
        include: { members: true, parentCampaign: { select: { id: true, name: true } } },
        ownerField: "ownerId"
      };
    case "Invoice":
      return {
        delegate: delegate(prisma.invoice),
        searchFields: ["invoiceNumber", "status", "notes"],
        sortFields: ["invoiceNumber", "status", "issueDate", "dueDate", "updatedAt"],
        defaultSort: "updatedAt",
        include: invoiceInclude
      };
    case "VideoCall":
      return {
        delegate: delegate(prisma.videoCall),
        searchFields: ["subject", "status", "provider", "meetingUrl"],
        sortFields: ["subject", "status", "scheduledStartAt", "updatedAt"],
        defaultSort: "scheduledStartAt",
        include: { account: true, contact: true, opportunity: true, participants: true },
        ownerField: "organizerId"
      };
  }
}

function normalizedView(value: string) {
  return value
    .replace(/^__/, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
}

function viewWhere(object: CrmObject, view: string, userId: string, ownerField?: string, allowCustom = false) {
  if (!view) return {};
  const definition = OBJECT_DEFINITIONS[object];
  const requested = normalizedView(view);
  const allowed = [definition.defaultList, ...definition.listViews].some(
    (candidate) => normalizedView(candidate) === requested
  );
  if (!allowed && requested !== "recent" && !allowCustom) {
    throw new RecordListQueryError(`Unknown ${definition.label} list view.`);
  }

  if (requested.startsWith("my") && ownerField) return { [ownerField]: userId };
  if (requested.includes("open") && object === "Case") return { status: { not: "Closed" } };
  if (requested.includes("open") && object === "Opportunity") {
    return { stage: { notIn: ["Closed Won", "Closed Lost"] } };
  }
  if (requested.includes("unread") && object === "Lead") return { status: "New" };
  if (requested.includes("draft") && object === "Knowledge__kav") return { publicationStatus: "Draft" };
  if (requested.includes("published") && object === "Knowledge__kav") {
    return { publicationStatus: "Published" };
  }
  if (requested.includes("archived") && object === "Knowledge__kav") return { publicationStatus: "Archived" };
  return {};
}

function searchWhere(fields: string[], search: string) {
  if (!search) return {};
  return {
    OR: fields.map((field) => ({
      [field]: { contains: search, mode: "insensitive" }
    }))
  };
}

function serializeRecords(records: GenericRecord[]) {
  return JSON.parse(JSON.stringify(records)) as GenericRecord[];
}

export async function listRecords(
  organizationId: string,
  userId: string,
  object: CrmObject,
  query: ListQuery
): Promise<ListResult<GenericRecord>> {
  const config = modelConfig(object);
  const requestedView = normalizedView(query.view);
  const definition = OBJECT_DEFINITIONS[object];
  const isStandardView =
    !query.view ||
    requestedView === "recent" ||
    [definition.defaultList, ...definition.listViews].some((candidate) => normalizedView(candidate) === requestedView);
  const customView = isStandardView
    ? null
    : await prisma.listViewPreference.findFirst({
        where: {
          organizationId,
          userId,
          object,
          viewName: { equals: query.view, mode: "insensitive" }
        },
        select: { id: true }
      });
  if (!isStandardView && !customView) {
    throw new RecordListQueryError(`Unknown ${definition.label} list view.`);
  }
  const where = {
    organizationId,
    ...viewWhere(object, query.view, userId, config.ownerField, Boolean(customView)),
    ...searchWhere(config.searchFields, query.search)
  };
  const sort = query.sort || config.defaultSort;
  if (!config.sortFields.includes(sort)) {
    throw new RecordListQueryError(`Unsupported sort field for ${OBJECT_DEFINITIONS[object].plural}.`);
  }

  const [records, total] = await Promise.all([
    config.delegate.findMany({
      where,
      orderBy: { [sort]: query.direction },
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      ...(config.include ? { include: config.include } : {})
    }),
    config.delegate.count({ where })
  ]);
  const hasNextPage = records.length > query.limit;
  const items = hasNextPage ? records.slice(0, query.limit) : records;

  return {
    items: serializeRecords(items),
    total,
    nextCursor: hasNextPage ? String(items.at(-1)?.id ?? "") || null : null
  };
}
