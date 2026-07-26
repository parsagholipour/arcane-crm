"use client";

import { Download, Edit3, LayoutDashboard, Plus, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { type ScopedCrmData, type RecordData } from "@/lib/crm-types";
import { cn, formatDateTime } from "@/lib/utils";
import { Button, type ToastState } from "@/components/ui/crm-primitives";
import {
  analyticsReportCsv,
  buildAnalyticsReports,
  dashboardReportComponents,
  fileSafeName,
  formatReportValue,
  reportRowValue,
  selectAnalyticsReport
} from "@/features/crm/analytics-model";
import { resourceApi } from "@/lib/api/resources";
import { requiredId } from "@/features/crm/record-model";
import { type AnalyticsReportDefinition, type ScopedCrmDataUpdater } from "@/features/crm/shared-types";

export function AnalyticsPage({
  data,
  reportName,
  onReportBuilder,
  onDataChange,
  onToast,
  onRefreshData
}: {
  data: ScopedCrmData;
  reportName: string;
  onReportBuilder: (reportType?: string, record?: RecordData) => void;
  onDataChange: ScopedCrmDataUpdater;
  onToast: (toast: ToastState) => void;
  onRefreshData: (successMessage: string) => Promise<boolean>;
}) {
  const [refreshedAt, setRefreshedAt] = useState(() => new Date());
  const reports = useMemo(() => buildAnalyticsReports(data), [data]);
  const selectedReport = selectAnalyticsReport(reports, reportName);
  const selectedCustomReport = data.customReports.find(
    (report) => `custom-report-${requiredId(report)}` === selectedReport.id
  );
  const totalRecords = selectedReport.rows.reduce((sum, row) => sum + row.count, 0);
  const savedDashboards: Array<RecordData & { reports: AnalyticsReportDefinition[] }> = data.customDashboards.map(
    (dashboard) => ({
      ...dashboard,
      reports: dashboardReportComponents(dashboard, reports)
    })
  );

  async function refreshReport() {
    if (await onRefreshData(`${selectedReport.title} refreshed from the CRM.`)) setRefreshedAt(new Date());
  }

  function exportReport() {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/api/analytics/export";
    form.hidden = true;
    const values = {
      filename: `${fileSafeName(selectedReport.title)}.csv`,
      csv: analyticsReportCsv(selectedReport)
    };
    for (const [name, value] of Object.entries(values)) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.appendChild(input);
    }
    document.body.appendChild(form);
    form.submit();
    form.remove();
    onToast({ tone: "success", message: `${selectedReport.title} exported.` });
  }

  async function deleteSavedReport(report: RecordData) {
    if (
      !window.confirm(
        `Delete saved report "${String(report.name ?? "Report")}"? Dashboard references to it will also be removed.`
      )
    )
      return;
    const response = await resourceApi.deleteReport(requiredId(report));
    if (!Array.isArray(response?.customReports))
      return onToast({ tone: "error", message: "The saved report could not be deleted." });
    onDataChange((previous) => ({
      ...previous,
      customReports: response.customReports as RecordData[],
      customDashboards: Array.isArray(response.customDashboards)
        ? (response.customDashboards as RecordData[])
        : previous.customDashboards
    }));
    onToast({ tone: "success", message: "Saved report deleted." });
  }

  async function deleteSavedDashboard(dashboard: RecordData) {
    if (!window.confirm(`Delete dashboard "${String(dashboard.name ?? "Dashboard")}"?`)) return;
    const response = await resourceApi.deleteDashboard(requiredId(dashboard));
    if (!Array.isArray(response?.customDashboards))
      return onToast({ tone: "error", message: "The dashboard could not be deleted." });
    onDataChange((previous) => ({ ...previous, customDashboards: response.customDashboards as RecordData[] }));
    onToast({ tone: "success", message: "Dashboard deleted." });
  }

  return (
    <section className="space-y-3">
      <div className="rounded-lg border border-[#e4e7ec] bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.04em] text-[#706e6b]">Analytics</div>
            <h1 className="text-2xl font-semibold">Reports & Dashboards</h1>
            <p className="mt-1 max-w-3xl text-sm text-[#706e6b]">
              Review live CRM reports for sales, service, accounts, contacts, and lead generation.
            </p>
            <p className="mt-1 text-xs text-[#706e6b]">Updated {formatDateTime(refreshedAt.toISOString())}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => onReportBuilder("Report")}>
              <Plus size={13} /> New Report
            </Button>
            <Button variant="primary" onClick={() => onReportBuilder("Dashboard")}>
              <LayoutDashboard size={13} /> New Dashboard
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="rounded-lg border border-[#e4e7ec] bg-white shadow-card">
          <div className="border-b border-[#d8dde6] p-3">
            <div className="font-semibold">All Reports</div>
            <div className="text-xs text-[#706e6b]">{reports.length} report definitions</div>
          </div>
          <nav className="slds-scrollbar max-h-[calc(100vh-260px)] overflow-auto p-2">
            {reports.map((report) => {
              const active = report.id === selectedReport.id;
              return (
                <Link
                  key={report.id}
                  href={report.href}
                  className={cn(
                    "mb-1 block rounded px-3 py-2 text-sm hover:bg-brand-50",
                    active && "bg-brand-50 text-brand-900 ring-1 ring-brand-200"
                  )}
                >
                  <div className="font-semibold">{report.title}</div>
                  <div className="mt-0.5 text-xs text-[#706e6b]">
                    {report.objectLabel} - {report.rows.length} grouped row{report.rows.length === 1 ? "" : "s"}
                  </div>
                </Link>
              );
            })}
          </nav>
        </aside>

        <section className="min-w-0 rounded-lg border border-[#e4e7ec] bg-white shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#d8dde6] p-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.04em] text-[#706e6b]">
                {selectedReport.objectLabel} Report
              </div>
              <h2 className="text-xl font-semibold">{selectedReport.title}</h2>
              <p className="mt-1 max-w-2xl text-sm text-[#706e6b]">{selectedReport.description}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => onReportBuilder(selectedReport.objectLabel, selectedCustomReport)}>
                <Edit3 size={13} /> {selectedCustomReport ? "Edit" : "Customize"}
              </Button>
              {selectedCustomReport && (
                <Button variant="destructive" onClick={() => void deleteSavedReport(selectedCustomReport)}>
                  <Trash2 size={13} /> Delete
                </Button>
              )}
              <Button onClick={exportReport}>
                <Download size={13} /> Export
              </Button>
              <Button onClick={() => void refreshReport()}>
                <RefreshCw size={13} /> Refresh
              </Button>
            </div>
          </div>

          <div className="grid gap-3 border-b border-[#d8dde6] p-3 sm:grid-cols-2 xl:grid-cols-4">
            {selectedReport.metrics.map((metric) => (
              <div
                key={metric.label}
                className={cn(
                  "rounded border border-[#d8dde6] p-3",
                  metric.tone === "success" && "border-[#91db8b] bg-[#f3fbf2]",
                  metric.tone === "warning" && "border-[#f3b451] bg-[#fff7e8]"
                )}
              >
                <div className="text-xs text-[#706e6b]">{metric.label}</div>
                <div className="mt-1 text-xl font-semibold">{metric.value}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-3 p-3 2xl:grid-cols-[minmax(0,1fr)_280px]">
            <ReportBarChart report={selectedReport} />
            <div className="rounded border border-[#d8dde6] p-3">
              <div className="mb-3 font-semibold">Report Properties</div>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs text-[#706e6b]">Type</dt>
                  <dd>{selectedReport.objectLabel}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[#706e6b]">Grouped Rows</dt>
                  <dd>{selectedReport.rows.length}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[#706e6b]">Underlying Records</dt>
                  <dd>{totalRecords}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[#706e6b]">Display</dt>
                  <dd>{selectedReport.valueKind === "currency" ? "Summary by amount" : "Summary by count"}</dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="border-t border-[#d8dde6] p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">Details</h3>
              <div className="text-xs text-[#706e6b]">Sorted by {selectedReport.valueHeader}</div>
            </div>
            {selectedReport.rows.length === 0 ? (
              <div className="rounded border border-dashed border-[#d8dde6] p-5 text-sm text-[#706e6b]">
                {selectedReport.emptyMessage}
              </div>
            ) : (
              <div className="slds-scrollbar overflow-auto rounded border border-[#d8dde6]">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[#f3f3f3] text-xs text-[#444]">
                    <tr>
                      <th className="border-b border-[#d8dde6] px-3 py-2">{selectedReport.rowHeader}</th>
                      <th className="border-b border-[#d8dde6] px-3 py-2">Records</th>
                      <th className="border-b border-[#d8dde6] px-3 py-2">{selectedReport.valueHeader}</th>
                      <th className="border-b border-[#d8dde6] px-3 py-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedReport.rows.map((row) => (
                      <tr key={row.label} className="border-t border-[#d8dde6] hover:bg-brand-50/40">
                        <td className="px-3 py-2 font-medium">
                          {row.href ? (
                            <Link href={row.href} className="text-brand-700 hover:underline">
                              {row.label}
                            </Link>
                          ) : (
                            row.label
                          )}
                        </td>
                        <td className="px-3 py-2">{row.count}</td>
                        <td className="px-3 py-2">{formatReportValue(selectedReport, row)}</td>
                        <td className="px-3 py-2 text-[#706e6b]">{row.secondary ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
      {savedDashboards.length > 0 && (
        <section className="rounded-lg border border-[#e4e7ec] bg-white shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#d8dde6] p-3">
            <div>
              <h2 className="font-semibold">Saved Dashboards</h2>
              <div className="text-xs text-[#706e6b]">
                {savedDashboards.length} dashboard{savedDashboards.length === 1 ? "" : "s"} created in this workspace
              </div>
            </div>
            <Button variant="primary" onClick={() => onReportBuilder("Dashboard")}>
              <LayoutDashboard size={13} /> New Dashboard
            </Button>
          </div>
          <div className="grid gap-3 p-3 xl:grid-cols-2">
            {savedDashboards.map((dashboard) => (
              <div key={requiredId(dashboard)} className="rounded border border-[#d8dde6] p-3">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">{String(dashboard.name ?? "Dashboard")}</div>
                    <div className="text-xs text-[#706e6b]">
                      {dashboard.reports.length} component{dashboard.reports.length === 1 ? "" : "s"} - Updated{" "}
                      {dashboard.updatedAt ? formatDateTime(String(dashboard.updatedAt)) : "recently"}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button onClick={() => onReportBuilder("Dashboard", dashboard)}>
                      <Edit3 size={13} /> Edit
                    </Button>
                    <Button variant="destructive" onClick={() => void deleteSavedDashboard(dashboard)}>
                      <Trash2 size={13} /> Delete
                    </Button>
                  </div>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {dashboard.reports.map((report) => (
                    <Link
                      key={report.id}
                      href={report.href}
                      className="rounded border border-[#d8dde6] p-2 hover:border-brand-500 hover:bg-brand-50"
                    >
                      <div className="truncate font-medium text-brand-700">{report.title}</div>
                      <div className="mt-1 grid grid-cols-2 gap-1 text-xs text-[#706e6b]">
                        {report.metrics.slice(0, 2).map((metric) => (
                          <div key={metric.label}>
                            {metric.label}: <span className="font-semibold text-[#181818]">{metric.value}</span>
                          </div>
                        ))}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
export function ReportBarChart({ report }: { report: AnalyticsReportDefinition }) {
  const maxValue = Math.max(...report.rows.map((row) => reportRowValue(report, row)), 1);

  return (
    <div className="rounded border border-[#d8dde6] p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <div className="font-semibold">Chart</div>
          <div className="text-xs text-[#706e6b]">
            {report.rowHeader} by {report.valueHeader}
          </div>
        </div>
        <LayoutDashboard size={18} className="text-brand-600" />
      </div>
      {report.rows.length === 0 ? (
        <div className="rounded border border-dashed border-[#d8dde6] p-5 text-sm text-[#706e6b]">
          {report.emptyMessage}
        </div>
      ) : (
        <div className="space-y-3">
          {report.rows.slice(0, 8).map((row) => {
            const value = reportRowValue(report, row);
            const width = `${Math.max(6, Math.round((value / maxValue) * 100))}%`;
            return (
              <div key={row.label} className="grid gap-1">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="truncate font-semibold">{row.label}</span>
                  <span className="shrink-0 text-[#706e6b]">{formatReportValue(report, row)}</span>
                </div>
                <div className="h-3 overflow-hidden rounded bg-[#eef1f6]">
                  <div className="h-full rounded bg-brand-500" style={{ width }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
