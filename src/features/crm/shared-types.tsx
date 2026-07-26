import { type AppKey, type ScopedCrmData, type CrmObject, type RecordData } from "@/lib/crm-types";

export type ModalState =
  | { type: "record"; mode: "new" | "edit"; object: CrmObject; record?: RecordData }
  | { type: "invoice"; mode: "new" | "edit"; record?: RecordData }
  | { type: "invoicePayment"; invoice: RecordData }
  | { type: "messaging"; mode: "new" | "edit"; record?: RecordData }
  | { type: "videoCall"; mode: "new" | "edit"; record?: RecordData }
  | { type: "campaign"; mode: "new" | "edit"; record?: RecordData }
  | { type: "product" }
  | {
      type: "event";
      mode?: "new" | "edit";
      record?: RecordData;
      occurrenceStart?: string | null;
      recurring?: boolean;
      relatedObjectType?: CrmObject;
      relatedRecordId?: string;
      startDate?: string;
      startTime?: string;
      endDate?: string;
      endTime?: string;
      allDay?: boolean;
    }
  | { type: "quickText"; record?: RecordData }
  | { type: "knowledge"; record?: RecordData }
  | { type: "listEmail"; record?: RecordData; initialValues?: RecordData; startingStep?: 1 | 2; layout?: string }
  | { type: "listAction"; action: string; object: CrmObject; records: RecordData[]; selectedIds: string[] }
  | {
      type: "leadConversionSuccess";
      accounts: RecordData[];
      contacts: RecordData[];
      opportunities: RecordData[];
      leads: RecordData[];
    }
  | { type: "quickTextFolder" }
  | { type: "marketingActivation"; record?: RecordData }
  | { type: "reportBuilder"; reportType?: string; record?: RecordData }
  | { type: "navEdit"; app: AppKey }
  | { type: "confirm"; title: string; body: string; onConfirm: () => void | Promise<unknown> };
export type ConsoleTab = {
  href: string;
  label: string;
};
export type ScopedCrmDataUpdater = (updater: (previous: ScopedCrmData) => ScopedCrmData) => void;
export type SaveRecordHandler = (
  object: CrmObject,
  values: RecordData,
  options?: { id?: string; stayOpen?: boolean }
) => Promise<boolean>;
export type FileUploadRequest = { file: File; relatedObjectType: "Account" | "Contact"; relatedRecordId: string };
export type KanbanConfig = {
  field: string;
  label: string;
  values: string[];
  summaryField?: string;
};
export type ListSortState = {
  key: string;
  direction: "asc" | "desc";
} | null;
export type InlineEditingCell = {
  recordId: string;
  key: string;
  value: string;
} | null;
export type LookupOption = {
  id: string;
  label: string;
};
export type TimelineActivity = RecordData & {
  kind: "Email" | "Call" | "Task" | "Event";
  date: unknown;
};
export type RelatedListObject = CrmObject | "Partner";
export type RecordPageDialog =
  | { type: "hierarchy" }
  | { type: "relatedList"; title: string; object: RelatedListObject; records: RecordData[]; fields: string[] }
  | { type: "partner" }
  | { type: "mergeDuplicate"; duplicate: RecordData };
export type SearchResult = {
  id: string;
  label: string;
  context: string;
  href: string;
  category: "Record" | "List View" | "Report" | "Suggested Search" | "Recent";
  description?: string;
  query?: string;
};
export type ReportMetric = {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning";
};
export type ReportRow = {
  label: string;
  count: number;
  amount?: number;
  secondary?: string;
  href?: string;
};
export type AnalyticsReportDefinition = {
  id: string;
  title: string;
  objectLabel: string;
  description: string;
  rowHeader: string;
  valueHeader: string;
  valueKind: "count" | "currency";
  emptyMessage: string;
  metrics: ReportMetric[];
  rows: ReportRow[];
  href: string;
};
export type ReportBuilderType = "Accounts" | "Contacts" | "Leads" | "Cases" | "Opportunities";
export type ReportBuilderConfig = {
  object: CrmObject;
  defaultGroup: string;
  groupOptions: Array<{ field: string; label: string }>;
  columns: string[];
  amountField?: string;
};
export type HelpArticle = {
  id: string;
  title: string;
  summary: string;
  category: string;
  href: string;
  tags: string[];
};
export type SetupShortcut = {
  id: string;
  title: string;
  summary: string;
  category: string;
  href: string;
  tags: string[];
};
export type AgentforceMessageMetadata = {
  kind?: string;
  actions?: Array<{ label: string; href: string }>;
  facts?: Array<{ label: string; value: string }>;
  draft?: {
    subject?: string;
    body?: string;
    to?: string;
    recipientIds?: string[];
  };
};
export type UtilityKind = "agentforce" | "guidance" | "help" | "settings" | "notifications" | "profile";
