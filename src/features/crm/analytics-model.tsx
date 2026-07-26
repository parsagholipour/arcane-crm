import { OBJECT_DEFINITIONS } from "@/lib/crm-metadata";
import { dataKeyForObject, recordTitle, routeForRecord } from "@/lib/crm-data";
import { type ScopedCrmData, type CrmObject, type RecordData } from "@/lib/crm-types";
import { formatDate } from "@/lib/utils";
import { isCrmObject } from "@/features/routing/lightning-route";
import { formatCell } from "@/features/crm/form-model";
import { formatKanbanSummary, numberFromRecord } from "@/features/crm/list-model";
import { requiredId } from "@/features/crm/record-model";
import { listSearchHref, reportHref, reportIdFromTitle } from "@/features/crm/route-model";
import {
  type AnalyticsReportDefinition,
  type ReportBuilderConfig,
  type ReportBuilderType,
  type ReportRow
} from "@/features/crm/shared-types";
import { normalizeSearchText } from "@/features/crm/text-model";

export const homeReportCards = [
  { objectLabel: "Leads", reportTitle: "Leads by Status" },
  { objectLabel: "Opportunities", reportTitle: "Pipeline by Stage" },
  { objectLabel: "Contacts", reportTitle: "Contacts by Account" },
  { objectLabel: "Cases", reportTitle: "Open Cases for Accounts I Own" }
] as const;
export const reportBuilderTypes: ReportBuilderType[] = ["Accounts", "Contacts", "Leads", "Cases", "Opportunities"];
export const reportBuilderConfigs: Record<ReportBuilderType, ReportBuilderConfig> = {
  Accounts: {
    object: "Account",
    defaultGroup: "type",
    groupOptions: [
      { field: "type", label: "Account Type" },
      { field: "ownerAlias", label: "Owner Alias" },
      { field: "billingState", label: "Billing State" }
    ],
    columns: ["name", "type", "phone", "ownerAlias", "createdAt"]
  },
  Contacts: {
    object: "Contact",
    defaultGroup: "accountName",
    groupOptions: [
      { field: "accountName", label: "Account Name" },
      { field: "ownerAlias", label: "Owner Alias" },
      { field: "title", label: "Title" }
    ],
    columns: ["displayName", "accountName", "title", "phone", "email"]
  },
  Leads: {
    object: "Lead",
    defaultGroup: "status",
    groupOptions: [
      { field: "status", label: "Lead Status" },
      { field: "rating", label: "Rating" },
      { field: "leadSource", label: "Lead Source" },
      { field: "ownerAlias", label: "Owner Alias" }
    ],
    columns: ["displayName", "company", "status", "rating", "email"]
  },
  Cases: {
    object: "Case",
    defaultGroup: "status",
    groupOptions: [
      { field: "status", label: "Status" },
      { field: "priority", label: "Priority" },
      { field: "accountName", label: "Account Name" },
      { field: "ownerAlias", label: "Owner Alias" }
    ],
    columns: ["caseNumber", "subject", "status", "priority", "openedAt"]
  },
  Opportunities: {
    object: "Opportunity",
    defaultGroup: "stage",
    groupOptions: [
      { field: "stage", label: "Stage" },
      { field: "accountName", label: "Account Name" },
      { field: "ownerAlias", label: "Owner Alias" },
      { field: "forecastCategory", label: "Forecast Category" }
    ],
    columns: ["name", "accountName", "closeDate", "stage", "amount"],
    amountField: "amount"
  }
};
export function buildAnalyticsReports(data: ScopedCrmData): AnalyticsReportDefinition[] {
  const now = new Date();
  const openCases = data.cases.filter((record) => !isClosedCase(record));
  const closedCases = data.cases.filter(isClosedCase);
  const closedCasesThisMonth = closedCases.filter((record) => {
    const closedDate = caseClosedDate(record);
    return closedDate ? sameReportMonth(closedDate, now) : false;
  });
  const ownedAccountIds = new Set(
    data.accounts
      .filter((account) => String(account.ownerId ?? data.user.id) === data.user.id)
      .map(requiredId)
      .filter(Boolean)
  );
  const openCasesForOwnedAccounts = openCases.filter((record) => ownedAccountIds.has(String(record.accountId ?? "")));
  const openOpportunities = data.opportunities.filter((record) => !isClosedOpportunity(record));
  const closedWonOpportunities = data.opportunities.filter((record) => String(record.stage ?? "") === "Closed Won");

  const standardReports = [
    createAnalyticsReport({
      title: "Open Cases for Accounts I Own",
      objectLabel: "Cases",
      description: "Open support work for cases tied to accounts owned by the current user.",
      rowHeader: "Account",
      valueHeader: "Open Cases",
      valueKind: "count",
      emptyMessage: "No open cases are tied to accounts owned by the current user.",
      metrics: [
        {
          label: "Open Cases",
          value: String(openCasesForOwnedAccounts.length),
          tone: openCasesForOwnedAccounts.length > 0 ? "warning" : "success"
        },
        { label: "Owned Accounts", value: String(ownedAccountIds.size) },
        {
          label: "High Priority",
          value: String(openCasesForOwnedAccounts.filter(isHighPriorityCase).length),
          tone: openCasesForOwnedAccounts.some(isHighPriorityCase) ? "warning" : "default"
        },
        {
          label: "Escalated",
          value: String(
            openCasesForOwnedAccounts.filter((record) => String(record.status ?? "") === "Escalated").length
          ),
          tone: openCasesForOwnedAccounts.some((record) => String(record.status ?? "") === "Escalated")
            ? "warning"
            : "default"
        }
      ],
      rows: groupReportRows(openCasesForOwnedAccounts, (record) => String(record.accountName || "No Account"), {
        hrefFor: (label) => listSearchHref("Case", label),
        secondaryFor: (records) => casePrioritySummary(records)
      })
    }),
    createAnalyticsReport({
      title: "My Closed Cases by Close Date",
      objectLabel: "Cases",
      description: "Closed case volume grouped by the date each case moved out of active support.",
      rowHeader: "Close Date",
      valueHeader: "Closed Cases",
      valueKind: "count",
      emptyMessage: "No closed cases have been recorded yet.",
      metrics: [
        {
          label: "Closed Cases",
          value: String(closedCases.length),
          tone: closedCases.length > 0 ? "success" : "default"
        },
        { label: "Latest Close Date", value: latestReportDate(closedCases.map(caseClosedDate)) || "-" },
        {
          label: "Accounts Served",
          value: String(new Set(closedCases.map((record) => String(record.accountId ?? "")).filter(Boolean)).size)
        },
        { label: "High Priority Closed", value: String(closedCases.filter(isHighPriorityCase).length) }
      ],
      rows: groupReportRows(closedCases, (record) => formatDate(caseClosedDate(record)) || "No Close Date", {
        hrefFor: (label) => listSearchHref("Case", label),
        secondaryFor: (records) => casePrioritySummary(records)
      })
    }),
    createAnalyticsReport({
      title: "My Cases Closed MTD",
      objectLabel: "Cases",
      description: "Month-to-date closed case throughput, grouped by priority.",
      rowHeader: "Priority",
      valueHeader: "Closed MTD",
      valueKind: "count",
      emptyMessage: "No cases have closed during the current month.",
      metrics: [
        {
          label: "Closed MTD",
          value: String(closedCasesThisMonth.length),
          tone: closedCasesThisMonth.length > 0 ? "success" : "default"
        },
        { label: "High Priority", value: String(closedCasesThisMonth.filter(isHighPriorityCase).length) },
        { label: "Daily Pace", value: (closedCasesThisMonth.length / Math.max(1, now.getDate())).toFixed(1) },
        { label: "Total Closed", value: String(closedCases.length) }
      ],
      rows: groupReportRows(closedCasesThisMonth, (record) => formatCell(record.priority) || "No Priority", {
        hrefFor: (label) => listSearchHref("Case", label),
        secondaryFor: (records) => `${records.length} closed case${records.length === 1 ? "" : "s"}`
      })
    }),
    createAnalyticsReport({
      title: "Pipeline by Stage",
      objectLabel: "Opportunities",
      description: "Opportunity pipeline grouped by stage with amount rollups.",
      rowHeader: "Stage",
      valueHeader: "Amount",
      valueKind: "currency",
      emptyMessage: "No opportunities have been created yet.",
      metrics: [
        {
          label: "Open Pipeline",
          value: formatKanbanSummary(sumReportAmount(openOpportunities, "amount")),
          tone: openOpportunities.length > 0 ? "success" : "default"
        },
        { label: "Open Opportunities", value: String(openOpportunities.length) },
        {
          label: "Closed Won",
          value: formatKanbanSummary(sumReportAmount(closedWonOpportunities, "amount")),
          tone: closedWonOpportunities.length > 0 ? "success" : "default"
        },
        {
          label: "Closing This Month",
          value: String(
            data.opportunities.filter((record) => sameReportMonth(parseReportDate(record.closeDate), now)).length
          )
        }
      ],
      rows: groupReportRows(data.opportunities, (record) => formatCell(record.stage) || "No Stage", {
        amountFor: (record) => numberFromRecord(record.amount),
        hrefFor: (label) => listSearchHref("Opportunity", label),
        secondaryFor: (records) => opportunityProbabilitySummary(records)
      })
    }),
    createAnalyticsReport({
      title: "Leads by Status",
      objectLabel: "Leads",
      description: "Lead generation volume grouped by status.",
      rowHeader: "Lead Status",
      valueHeader: "Leads",
      valueKind: "count",
      emptyMessage: "No leads have been created yet.",
      metrics: [
        { label: "Total Leads", value: String(data.leads.length) },
        {
          label: "Qualified",
          value: String(data.leads.filter((record) => String(record.status ?? "") === "Qualified").length),
          tone: data.leads.some((record) => String(record.status ?? "") === "Qualified") ? "success" : "default"
        },
        {
          label: "New Leads",
          value: String(data.leads.filter((record) => String(record.status ?? "") === "New").length)
        },
        { label: "With Email", value: String(data.leads.filter((record) => Boolean(record.email)).length) }
      ],
      rows: groupReportRows(data.leads, (record) => formatCell(record.status) || "No Status", {
        hrefFor: (label) => listSearchHref("Lead", label),
        secondaryFor: (records) => leadQualitySummary(records)
      })
    }),
    createAnalyticsReport({
      title: "Contacts by Account",
      objectLabel: "Contacts",
      description: "Contact coverage grouped by related account.",
      rowHeader: "Account",
      valueHeader: "Contacts",
      valueKind: "count",
      emptyMessage: "No contacts have been added yet.",
      metrics: [
        { label: "Total Contacts", value: String(data.contacts.length) },
        {
          label: "Accounts Covered",
          value: String(new Set(data.contacts.map((record) => String(record.accountId ?? "")).filter(Boolean)).size)
        },
        { label: "With Email", value: String(data.contacts.filter((record) => Boolean(record.email)).length) },
        {
          label: "Unassigned Account",
          value: String(data.contacts.filter((record) => !record.accountId).length),
          tone: data.contacts.some((record) => !record.accountId) ? "warning" : "default"
        }
      ],
      rows: groupReportRows(data.contacts, (record) => String(record.accountName || "No Account"), {
        hrefFor: (label) => listSearchHref("Contact", label),
        secondaryFor: (records) => `${records.filter((record) => Boolean(record.email)).length} with email`
      })
    }),
    createAnalyticsReport({
      title: "Accounts by Type",
      objectLabel: "Accounts",
      description: "Account mix grouped by account type.",
      rowHeader: "Account Type",
      valueHeader: "Accounts",
      valueKind: "count",
      emptyMessage: "No accounts have been created yet.",
      metrics: [
        { label: "Total Accounts", value: String(data.accounts.length) },
        {
          label: "Customers",
          value: String(data.accounts.filter((record) => String(record.type ?? "") === "Customer").length),
          tone: data.accounts.some((record) => String(record.type ?? "") === "Customer") ? "success" : "default"
        },
        {
          label: "Prospects",
          value: String(data.accounts.filter((record) => String(record.type ?? "") === "Prospect").length)
        },
        {
          label: "Partners",
          value: String(data.accounts.filter((record) => String(record.type ?? "") === "Partner").length)
        }
      ],
      rows: groupReportRows(data.accounts, (record) => formatCell(record.type) || "No Type", {
        hrefFor: (label) => listSearchHref("Account", label),
        secondaryFor: (records) =>
          `${records.filter((record) => String(record.ownerId ?? data.user.id) === data.user.id).length} owned by ${data.user.alias}`
      })
    })
  ];
  return [...standardReports, ...data.customReports.map((report) => customAnalyticsReport(data, report))];
}
export function createAnalyticsReport(
  report: Omit<AnalyticsReportDefinition, "id" | "href">
): AnalyticsReportDefinition {
  return {
    ...report,
    id: reportIdFromTitle(report.title),
    href: reportHref(report.title)
  };
}
export function customAnalyticsReport(data: ScopedCrmData, report: RecordData): AnalyticsReportDefinition {
  const object = isCrmObject(String(report.object ?? "")) ? (String(report.object) as CrmObject) : "Lead";
  const records = data[dataKeyForObject(object)] as RecordData[];
  const groupField = String(report.groupField ?? OBJECT_DEFINITIONS[object].columns[0]?.key ?? "name");
  const columns = Array.isArray(report.columns) ? report.columns.map(String) : [];
  const amountField = object === "Opportunity" && columns.includes("amount") ? "amount" : undefined;
  const rowHeader = reportBuilderFieldLabel(object, groupField);
  const valueKind = amountField ? "currency" : "count";
  const title = String(report.name ?? `${OBJECT_DEFINITIONS[object].plural} by ${rowHeader}`);
  const rows = groupReportRows(records, (record) => formatCell(record[groupField]) || "Blank", {
    amountFor: amountField ? (record) => numberFromRecord(record[amountField]) : undefined,
    hrefFor: (label) => listSearchHref(object, label),
    secondaryFor: (groupRecords) => `${groupRecords.length} ${OBJECT_DEFINITIONS[object].plural.toLowerCase()}`
  });

  return {
    id: `custom-report-${String(report.id ?? reportIdFromTitle(title))}`,
    title,
    objectLabel: OBJECT_DEFINITIONS[object].plural,
    description: `Saved custom report grouped by ${rowHeader.toLowerCase()}.`,
    rowHeader,
    valueHeader: valueKind === "currency" ? "Amount" : "Records",
    valueKind,
    emptyMessage: `No ${OBJECT_DEFINITIONS[object].plural.toLowerCase()} match this report yet.`,
    metrics: [
      { label: "Records", value: String(records.length) },
      { label: "Groups", value: String(rows.length) },
      { label: "Columns", value: String(columns.length) },
      { label: "Saved", value: report.updatedAt ? formatDate(String(report.updatedAt)) : "Now" }
    ],
    rows,
    href: reportHref(title)
  };
}
export function dashboardReportComponents(dashboard: RecordData, reports: AnalyticsReportDefinition[]) {
  const ids = Array.isArray(dashboard.reportIds) ? dashboard.reportIds.map(String) : [];
  return ids
    .map((id) => reports.find((report) => report.id === id || report.id === `custom-report-${id}`))
    .filter((report): report is AnalyticsReportDefinition => Boolean(report));
}
export function selectAnalyticsReport(reports: AnalyticsReportDefinition[], reportName: string) {
  const normalizedName = normalizeSearchText(reportName);
  return (
    reports.find(
      (report) => normalizeSearchText(report.title) === normalizedName || report.id === reportIdFromTitle(reportName)
    ) ?? reports[0]
  );
}
export function groupReportRows(
  records: RecordData[],
  labelFor: (record: RecordData) => string,
  options: {
    amountFor?: (record: RecordData) => number;
    hrefFor?: (label: string) => string;
    secondaryFor?: (records: RecordData[], label: string) => string;
  } = {}
): ReportRow[] {
  const groups = records.reduce<Map<string, { records: RecordData[]; amount: number }>>((accumulator, record) => {
    const label = labelFor(record) || "Blank";
    const current = accumulator.get(label) ?? { records: [], amount: 0 };
    current.records.push(record);
    current.amount += options.amountFor ? options.amountFor(record) : 0;
    accumulator.set(label, current);
    return accumulator;
  }, new Map());

  return Array.from(groups.entries())
    .map(([label, group]) => ({
      label,
      count: group.records.length,
      amount: options.amountFor ? group.amount : undefined,
      href: options.hrefFor?.(label),
      secondary: options.secondaryFor?.(group.records, label)
    }))
    .sort(
      (left, right) =>
        reportRowValueForSort(right) - reportRowValueForSort(left) || left.label.localeCompare(right.label)
    );
}
export function reportRowValue(report: AnalyticsReportDefinition, row: ReportRow) {
  return report.valueKind === "currency" ? (row.amount ?? 0) : row.count;
}
export function reportRowValueForSort(row: ReportRow) {
  return row.amount ?? row.count;
}
export function formatReportValue(report: AnalyticsReportDefinition, row: ReportRow) {
  if (report.valueKind === "currency") return formatKanbanSummary(row.amount ?? 0);
  return String(row.count);
}
export function analyticsReportCsv(report: AnalyticsReportDefinition) {
  const header = [report.rowHeader, "Records", report.valueHeader, "Notes"];
  const rows = report.rows.map((row) => [
    row.label,
    String(row.count),
    formatReportValue(report, row),
    row.secondary ?? ""
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}
export function csvCell(value: string) {
  return `"${String(value).replace(/"/g, '""')}"`;
}
export function fileSafeName(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "report"
  );
}
export function isClosedCase(record: RecordData) {
  return String(record.status ?? "") === "Closed" || Boolean(record.closedAt);
}
export function isHighPriorityCase(record: RecordData) {
  return String(record.priority ?? "") === "High";
}
export function caseClosedDate(record: RecordData) {
  return parseReportDate(record.closedAt) ?? parseReportDate(record.updatedAt) ?? parseReportDate(record.createdAt);
}
export function isClosedOpportunity(record: RecordData) {
  return ["Closed Won", "Closed Lost"].includes(String(record.stage ?? ""));
}
export function parseReportDate(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}
export function sameReportMonth(date: Date | null, reference: Date) {
  if (!date) return false;
  return date.getFullYear() === reference.getFullYear() && date.getMonth() === reference.getMonth();
}
export function latestReportDate(dates: Array<Date | null>) {
  const latest = dates.filter(Boolean).sort((left, right) => right!.getTime() - left!.getTime())[0];
  return latest ? formatDate(latest) : "";
}
export function sumReportAmount(records: RecordData[], field: string) {
  return records.reduce((sum, record) => sum + numberFromRecord(record[field]), 0);
}
export function casePrioritySummary(records: RecordData[]) {
  const highPriority = records.filter(isHighPriorityCase).length;
  if (highPriority > 0) return `${highPriority} high priority`;
  return `${records.length} total case${records.length === 1 ? "" : "s"}`;
}
export function opportunityProbabilitySummary(records: RecordData[]) {
  const probabilities = records.map((record) => numberFromRecord(record.probability)).filter((value) => value > 0);
  if (probabilities.length === 0) return `${records.length} opportunit${records.length === 1 ? "y" : "ies"}`;
  const average = Math.round(probabilities.reduce((sum, value) => sum + value, 0) / probabilities.length);
  return `${average}% average probability`;
}
export function leadQualitySummary(records: RecordData[]) {
  const hot = records.filter((record) => String(record.rating ?? "") === "Hot").length;
  if (hot > 0) return `${hot} hot lead${hot === 1 ? "" : "s"}`;
  return `${records.filter((record) => Boolean(record.email)).length} with email`;
}
export function reportBuilderTypeFrom(reportType?: string): ReportBuilderType {
  if (isReportBuilderType(reportType)) return reportType;
  if (reportType === "Report") return "Leads";
  return "Opportunities";
}
export function isReportBuilderType(value?: string): value is ReportBuilderType {
  return reportBuilderTypes.includes(value as ReportBuilderType);
}
export function reportBuilderRecords(data: ScopedCrmData, type: ReportBuilderType) {
  const object = reportBuilderConfigs[type].object;
  return data[dataKeyForObject(object)] as RecordData[];
}
export function reportBuilderPreviewReport(
  data: ScopedCrmData,
  type: ReportBuilderType,
  groupField: string
): AnalyticsReportDefinition {
  const config = reportBuilderConfigs[type];
  const records = reportBuilderRecords(data, type);
  const groupLabel = reportBuilderFieldLabel(config.object, groupField);
  const valueKind = config.amountField ? "currency" : "count";
  const rows = groupReportRows(records, (record) => formatCell(record[groupField]) || "Blank", {
    amountFor: config.amountField ? (record) => numberFromRecord(record[config.amountField!]) : undefined,
    hrefFor: (label) => listSearchHref(config.object, label),
    secondaryFor: (groupRecords) => `${groupRecords.length} ${OBJECT_DEFINITIONS[config.object].plural.toLowerCase()}`
  });

  return {
    id: "builder-preview",
    title: `${type} by ${groupLabel}`,
    objectLabel: type,
    description: `Preview of ${OBJECT_DEFINITIONS[config.object].plural.toLowerCase()} grouped by ${groupLabel.toLowerCase()}.`,
    rowHeader: groupLabel,
    valueHeader: valueKind === "currency" ? "Amount" : "Records",
    valueKind,
    emptyMessage: `No ${OBJECT_DEFINITIONS[config.object].plural.toLowerCase()} match this report type yet.`,
    metrics: [
      { label: "Records", value: String(records.length) },
      { label: "Groups", value: String(rows.length) },
      {
        label: valueKind === "currency" ? "Total Amount" : "Selected Columns",
        value:
          valueKind === "currency"
            ? formatKanbanSummary(sumReportAmount(records, config.amountField ?? "amount"))
            : String(config.columns.length)
      },
      { label: "Report Type", value: type }
    ],
    rows,
    href: "#"
  };
}
export function reportBuilderFieldLabel(object: CrmObject, field: string) {
  return (
    OBJECT_DEFINITIONS[object].columns.find((column) => column.key === field)?.label ??
    field.replace(/([A-Z])/g, " $1").replace(/^./, (match) => match.toUpperCase())
  );
}
export function buildHomeRecentRecords(data: ScopedCrmData) {
  const records = [
    ...data.accounts.slice(0, 2).map((record) => ({
      id: `home-account-${requiredId(record)}`,
      label: recordTitle("Account", record),
      context: "Account",
      href: routeForRecord("Account", requiredId(record))
    })),
    ...data.contacts.slice(0, 2).map((record) => ({
      id: `home-contact-${requiredId(record)}`,
      label: recordTitle("Contact", record),
      context: "Contact",
      href: routeForRecord("Contact", requiredId(record))
    })),
    ...data.leads.slice(0, 1).map((record) => ({
      id: `home-lead-${requiredId(record)}`,
      label: recordTitle("Lead", record),
      context: "Lead",
      href: listSearchHref("Lead", recordTitle("Lead", record))
    })),
    ...data.opportunities.slice(0, 1).map((record) => ({
      id: `home-opportunity-${requiredId(record)}`,
      label: recordTitle("Opportunity", record),
      context: "Opportunity",
      href: listSearchHref("Opportunity", recordTitle("Opportunity", record))
    })),
    {
      id: "home-report-open-cases",
      label: "Open Cases for Accounts I Own",
      context: "Report",
      href: reportHref("Open Cases for Accounts I Own")
    }
  ];

  return records.slice(0, 5);
}
