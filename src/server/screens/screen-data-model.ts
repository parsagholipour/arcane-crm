import type { CrmObject, RecordData, ScopedCrmData } from "@/lib/crm-types";

const baseEditorLookups: readonly CrmObject[] = ["Account", "Contact"];

const objectEditorLookups: Partial<Record<CrmObject, readonly CrmObject[]>> = {
  Lead: ["Opportunity", "Product2"],
  Opportunity: ["Product2"],
  Product2: ["Opportunity", "Product2", "Pricebook2"],
  Pricebook2: ["Opportunity", "Product2", "Pricebook2"],
  MessagingSession: ["Opportunity"],
  ListEmail: ["Lead"],
  Campaign: ["Campaign"],
  Invoice: ["Opportunity", "Product2", "Pricebook2"],
  VideoCall: ["Opportunity"]
};

export const calendarEditorLookups: readonly CrmObject[] = [
  "Account",
  "Contact",
  "Lead",
  "Opportunity",
  "Case",
  "Campaign",
  "Invoice",
  "ListEmail",
  "Product2"
];

export function editorLookupObjects(object: CrmObject, includeCurrentObject: boolean) {
  const objects = [...new Set([...baseEditorLookups, ...(objectEditorLookups[object] ?? [])])];
  return includeCurrentObject ? objects : objects.filter((lookupObject) => lookupObject !== object);
}

/**
 * Product rows are decorated with their primary list price, while Product and Price Book detail
 * pages render their entries directly. Invoice editors also need the entries for line pricing,
 * as do the Opportunity Products and Lead Sample Products cards when they suggest a sales price.
 */
export function needsPriceBookEntries(object: CrmObject, screenKind: "list" | "record") {
  return (
    object === "Invoice" ||
    object === "Product2" ||
    ((object === "Pricebook2" || object === "Opportunity" || object === "Lead") && screenKind === "record")
  );
}

function mergeRecordsById(primary: RecordData[], lookups: RecordData[]) {
  const ids = new Set<string>();
  return [...primary, ...lookups].filter((record) => {
    const id = String(record.id ?? "");
    if (!id) return true;
    if (ids.has(id)) return false;
    ids.add(id);
    return true;
  });
}

/** Keep detailed/related records first while retaining lookup choices loaded for edit forms. */
export function mergeScopedRecordCollections(
  lookups: Partial<ScopedCrmData>,
  recordData: Partial<ScopedCrmData>
): Partial<ScopedCrmData> {
  const merged = { ...lookups, ...recordData } as Record<string, unknown>;
  for (const [key, lookupValue] of Object.entries(lookups)) {
    const primaryValue = (recordData as Record<string, unknown>)[key];
    if (!Array.isArray(primaryValue) || !Array.isArray(lookupValue)) continue;
    merged[key] = mergeRecordsById(primaryValue as RecordData[], lookupValue as RecordData[]);
  }
  return merged as Partial<ScopedCrmData>;
}
