import "server-only";

import { z } from "zod";
import { AppAuthorizationError } from "@/lib/authorization-errors";
import { leadSampleProductInclude, leadSampleProductOrder } from "@/lib/lead-sample-products";
import { prisma } from "@/lib/prisma";
import { serializePublicLead, type PublicLead, type PublicLeadOwner } from "@/lib/public-api/lead-serialize";

export { serializeDeletedLead, serializePublicLead } from "@/lib/public-api/lead-serialize";
export type { PublicLead, PublicLeadDeleted, PublicLeadOwner } from "@/lib/public-api/lead-serialize";

export const publicLeadListQuerySchema = z.object({
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(200).default(""),
  status: z.string().trim().max(80).optional(),
  converted: z.enum(["true", "false"]).optional(),
  updatedSince: z.coerce.date().optional()
});

export type PublicLeadListQuery = z.infer<typeof publicLeadListQuerySchema>;

type JsonRecord = Record<string, unknown>;

const leadPublicInclude = {
  sampleProducts: { include: leadSampleProductInclude, orderBy: leadSampleProductOrder }
} as const;

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function ownersById(ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map<string, PublicLeadOwner>();
  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true, alias: true, email: true }
  });
  return new Map(users.map((user) => [user.id, user]));
}

async function shipmentsByLeadId(organizationId: string, leadIds: string[]) {
  if (leadIds.length === 0) return new Map<string, JsonRecord>();
  const rows = await prisma.shipmentTracking.findMany({
    where: { organizationId, subjectType: "Lead", subjectId: { in: leadIds } }
  });
  return new Map(rows.map((row) => [row.subjectId, jsonClone(row) as JsonRecord]));
}

async function hydratePublicLeads(organizationId: string, leads: JsonRecord[]): Promise<PublicLead[]> {
  const ownerMap = await ownersById(leads.map((lead) => String(lead.ownerId)));
  const shipmentMap = await shipmentsByLeadId(
    organizationId,
    leads.map((lead) => String(lead.id))
  );
  return leads.map((lead) =>
    serializePublicLead(lead, ownerMap.get(String(lead.ownerId)) ?? null, shipmentMap.get(String(lead.id)))
  );
}

export async function loadPublicLead(organizationId: string, id: string) {
  const lead = await prisma.lead.findFirst({
    where: { id, organizationId },
    include: leadPublicInclude
  });
  if (!lead) throw new AppAuthorizationError("Record not found.", 404);
  const [hydrated] = await hydratePublicLeads(organizationId, [jsonClone(lead) as JsonRecord]);
  return hydrated;
}

function searchWhere(search: string) {
  if (!search) return {};
  return {
    OR: ["firstName", "lastName", "company", "email", "phone"].map((field) => ({
      [field]: { contains: search, mode: "insensitive" as const }
    }))
  };
}

export async function listPublicLeads(organizationId: string, query: PublicLeadListQuery) {
  const where = {
    organizationId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.converted === "true"
      ? { convertedAt: { not: null } }
      : query.converted === "false"
        ? { convertedAt: null }
        : {}),
    ...(query.updatedSince ? { updatedAt: { gte: query.updatedSince } } : {}),
    ...searchWhere(query.search)
  };

  const [records, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: leadPublicInclude,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {})
    }),
    prisma.lead.count({ where })
  ]);

  const hasNextPage = records.length > query.limit;
  const page = hasNextPage ? records.slice(0, query.limit) : records;
  const items = await hydratePublicLeads(
    organizationId,
    page.map((record) => jsonClone(record) as JsonRecord)
  );
  return {
    items,
    total,
    nextCursor: hasNextPage ? String(page.at(-1)?.id ?? "") || null : null
  };
}
