import type { CrmObject } from "@/lib/crm-types";

const SERVER_SORTABLE_COLUMNS: Record<CrmObject, readonly string[]> = {
  Account: ["name", "phone"],
  Contact: ["displayName", "accountName", "phone", "email"],
  Lead: ["displayName", "company", "state", "phone", "email", "status", "createdAt"],
  Opportunity: ["name", "accountName", "closeDate", "stage", "amount"],
  Product2: ["name", "productCode", "family", "category", "stockCount", "syncSource", "active"],
  Pricebook2: ["name", "active", "isStandard", "validFrom", "validTo"],
  Event: [],
  Case: ["caseNumber", "contactName", "subject", "status", "priority", "openedAt"],
  QuickText: ["name", "category"],
  MessagingSession: ["name", "channel", "subject", "status", "lastMessageAt"],
  Knowledge__kav: ["title", "summary", "articleNumber", "publishedAt", "publicationStatus", "validationStatus"],
  ListEmail: ["subject", "layoutType", "recipientType", "status", "sentAt", "scheduledAt", "createdAt"],
  Campaign: ["name", "type", "status", "startDate", "endDate"],
  Invoice: [
    "invoiceNumber",
    "accountName",
    "opportunityName",
    "status",
    "issueDate",
    "dueDate",
    "total",
    "amountPaid",
    "balanceDue"
  ],
  VideoCall: ["name", "status", "provider", "scheduledStartAt", "scheduledEndAt"]
};

export function isServerSortableListColumn(object: CrmObject, column: string) {
  return SERVER_SORTABLE_COLUMNS[object].includes(column);
}
