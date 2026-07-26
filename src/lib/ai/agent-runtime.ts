import "server-only";

import { prisma } from "@/lib/prisma";
import type { AiFact, AiNavigationAction } from "@/lib/ai-types";
import {
  actionCatalog,
  type AgentRuntime,
  objectFields,
  searchFields,
  type ToolFilter,
  type ToolObject
} from "@/lib/ai/agent-tool-contracts";
import { displayName, formatUsd, groupCounts, isObject, serializeValue, truncate } from "@/lib/ai/agent-utils";

export async function executeTool(name: string, argumentText: string, runtime: AgentRuntime) {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(argumentText || "{}");
  } catch {
    return { error: "Tool arguments were not valid JSON." };
  }
  if (name === "get_workspace_summary") return loadWorkspaceSummary(runtime);
  if (name === "query_records") return queryRecords(args, runtime);
  if (name === "get_record_context") return getRecordContext(args, runtime);
  if (name === "get_record_activities") return getRecordActivities(args, runtime);
  return { error: "Unknown read-only tool." };
}

async function loadWorkspaceSummary(runtime: AgentRuntime) {
  const [
    accountCount,
    contactCount,
    leadCount,
    openOpportunities,
    openCaseCount,
    highCaseCount,
    overdueTaskCount,
    nextEvents,
    leadStatusRows
  ] = await Promise.all([
    prisma.account.count({ where: { organizationId: runtime.organizationId } }),
    prisma.contact.count({ where: { organizationId: runtime.organizationId } }),
    prisma.lead.count({ where: { organizationId: runtime.organizationId } }),
    prisma.opportunity.findMany({
      where: { organizationId: runtime.organizationId, stage: { notIn: ["Closed Won", "Closed Lost"] } },
      select: { id: true, name: true, stage: true, amount: true, closeDate: true, accountId: true },
      orderBy: { amount: "desc" }
    }),
    prisma.caseRecord.count({ where: { organizationId: runtime.organizationId, status: { not: "Closed" } } }),
    prisma.caseRecord.count({
      where: { organizationId: runtime.organizationId, status: { not: "Closed" }, priority: "High" }
    }),
    prisma.task.count({
      where: {
        organizationId: runtime.organizationId,
        status: { notIn: ["Completed", "Closed"] },
        dueDate: { lt: new Date() }
      }
    }),
    prisma.event.findMany({
      where: { organizationId: runtime.organizationId, startAt: { gte: new Date() } },
      select: { id: true, subject: true, startAt: true },
      orderBy: { startAt: "asc" },
      take: 5
    }),
    prisma.lead.groupBy({ by: ["status"], where: { organizationId: runtime.organizationId }, _count: { _all: true } })
  ]);
  const pipelineAmount = openOpportunities.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const facts: AiFact[] = [
    { id: "workspace_accounts", label: "Accounts", value: String(accountCount) },
    { id: "workspace_contacts", label: "Contacts", value: String(contactCount) },
    { id: "workspace_leads", label: "Leads", value: String(leadCount) },
    { id: "workspace_open_opportunities", label: "Open Opportunities", value: String(openOpportunities.length) },
    { id: "workspace_pipeline", label: "Open Pipeline", value: formatUsd(pipelineAmount) },
    { id: "workspace_open_cases", label: "Open Cases", value: String(openCaseCount) },
    { id: "workspace_high_cases", label: "High-Priority Cases", value: String(highCaseCount) },
    { id: "workspace_overdue_tasks", label: "Overdue Tasks", value: String(overdueTaskCount) }
  ];
  facts.forEach((fact) => runtime.facts.set(fact.id, fact));
  openOpportunities.slice(0, 10).forEach((record) => rememberRecord("Opportunity", record, runtime));
  nextEvents.forEach((record) => rememberRecord("Event", record, runtime));
  return {
    facts,
    allowedActionIds: actionCatalog.map((action) => action.id),
    pipelineByStage: groupCounts(openOpportunities, (item) => item.stage),
    leadByStatus: Object.fromEntries(leadStatusRows.map((row) => [row.status, row._count._all])),
    largestOpenOpportunities: openOpportunities.slice(0, 5).map((record) => sanitizeRecord("Opportunity", record)),
    upcomingEvents: nextEvents.map((record) => sanitizeRecord("Event", record)),
    currentDate: new Date().toISOString()
  };
}

async function queryRecords(args: Record<string, unknown>, runtime: AgentRuntime) {
  const object = args.object;
  if (!isToolObject(object)) return { error: "Unsupported CRM object." };
  const filters = Array.isArray(args.filters) ? args.filters.filter(isToolFilter).slice(0, 6) : [];
  const where = buildWhere(object, String(args.search ?? ""), filters, runtime.organizationId);
  const sortField =
    typeof args.sortField === "string" && objectFields[object][args.sortField]
      ? args.sortField
      : defaultSortField(object);
  const sortDirection = args.sortDirection === "asc" ? "asc" : "desc";
  const limit = Math.max(1, Math.min(Number(args.limit) || 10, 20));
  const delegateName = delegateForObject(object);
  const delegate = prisma[delegateName] as unknown as {
    findMany(args: Record<string, unknown>): Promise<Array<Record<string, unknown>>>;
  };
  const rows = await delegate.findMany({ where, orderBy: { [sortField]: sortDirection }, take: limit });
  rows.forEach((record) => rememberRecord(object, record, runtime));
  return {
    object,
    countReturned: rows.length,
    records: rows.map((record) => sanitizeRecord(object, record)),
    allowedFields: Object.keys(objectFields[object]),
    allowedActionIds: [...runtime.actions.keys()]
  };
}

async function getRecordContext(args: Record<string, unknown>, runtime: AgentRuntime) {
  const object = args.object;
  const id = String(args.id ?? "");
  if (!isToolObject(object) || !["Account", "Contact", "Lead", "Opportunity", "Case"].includes(object) || !id)
    return { error: "Unsupported record lookup." };
  const delegate = prisma[delegateForObject(object)] as unknown as {
    findFirst(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
  };
  const record = await delegate.findFirst({ where: { id, organizationId: runtime.organizationId } });
  if (!record) return { error: "Record not found in the active organization." };
  rememberRecord(object, record, runtime);
  const relationships = await loadRelationships(object, id, runtime.organizationId);
  return {
    object,
    record: sanitizeRecord(object, record),
    relationships,
    allowedActionIds: [...runtime.actions.keys()]
  };
}

async function getRecordActivities(args: Record<string, unknown>, runtime: AgentRuntime) {
  const object = args.object;
  const id = String(args.id ?? "");
  if ((object !== "Account" && object !== "Contact") || !id)
    return { error: "Activities are supported for Account and Contact records." };
  const exists =
    object === "Account"
      ? await prisma.account.findFirst({ where: { id, organizationId: runtime.organizationId }, select: { id: true } })
      : await prisma.contact.findFirst({ where: { id, organizationId: runtime.organizationId }, select: { id: true } });
  if (!exists) return { error: "Record not found in the active organization." };
  const activities = await loadActivities(runtime.organizationId, object, id);
  return { object, recordId: id, activities };
}

function buildWhere(object: ToolObject, search: string, filters: ToolFilter[], organizationId: string) {
  const conditions: Array<Record<string, unknown>> = [{ organizationId }];
  if (search.trim()) {
    conditions.push({
      OR: searchFields[object].map((field) => ({
        [field]: { contains: truncate(search.trim(), 200), mode: "insensitive" }
      }))
    });
  }
  for (const filter of filters) {
    const kind = objectFields[object][filter.field];
    if (!kind) continue;
    const value = normalizeFilterValue(filter.value, kind, filter.operator);
    if (value === undefined) continue;
    if (filter.operator === "eq") conditions.push({ [filter.field]: value });
    else if (filter.operator === "in" && Array.isArray(value)) conditions.push({ [filter.field]: { in: value } });
    else if (filter.operator === "contains" && kind === "string")
      conditions.push({ [filter.field]: { contains: value, mode: "insensitive" } });
    else {
      const prismaOperator = filter.operator === "before" ? "lt" : filter.operator === "after" ? "gt" : filter.operator;
      conditions.push({ [filter.field]: { [prismaOperator]: value } });
    }
  }
  return { AND: conditions };
}

function normalizeFilterValue(
  value: unknown,
  kind: "string" | "number" | "date",
  operator: ToolFilter["operator"]
): string | number | Date | Array<string | number | Date> | undefined {
  if (operator === "in") {
    if (!Array.isArray(value)) return undefined;
    return value
      .slice(0, 20)
      .map((item) => normalizeFilterValue(item, kind, "eq"))
      .filter((item): item is string | number | Date => item !== undefined && !Array.isArray(item));
  }
  if (kind === "number") {
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
  }
  if (kind === "date") {
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  return truncate(String(value), 300);
}

async function loadRelationships(object: ToolObject, id: string, organizationId: string) {
  if (object === "Account") {
    const [contacts, opportunities, cases] = await Promise.all([
      prisma.contact.findMany({
        where: { organizationId, accountId: id },
        select: { id: true, firstName: true, lastName: true, title: true, email: true },
        take: 20
      }),
      prisma.opportunity.findMany({
        where: { organizationId, accountId: id },
        select: { id: true, name: true, stage: true, amount: true, closeDate: true },
        take: 20
      }),
      prisma.caseRecord.findMany({
        where: { organizationId, accountId: id },
        select: { id: true, caseNumber: true, subject: true, status: true, priority: true },
        take: 20
      })
    ]);
    return { contacts, opportunities, cases };
  }
  if (object === "Contact") {
    const contact = await prisma.contact.findFirst({ where: { organizationId, id }, select: { accountId: true } });
    const [account, opportunities, cases] = await Promise.all([
      contact
        ? prisma.account.findFirst({
            where: { organizationId, id: contact.accountId },
            select: { id: true, name: true, type: true }
          })
        : null,
      prisma.opportunity.findMany({
        where: { organizationId, contactId: id },
        select: { id: true, name: true, stage: true, amount: true, closeDate: true },
        take: 20
      }),
      prisma.caseRecord.findMany({
        where: { organizationId, contactId: id },
        select: { id: true, caseNumber: true, subject: true, status: true, priority: true },
        take: 20
      })
    ]);
    return { account, opportunities, cases };
  }
  return {};
}

export async function loadActivities(organizationId: string, object: "Account" | "Contact", id: string) {
  const relatedTypes = object === "Account" ? ["Account", "Accounts"] : ["Contact", "Contacts"];
  const [emails, calls, tasks, events] = await Promise.all([
    prisma.emailActivity.findMany({
      where: { organizationId, relatedObjectType: { in: relatedTypes }, relatedRecordId: id },
      orderBy: { sentAt: "desc" },
      take: 20
    }),
    prisma.callActivity.findMany({
      where: { organizationId, relatedObjectType: { in: relatedTypes }, relatedRecordId: id },
      orderBy: { completedAt: "desc" },
      take: 20
    }),
    prisma.task.findMany({
      where: { organizationId, relatedObjectType: { in: relatedTypes }, relatedRecordId: id },
      orderBy: { updatedAt: "desc" },
      take: 20
    }),
    prisma.event.findMany({
      where: {
        organizationId,
        OR: [
          { relatedObjectType: { in: relatedTypes }, relatedRecordId: id },
          ...(object === "Contact" ? [{ nameObjectType: { in: relatedTypes }, nameRecordId: id }] : [])
        ]
      },
      orderBy: { startAt: "desc" },
      take: 20
    })
  ]);
  return [
    ...emails.map((item) => ({
      id: item.id,
      kind: "Email",
      subject: item.subject,
      body: truncate(item.body ?? "", 2000),
      to: item.to,
      date: item.sentAt
    })),
    ...calls.map((item) => ({
      id: item.id,
      kind: "Call",
      subject: item.subject,
      comments: truncate(item.comments ?? "", 2000),
      date: item.completedAt
    })),
    ...tasks.map((item) => ({
      id: item.id,
      kind: "Task",
      subject: item.subject,
      status: item.status,
      priority: item.priority,
      dueDate: item.dueDate,
      date: item.updatedAt
    })),
    ...events.map((item) => ({
      id: item.id,
      kind: "Event",
      subject: item.subject,
      description: truncate(item.description ?? "", 2000),
      startAt: item.startAt,
      endAt: item.endAt,
      date: item.startAt
    }))
  ]
    .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
    .slice(0, 20);
}

function rememberRecord(object: ToolObject, record: Record<string, unknown>, runtime: AgentRuntime) {
  const id = String(record.id ?? "");
  if (!id) return;
  runtime.knownRecordIds.add(id);
  if (object === "Account" || object === "Contact") {
    const action: AiNavigationAction = {
      id: `open_${object.toLowerCase()}_${id}`,
      label: object === "Contact" ? `Open ${displayName(record)}` : `Open ${String(record.name ?? "Account")}`,
      href: `/lightning/r/${object}/${encodeURIComponent(id)}/view`
    };
    runtime.actions.set(action.id, action);
  }
}

function sanitizeRecord(object: ToolObject, record: Record<string, unknown>) {
  const fields = Object.keys(objectFields[object]);
  return Object.fromEntries(
    fields
      .filter((field) => record[field] !== undefined && record[field] !== null)
      .map((field) => [field, serializeValue(record[field])])
  );
}

export async function loadRecipients(organizationId: string, ids: string[]) {
  const [contacts, leads, accounts] = await Promise.all([
    prisma.contact.findMany({
      where: { organizationId, id: { in: ids } },
      select: { id: true, firstName: true, lastName: true, email: true }
    }),
    prisma.lead.findMany({
      where: { organizationId, id: { in: ids } },
      select: { id: true, firstName: true, lastName: true, company: true, email: true }
    }),
    prisma.account.findMany({
      where: { organizationId, id: { in: ids } },
      select: { id: true, name: true }
    })
  ]);
  const rows = [
    ...contacts.map((item) => ({
      id: item.id,
      name: [item.firstName, item.lastName].filter(Boolean).join(" "),
      email: item.email
    })),
    ...leads.map((item) => ({
      id: item.id,
      name: [item.firstName, item.lastName].filter(Boolean).join(" ") || item.company,
      email: item.email
    })),
    ...accounts.map((item) => ({ id: item.id, name: item.name, email: null }))
  ];
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.map((id) => byId.get(id)).filter((item): item is NonNullable<typeof item> => Boolean(item));
}

function isToolObject(value: unknown): value is ToolObject {
  return typeof value === "string" && value in objectFields;
}

function isToolFilter(value: unknown): value is ToolFilter {
  return (
    isObject(value) &&
    typeof value.field === "string" &&
    ["eq", "in", "contains", "before", "after", "gte", "lte"].includes(String(value.operator))
  );
}

function delegateForObject(
  object: ToolObject
): "account" | "contact" | "lead" | "opportunity" | "caseRecord" | "event" | "task" {
  if (object === "Case") return "caseRecord";
  return object.toLowerCase() as "account" | "contact" | "lead" | "opportunity" | "event" | "task";
}

function defaultSortField(object: ToolObject) {
  return object === "Event" ? "startAt" : object === "Case" ? "openedAt" : object === "Task" ? "dueDate" : "updatedAt";
}
