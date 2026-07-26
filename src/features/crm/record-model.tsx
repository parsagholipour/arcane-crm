import { FORM_DEFINITIONS } from "@/lib/crm-metadata";
import { contactName, recordTitle, routeForRecord } from "@/lib/crm-data";
import { type ScopedCrmData, type CrmObject, type RecordData } from "@/lib/crm-types";
import { isCrmObject } from "@/features/routing/lightning-route";
import { type RelatedListObject } from "@/features/crm/shared-types";

export function pathMatches(pathname: string, href: string) {
  return (
    pathname === href.split("?")[0] ||
    (href.includes("/o/") && pathname.includes(href.split("?")[0].replace("/list", "").replace("/home", "")))
  );
}
export function consoleTabListHref(href: string) {
  const [path] = href.split("?");
  const segments = path.split("/").filter(Boolean);
  if (segments[1] === "r" && isCrmObject(segments[2])) return defaultRouteForObject(segments[2]);
  if (segments[1] === "o" && isCrmObject(segments[2])) return defaultRouteForObject(segments[2]);
  return href;
}
export function objectFromObjectRoute(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  return segments[1] === "o" && isCrmObject(segments[2]) ? segments[2] : null;
}
export function defaultRouteForObject(object: CrmObject) {
  if (object === "Event") return "/lightning/o/Event/home";
  if (object === "QuickText") return "/lightning/o/QuickText/home";
  return `/lightning/o/${object}/list`;
}
export function canRouteToRecord(object: CrmObject) {
  return (
    object === "Account" ||
    object === "Contact" ||
    object === "Lead" ||
    object === "Opportunity" ||
    object === "Case" ||
    object === "Product2" ||
    object === "Pricebook2" ||
    object === "Knowledge__kav" ||
    object === "ListEmail" ||
    object === "Invoice" ||
    object === "MessagingSession" ||
    object === "VideoCall" ||
    object === "Campaign"
  );
}
export function canEditFromRow(object: CrmObject) {
  return (
    object === "Invoice" ||
    object === "MessagingSession" ||
    object === "VideoCall" ||
    object === "Campaign" ||
    Boolean(FORM_DEFINITIONS[object])
  );
}
export function inlineEditableFieldForColumn(object: CrmObject, columnKey: string) {
  if (object === "Account" && ["name", "phone"].includes(columnKey)) return columnKey;
  if (object === "Contact" && ["phone", "email"].includes(columnKey)) return columnKey;
  return null;
}
export function canDeleteFromRow(object: CrmObject) {
  return [
    "Account",
    "Contact",
    "Lead",
    "Opportunity",
    "Product2",
    "Pricebook2",
    "Case",
    "QuickText",
    "Knowledge__kav",
    "ListEmail",
    "Invoice",
    "MessagingSession",
    "VideoCall",
    "Campaign"
  ].includes(object);
}
export function canChangeOwnerFromRow(object: CrmObject) {
  return ["Account", "Contact", "Lead", "Opportunity", "Case"].includes(object);
}
export function relatedRecordTitle(object: RelatedListObject, record: RecordData) {
  if (object === "Partner") return String(record.name ?? "Partner");
  return recordTitle(object, record);
}
export function potentialDuplicates(object: "Account" | "Contact", record: RecordData, data: ScopedCrmData) {
  if (object === "Account") {
    const name = normalizedText(record.name);
    const phone = normalizedText(record.phone);
    const websiteDomain = domainFromWebsite(record.website);
    return data.accounts
      .filter((account) => account.id !== record.id)
      .filter(
        (account) =>
          normalizedText(account.name) === name ||
          (phone && normalizedText(account.phone) === phone) ||
          (websiteDomain && domainFromWebsite(account.website) === websiteDomain)
      )
      .slice(0, 5);
  }
  const email = normalizedText(record.email);
  const name = normalizedText(contactName(record));
  return data.contacts
    .filter((contact) => contact.id !== record.id)
    .filter(
      (contact) =>
        (email && normalizedText(contact.email) === email) ||
        (name &&
          normalizedText(contactName(contact)) === name &&
          String(contact.accountId ?? "") === String(record.accountId ?? ""))
    )
    .slice(0, 5);
}
export function duplicateReason(object: "Account" | "Contact", source: RecordData, duplicate: RecordData) {
  if (object === "Account") {
    if (normalizedText(source.name) === normalizedText(duplicate.name)) return "Same account name";
    if (normalizedText(source.phone) && normalizedText(source.phone) === normalizedText(duplicate.phone))
      return "Same phone number";
    if (domainFromWebsite(source.website) && domainFromWebsite(source.website) === domainFromWebsite(duplicate.website))
      return "Same website domain";
  }
  if (normalizedText(source.email) && normalizedText(source.email) === normalizedText(duplicate.email))
    return "Same email address";
  return "Similar name and account";
}
export function accountHierarchyRows(record: RecordData, data: ScopedCrmData) {
  const byId = new Map(data.accounts.map((account) => [String(account.id), account]));
  const ancestors: RecordData[] = [];
  let parentId = String(record.parentAccountId ?? "");
  while (parentId && byId.has(parentId) && ancestors.length < 8) {
    const parent = byId.get(parentId)!;
    ancestors.unshift(parent);
    parentId = String(parent.parentAccountId ?? "");
  }
  const children = data.accounts.filter((account) => account.parentAccountId === record.id);
  return [...ancestors, record, ...children].map((account, index) => {
    const depth = account.id === record.id ? ancestors.length : index < ancestors.length ? index : ancestors.length + 1;
    return {
      id: requiredId(account),
      label: String(account.name ?? "Account"),
      meta:
        account.id === record.id ? "Current account" : index < ancestors.length ? "Parent account" : "Child account",
      depth,
      current: account.id === record.id,
      href: account.id === record.id ? "" : routeForRecord("Account", requiredId(account))
    };
  });
}
export function contactHierarchyRows(record: RecordData, data: ScopedCrmData) {
  const byId = new Map(data.contacts.map((contact) => [String(contact.id), contact]));
  const managers: RecordData[] = [];
  let managerId = String(record.reportsToContactId ?? "");
  while (managerId && byId.has(managerId) && managers.length < 8) {
    const manager = byId.get(managerId)!;
    managers.unshift(manager);
    managerId = String(manager.reportsToContactId ?? "");
  }
  const reports = data.contacts.filter((contact) => contact.reportsToContactId === record.id);
  return [...managers, record, ...reports].map((contact, index) => {
    const depth = contact.id === record.id ? managers.length : index < managers.length ? index : managers.length + 1;
    return {
      id: requiredId(contact),
      label: contactName(contact),
      meta: contact.id === record.id ? "Current contact" : index < managers.length ? "Reports up" : "Direct report",
      depth,
      current: contact.id === record.id,
      href: contact.id === record.id ? "" : routeForRecord("Contact", requiredId(contact))
    };
  });
}
export function normalizedText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}
export function domainFromWebsite(value: unknown) {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!raw) return "";
  try {
    return new URL(raw.startsWith("http") ? raw : `https://${raw}`).hostname.replace(/^www\./, "");
  } catch {
    return raw
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0];
  }
}
export function quickTextViewCount(view: string, data: ScopedCrmData, favorites: string[]) {
  if (view === "Recent") return Math.min(10, data.quickTexts.length);
  if (view === "All Quick Text") return data.quickTexts.length;
  if (view === "All Favorites") return favorites.length;
  if (view === "All Folders") return data.quickTextFolders.length;
  if (view === "Created by Me") return data.quickTextFolders.filter((folder) => folder.ownerId === data.user.id).length;
  if (view === "Shared with Me")
    return data.quickTextFolders.filter((folder) =>
      String(folder.sharing ?? "")
        .toLowerCase()
        .match(/shared|public/)
    ).length;
  return 0;
}
export function quickTextMatches(record: RecordData, query: string, foldersById: Map<string, RecordData>) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  const folder = foldersById.get(String(record.folderId ?? ""));
  return [
    record.name,
    record.message,
    record.category,
    Array.isArray(record.channels) ? record.channels.join(" ") : "",
    folder?.name
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}
export function quickTextTimestamp(record: RecordData) {
  const parsed = Date.parse(String(record.updatedAt ?? record.createdAt ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
}
export function requiredId(record: RecordData) {
  return String(record.id ?? "");
}
