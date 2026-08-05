import { OBJECT_DEFINITIONS } from "@/lib/crm-metadata";
import { CONVERSION_CLOSE_DATE_OFFSET_DAYS, daysFromNow } from "@/lib/lead-conversion";
import { type CrmObject, type RecordData } from "@/lib/crm-types";
import { requiredId } from "@/features/crm/record-model";

export const objectList = Object.keys(OBJECT_DEFINITIONS) as CrmObject[];
export function isRecordData(value: unknown): value is RecordData {
  return typeof value === "object" && value !== null;
}
export function labelsFromData(labels: RecordData[] = []) {
  return labels.reduce<Record<string, string[]>>((accumulator, label) => {
    const recordId = String(label.recordId ?? "");
    if (!recordId) return accumulator;
    accumulator[recordId] = Array.from(
      new Set([...(accumulator[recordId] ?? []), String(label.label ?? "")].filter(Boolean))
    );
    return accumulator;
  }, {});
}
export function campaignMembersFromData(members: RecordData[] = [], campaigns: RecordData[] = []) {
  const campaignById = new Map(campaigns.map((campaign) => [String(campaign.id), String(campaign.name ?? "Campaign")]));
  return members.reduce<Record<string, string[]>>((accumulator, member) => {
    const recordId = String(member.recordId ?? "");
    if (!recordId) return accumulator;
    const campaignName = campaignById.get(String(member.campaignId)) ?? String(member.campaignName ?? "Campaign");
    accumulator[recordId] = Array.from(new Set([...(accumulator[recordId] ?? []), campaignName]));
    return accumulator;
  }, {});
}
export function leadConversionResultFromWorkflow(result: RecordData) {
  return {
    accounts: recordArray(result.accounts),
    contacts: recordArray(result.contacts),
    opportunities: recordArray(result.opportunities),
    leads: recordArray(result.leads)
  };
}
export function recordArray(value: unknown) {
  return Array.isArray(value) ? value.filter(isRecordData) : [];
}
export function upsertRecordsById(existing: RecordData[], incoming: RecordData[]) {
  if (incoming.length === 0) return existing;
  const incomingById = new Map<string, RecordData>();
  incoming.forEach((record) => {
    const id = requiredId(record);
    if (id) incomingById.set(id, record);
  });
  const existingIds = new Set(existing.map(requiredId));
  const updated = existing.map((record) => {
    const next = incomingById.get(requiredId(record));
    return next ? { ...record, ...next } : record;
  });
  const created = incoming.filter((record) => {
    const id = requiredId(record);
    return id && !existingIds.has(id);
  });
  return [...created, ...updated];
}
export function defaultLeadConversionCloseDate() {
  return daysFromNow(CONVERSION_CLOSE_DATE_OFFSET_DAYS).toISOString().slice(0, 10);
}
export function enrichLocalRecord(object: CrmObject, record: RecordData, currentUserId: string): RecordData {
  const now = new Date().toISOString();
  const base: RecordData = {
    createdAt: now,
    updatedAt: now,
    createdById: currentUserId,
    updatedById: currentUserId,
    ownerId: currentUserId,
    ...record
  };
  if (object === "Case" && !base.caseNumber)
    return { ...base, caseNumber: `0000${Math.floor(Math.random() * 9000) + 1000}`, openedAt: now };
  if (object === "Knowledge__kav" && !base.articleNumber)
    return {
      ...base,
      articleNumber: `KA-${Math.floor(Math.random() * 900000) + 100000}`,
      publicationStatus: "Draft",
      validationStatus: "Not Validated"
    };
  return base;
}
