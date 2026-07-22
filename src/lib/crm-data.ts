import type { BootstrapData, CrmObject, RecordData } from "@/lib/crm-types";

export function decorateBootstrap(data: BootstrapData): BootstrapData {
  const accountsById = new Map(data.accounts.map((account) => [String(account.id), account]));
  const contactsById = new Map(data.contacts.map((contact) => [String(contact.id), contact]));
  const opportunitiesById = new Map(data.opportunities.map((opportunity) => [String(opportunity.id), opportunity]));
  const priceBooksById = new Map(data.priceBooks.map((priceBook) => [String(priceBook.id), priceBook]));
  const usersById = new Map(data.users.map((user) => [user.id, user]));
  const priceBookEntriesByProductId = new Map<string, RecordData[]>();

  data.priceBookEntries.forEach((entry) => {
    if (!entry.productId) return;
    const productId = String(entry.productId);
    priceBookEntriesByProductId.set(productId, [...(priceBookEntriesByProductId.get(productId) ?? []), entry]);
  });

  const ownerAlias = (ownerId?: unknown) => usersById.get(String(ownerId || data.user.id))?.alias ?? String(ownerId || data.user.alias);
  const ownerName = (ownerId?: unknown) => usersById.get(String(ownerId || data.user.id))?.name ?? String(ownerId || data.user.name);

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
    messagingSessions: data.messagingSessions.map((record) => ({
      ...record,
      accountName: accountsById.get(String(record.accountId))?.name ?? (record.account as RecordData | undefined)?.name ?? "",
      contactName: contactsById.get(String(record.contactId)) ? contactName(contactsById.get(String(record.contactId))!) : "",
      ownerAlias: ownerAlias(record.ownerId),
      ownerName: ownerName(record.ownerId)
    })),
    videoCalls: data.videoCalls.map((record) => ({
      ...record,
      accountName: accountsById.get(String(record.accountId))?.name ?? (record.account as RecordData | undefined)?.name ?? "",
      contactName: contactsById.get(String(record.contactId)) ? contactName(contactsById.get(String(record.contactId))!) : "",
      opportunityName: opportunitiesById.get(String(record.opportunityId))?.name ?? (record.opportunity as RecordData | undefined)?.name ?? "",
      organizerName: ownerName(record.organizerId)
    })),
    campaigns: data.campaigns.map((record) => {
      const members = Array.isArray(record.members) ? record.members as RecordData[] : [];
      const respondedCount = members.filter((member) => member.responded).length;
      return {
        ...record,
        memberCount: (record.metrics as RecordData | undefined)?.memberCount ?? members.length,
        responseRate: (record.metrics as RecordData | undefined)?.responseRate ?? (members.length ? Math.round((respondedCount / members.length) * 1000) / 10 : 0),
        ownerAlias: ownerAlias(record.ownerId),
        ownerName: ownerName(record.ownerId)
      };
    }),
    invoices: data.invoices.map((invoice) => ({
      ...invoice,
      name: invoice.invoiceNumber,
      accountName: accountsById.get(String(invoice.accountId))?.name ?? (invoice.account as RecordData | undefined)?.name ?? "",
      opportunityName: opportunitiesById.get(String(invoice.opportunityId))?.name ?? (invoice.opportunity as RecordData | undefined)?.name ?? ""
    }))
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
    case "Campaign":
      return "campaigns";
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
  if (object === "Campaign") return String(record.name ?? "Campaign");
  if (object === "Invoice") return String(record.invoiceNumber ?? "Invoice");
  return String(record.name ?? record.title ?? record.id);
}

export function routeForRecord(object: CrmObject, id: string) {
  return `/lightning/r/${object}/${id}/view`;
}
