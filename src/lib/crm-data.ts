import { CURRENT_USER } from "@/lib/crm-metadata";
import type { BootstrapData, CrmObject, RecordData } from "@/lib/crm-types";

export function decorateBootstrap(data: BootstrapData): BootstrapData {
  const accountsById = new Map(data.accounts.map((account) => [String(account.id), account]));
  const contactsById = new Map(data.contacts.map((contact) => [String(contact.id), contact]));
  const priceBooksById = new Map(data.priceBooks.map((priceBook) => [String(priceBook.id), priceBook]));
  const priceBookEntriesByProductId = new Map<string, RecordData[]>();

  data.priceBookEntries.forEach((entry) => {
    if (!entry.productId) return;
    const productId = String(entry.productId);
    priceBookEntriesByProductId.set(productId, [...(priceBookEntriesByProductId.get(productId) ?? []), entry]);
  });

  const ownerAlias = (ownerId?: unknown) => (ownerId === data.user.id || !ownerId ? data.user.alias : String(ownerId));
  const ownerName = (ownerId?: unknown) => (ownerId === data.user.id || !ownerId ? data.user.name : String(ownerId));

  return {
    ...data,
    accounts: data.accounts.map((account) => ({
      ...account,
      ownerAlias: ownerAlias(account.ownerId),
      ownerName: ownerName(account.ownerId)
    })),
    contacts: data.contacts.map((contact) => {
      const account = accountsById.get(String(contact.accountId)) ?? (contact.account as RecordData | undefined);
      return {
        ...contact,
        displayName: contactName(contact),
        accountName: account?.name ?? "",
        ownerAlias: ownerAlias(contact.ownerId),
        ownerName: ownerName(contact.ownerId)
      };
    }),
    leads: data.leads.map((lead) => ({
      ...lead,
      displayName: contactName(lead),
      ownerAlias: ownerAlias(lead.ownerId)
    })),
    opportunities: data.opportunities.map((opportunity) => ({
      ...opportunity,
      accountName: accountsById.get(String(opportunity.accountId))?.name ?? (opportunity.account as RecordData | undefined)?.name ?? "",
      contactName: contactsById.get(String(opportunity.contactId)) ? contactName(contactsById.get(String(opportunity.contactId))!) : "",
      ownerAlias: ownerAlias(opportunity.ownerId)
    })),
    cases: data.cases.map((caseRecord) => ({
      ...caseRecord,
      accountName: accountsById.get(String(caseRecord.accountId))?.name ?? (caseRecord.account as RecordData | undefined)?.name ?? "",
      contactName: contactsById.get(String(caseRecord.contactId)) ? contactName(contactsById.get(String(caseRecord.contactId))!) : "",
      ownerAlias: ownerAlias(caseRecord.ownerId)
    })),
    products: data.products.map((product) => {
      const entries = priceBookEntriesByProductId.get(String(product.id)) ?? [];
      const primaryEntry = entries[0];
      const priceBook = primaryEntry ? priceBooksById.get(String(primaryEntry.priceBookId)) ?? (primaryEntry.priceBook as RecordData | undefined) : undefined;

      return {
        ...product,
        priceBookEntryId: primaryEntry?.id ?? "",
        priceBookName: priceBook?.name ?? "",
        listPrice: primaryEntry?.listPrice ?? "",
        currency: primaryEntry?.currency ?? "",
        priceBookEntryActive: primaryEntry?.active ?? "",
        priceBookEntryCount: entries.length
      };
    }),
    messagingSessions: data.messagingSessions.map((record) => ({ ...record, ownerAlias: ownerAlias(record.ownerId) }))
  };
}

export function contactName(record: RecordData) {
  return [record.salutation, record.firstName, record.lastName].filter(Boolean).join(" ").trim() || String(record.name ?? "");
}

export function dataKeyForObject(object: CrmObject): keyof BootstrapData {
  switch (object) {
    case "Account":
      return "accounts";
    case "Contact":
      return "contacts";
    case "Lead":
      return "leads";
    case "Opportunity":
      return "opportunities";
    case "Product2":
      return "products";
    case "Pricebook2":
      return "priceBooks";
    case "Event":
      return "events";
    case "Case":
      return "cases";
    case "QuickText":
      return "quickTexts";
    case "MessagingSession":
      return "messagingSessions";
    case "Knowledge__kav":
      return "knowledgeArticles";
    case "ListEmail":
      return "listEmails";
    case "Invoice":
      return "invoices";
    case "VideoCall":
      return "videoCalls";
  }
}

export function recordTitle(object: CrmObject, record: RecordData) {
  if (object === "Contact" || object === "Lead") return contactName(record);
  if (object === "Case") return String(record.caseNumber ?? record.subject ?? "Case");
  if (object === "Knowledge__kav") return String(record.title ?? "Knowledge");
  if (object === "ListEmail") return String(record.subject ?? "List Email");
  return String(record.name ?? record.title ?? record.id);
}

export function routeForRecord(object: CrmObject, id: string) {
  return `/lightning/r/${object}/${id}/view`;
}

export function currentUserRecord() {
  return { ...CURRENT_USER };
}
