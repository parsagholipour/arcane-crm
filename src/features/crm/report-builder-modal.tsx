"use client";

import { LayoutDashboard } from "lucide-react";
import { useMemo, useState } from "react";
import { OBJECT_DEFINITIONS } from "@/lib/crm-metadata";
import { type CrmObject, type ScopedCrmData, type RecordData } from "@/lib/crm-types";
import { cn } from "@/lib/utils";
import { BaseDialog, Button, type ToastState } from "@/components/ui/crm-primitives";
import { ReportBarChart } from "@/features/crm/analytics";
import {
  buildAnalyticsReports,
  formatReportValue,
  reportBuilderConfigs,
  reportBuilderFieldLabel,
  reportBuilderPreviewReport,
  reportBuilderTypeFrom,
  reportBuilderTypes
} from "@/features/crm/analytics-model";
import { checkboxClass, FieldShell, inputClass, NativeSelect } from "@/features/crm/controls";
import { resourceApi } from "@/lib/api/resources";
import { formatCell } from "@/features/crm/form-model";
import { requiredId } from "@/features/crm/record-model";
import {
  type AnalyticsReportDefinition,
  type ScopedCrmDataUpdater,
  type ReportBuilderType
} from "@/features/crm/shared-types";

function fieldLabel(object: CrmObject | undefined, field: string) {
  return object
    ? reportBuilderFieldLabel(object, field)
    : field.replace(/([A-Z])/g, " $1").replace(/^./, (match) => match.toUpperCase());
}

export function ReportBuilderModal({
  reportType,
  initial,
  data,
  onClose,
  onDataChange,
  onToast
}: {
  reportType?: string;
  initial?: RecordData;
  data: ScopedCrmData;
  onClose: () => void;
  onDataChange: ScopedCrmDataUpdater;
  onToast: (toast: ToastState) => void;
}) {
  const dashboardMode = reportType === "Dashboard";
  const persistedObject = String(initial?.object ?? "").trim();
  const persistedBuilderType = reportBuilderTypes.find((type) => reportBuilderConfigs[type].object === persistedObject);
  const hasPersistedReportType = Boolean(!dashboardMode && initial && persistedObject && !persistedBuilderType);
  const persistedCrmObject = (Object.keys(OBJECT_DEFINITIONS) as CrmObject[]).find(
    (object) => object === persistedObject
  );
  const persistedObjectLabel = persistedCrmObject ? OBJECT_DEFINITIONS[persistedCrmObject].label : persistedObject;
  const initialType = persistedBuilderType ?? reportBuilderTypeFrom(reportType);
  const [builderType, setBuilderType] = useState<ReportBuilderType | null>(hasPersistedReportType ? null : initialType);
  const persistedColumns = Array.isArray(initial?.columns) ? initial.columns.map(String) : [];
  const persistedGroupField = String(initial?.groupField ?? "");
  const [groupField, setGroupField] = useState(
    String(initial?.groupField ?? reportBuilderConfigs[initialType].defaultGroup)
  );
  const [selectedColumns, setSelectedColumns] = useState<string[]>(() =>
    persistedColumns.length ? persistedColumns : reportBuilderConfigs[initialType].columns
  );
  const [reportName, setReportName] = useState(
    String(
      initial?.name ??
        `${initialType} by ${reportBuilderFieldLabel(reportBuilderConfigs[initialType].object, reportBuilderConfigs[initialType].defaultGroup)}`
    )
  );
  const [dashboardName, setDashboardName] = useState(String(initial?.name ?? "Executive CRM Dashboard"));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const analyticsReports = useMemo(() => buildAnalyticsReports(data), [data]);
  const [dashboardReportIds, setDashboardReportIds] = useState<string[]>(() =>
    Array.isArray(initial?.reportIds)
      ? initial.reportIds.map(String)
      : analyticsReports.slice(0, 4).map((report) => report.id)
  );
  const standardConfig = reportBuilderConfigs[builderType ?? initialType];
  const activeObject = builderType === null ? persistedObject : standardConfig.object;
  const activeCrmObject = (Object.keys(OBJECT_DEFINITIONS) as CrmObject[]).find((object) => object === activeObject);
  const objectLabel = activeCrmObject ? OBJECT_DEFINITIONS[activeCrmObject].label : activeObject;
  const persistedFields = [
    ...new Set([
      ...persistedColumns,
      ...(persistedGroupField ? [persistedGroupField] : []),
      ...(activeCrmObject ? OBJECT_DEFINITIONS[activeCrmObject].columns.map((column) => column.key) : [])
    ])
  ];
  const availableColumns = builderType === null ? persistedFields : standardConfig.columns;
  const groupOptions =
    builderType === null
      ? persistedFields.map((field) => ({ field, label: fieldLabel(activeCrmObject, field) }))
      : standardConfig.groupOptions;
  const records = useMemo(
    () => (activeCrmObject ? (data[OBJECT_DEFINITIONS[activeCrmObject].dataKey] as RecordData[]) : []),
    [activeCrmObject, data]
  );
  const previewReport = useMemo<AnalyticsReportDefinition>(() => {
    if (builderType) return reportBuilderPreviewReport(data, builderType, groupField);
    const groupLabel = fieldLabel(activeCrmObject, groupField);
    const counts = new Map<string, number>();
    for (const record of records) {
      const label = formatCell(record[groupField]) || "Blank";
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return {
      id: "builder-preview",
      title: `${objectLabel} by ${groupLabel}`,
      objectLabel,
      description: `Preview of the saved ${objectLabel} report configuration.`,
      rowHeader: groupLabel,
      valueHeader: "Records",
      valueKind: "count",
      emptyMessage: `No ${objectLabel.toLowerCase()} records are loaded for this report.`,
      metrics: [
        { label: "Records", value: String(records.length) },
        { label: "Groups", value: String(counts.size) }
      ],
      rows: [...counts].map(([label, count]) => ({ label, count })),
      href: "#"
    };
  }, [activeCrmObject, builderType, data, groupField, objectLabel, records]);
  const previewRows = records.slice(0, 5);
  const selectedDashboardReports = analyticsReports.filter((report) => dashboardReportIds.includes(report.id));

  function selectType(type: ReportBuilderType) {
    const nextConfig = reportBuilderConfigs[type];
    setBuilderType(type);
    setGroupField(nextConfig.defaultGroup);
    setSelectedColumns(nextConfig.columns);
    setReportName(`${type} by ${reportBuilderFieldLabel(nextConfig.object, nextConfig.defaultGroup)}`);
  }

  function selectPersistedType() {
    setBuilderType(null);
    setGroupField(persistedGroupField);
    setSelectedColumns(persistedColumns);
  }

  function toggleColumn(column: string) {
    setSelectedColumns((current) => {
      if (current.includes(column)) return current.length === 1 ? current : current.filter((item) => item !== column);
      return [...current, column];
    });
  }

  function toggleDashboardReport(id: string) {
    setDashboardReportIds((current) => {
      if (current.includes(id)) return current.length === 1 ? current : current.filter((item) => item !== id);
      return [...current, id];
    });
  }

  async function saveReport() {
    if (!reportName.trim()) {
      setError("Complete this field.");
      return;
    }
    setSaving(true);
    const values = {
      name: reportName.trim(),
      object: activeObject,
      groupField,
      columns: selectedColumns
    };
    const response = initial
      ? await resourceApi.updateReport(requiredId(initial), values)
      : await resourceApi.createReport(values);
    setSaving(false);
    if (!Array.isArray(response?.customReports)) {
      setError("Report couldn't be saved.");
      onToast({ tone: "error", message: "Report couldn't be saved." });
      return;
    }
    onDataChange((previous) => ({ ...previous, customReports: response.customReports as RecordData[] }));
    onToast({ tone: "success", message: `Report "${reportName.trim()}" ${initial ? "updated" : "saved"}.` });
    onClose();
  }

  async function saveDashboard() {
    if (!dashboardName.trim()) {
      setError("Complete this field.");
      return;
    }
    if (dashboardReportIds.length === 0) {
      setError("Select at least one dashboard component.");
      return;
    }
    setSaving(true);
    const values = {
      name: dashboardName.trim(),
      reportIds: dashboardReportIds
    };
    const response = initial
      ? await resourceApi.updateDashboard(requiredId(initial), values)
      : await resourceApi.createDashboard(values);
    setSaving(false);
    if (!Array.isArray(response?.customDashboards)) {
      setError("Dashboard couldn't be saved.");
      onToast({ tone: "error", message: "Dashboard couldn't be saved." });
      return;
    }
    onDataChange((previous) => ({ ...previous, customDashboards: response.customDashboards as RecordData[] }));
    onToast({ tone: "success", message: `Dashboard "${dashboardName.trim()}" ${initial ? "updated" : "saved"}.` });
    onClose();
  }

  if (dashboardMode) {
    return (
      <BaseDialog
        open
        title={initial ? "Edit Dashboard" : "New Dashboard"}
        onClose={onClose}
        onEnterAction={saveDashboard}
        wide
        footer={
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={() => saveDashboard()}>
              {saving ? "Saving..." : initial ? "Update Dashboard" : "Save Dashboard"}
            </Button>
          </>
        }
      >
        <div className="grid gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="rounded border border-[#d8dde6] p-3">
            <FieldShell label="Dashboard Name" error={error && !dashboardName.trim() ? error : ""}>
              <input
                className={inputClass}
                value={dashboardName}
                onChange={(event) => {
                  setError("");
                  setDashboardName(event.target.value);
                }}
              />
            </FieldShell>
            <div className="mb-2 font-semibold">Dashboard Components</div>
            <div className="space-y-1">
              {analyticsReports.map((report) => (
                <label
                  key={report.id}
                  className="flex cursor-pointer items-start gap-2 rounded px-2 py-2 text-sm hover:bg-brand-50"
                >
                  <input
                    type="checkbox"
                    checked={dashboardReportIds.includes(report.id)}
                    onChange={() => toggleDashboardReport(report.id)}
                    className={cn(checkboxClass, "mt-1")}
                  />
                  <span>
                    <span className="block font-medium">{report.title}</span>
                    <span className="block text-xs text-[#706e6b]">{report.objectLabel}</span>
                  </span>
                </label>
              ))}
            </div>
          </aside>
          <div className="rounded border border-[#d8dde6] p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-semibold">Dashboard Preview</div>
                <div className="text-xs text-[#706e6b]">
                  {selectedDashboardReports.length} component{selectedDashboardReports.length === 1 ? "" : "s"}
                </div>
              </div>
              <span className="text-xs text-[#706e6b]">Preview updates automatically</span>
            </div>
            {error && dashboardName.trim() && (
              <div className="mb-3 rounded border border-[#f1c40f] bg-[#fff7d6] px-3 py-2 text-xs text-[#5f4b00]">
                {error}
              </div>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              {selectedDashboardReports.map((report) => (
                <div key={report.id} className="rounded border border-[#d8dde6] p-3">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">{report.title}</div>
                      <div className="text-xs text-[#706e6b]">{report.objectLabel}</div>
                    </div>
                    <LayoutDashboard size={16} className="text-brand-600" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {report.metrics.slice(0, 2).map((metric) => (
                      <div key={metric.label} className="rounded border border-[#d8dde6] p-2">
                        <div className="text-[11px] text-[#706e6b]">{metric.label}</div>
                        <div className="font-semibold">{metric.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 space-y-2">
                    {report.rows.slice(0, 3).map((row) => (
                      <div key={row.label} className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate">{row.label}</span>
                        <span className="shrink-0 font-semibold">{formatReportValue(report, row)}</span>
                      </div>
                    ))}
                    {report.rows.length === 0 && <div className="text-xs text-[#706e6b]">{report.emptyMessage}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </BaseDialog>
    );
  }

  return (
    <BaseDialog
      open
      title={initial ? "Edit Report" : "Report Builder"}
      onClose={onClose}
      onEnterAction={saveReport}
      wide
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => saveReport()}>
            {saving ? "Saving..." : initial ? "Update Report" : "Save Report"}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="rounded border border-[#d8dde6] p-3">
          <div className="mb-2 font-semibold">Report Types</div>
          <div className="space-y-1">
            {hasPersistedReportType && (
              <button
                onClick={selectPersistedType}
                className={cn(
                  "block w-full rounded px-2 py-2 text-left text-sm hover:bg-brand-50",
                  builderType === null && "bg-brand-50 font-semibold text-brand-900"
                )}
              >
                {persistedObjectLabel} (Saved)
              </button>
            )}
            {reportBuilderTypes.map((type) => (
              <button
                key={type}
                onClick={() => selectType(type)}
                className={cn(
                  "block w-full rounded px-2 py-2 text-left text-sm hover:bg-brand-50",
                  builderType === type && "bg-brand-50 font-semibold text-brand-900"
                )}
              >
                {type}
              </button>
            ))}
          </div>
          <div className="mt-4 border-t border-[#d8dde6] pt-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.04em] text-[#706e6b]">Columns</div>
            <div className="space-y-1">
              {availableColumns.map((column) => (
                <label
                  key={column}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-brand-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedColumns.includes(column)}
                    onChange={() => toggleColumn(column)}
                    className={checkboxClass}
                  />
                  <span>{fieldLabel(activeCrmObject, column)}</span>
                </label>
              ))}
            </div>
          </div>
        </aside>
        <div className="space-y-3">
          <div className="rounded border border-[#d8dde6] p-3">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
              <FieldShell label="Report Name">
                <input
                  className={inputClass}
                  value={reportName}
                  onChange={(event) => {
                    setError("");
                    setReportName(event.target.value);
                  }}
                />
              </FieldShell>
              <FieldShell label="Group Rows">
                <NativeSelect
                  options={groupOptions.map((option) => ({ value: option.field, label: option.label }))}
                  value={groupField}
                  onChange={setGroupField}
                />
              </FieldShell>
            </div>
          </div>
          {error && (
            <div className="rounded border border-[#f1c40f] bg-[#fff7d6] px-3 py-2 text-xs text-[#5f4b00]">{error}</div>
          )}

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
            <ReportBarChart report={previewReport} />
            <div className="rounded border border-[#d8dde6] p-3">
              <div className="mb-3 font-semibold">Outline</div>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs text-[#706e6b]">Object</dt>
                  <dd>{objectLabel}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[#706e6b]">Rows</dt>
                  <dd>{records.length}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[#706e6b]">Groups</dt>
                  <dd>{previewReport.rows.length}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[#706e6b]">Columns</dt>
                  <dd>{selectedColumns.length}</dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="rounded border border-[#d8dde6]">
            <div className="flex items-center justify-between border-b border-[#d8dde6] p-3">
              <div className="font-semibold">Preview</div>
              <div className="text-xs text-[#706e6b]">
                First {previewRows.length} row{previewRows.length === 1 ? "" : "s"}
              </div>
            </div>
            {previewRows.length === 0 ? (
              <div className="p-4 text-sm text-[#706e6b]">{previewReport.emptyMessage}</div>
            ) : (
              <div className="slds-scrollbar overflow-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[#f3f3f3] text-xs text-[#444]">
                    <tr>
                      {selectedColumns.map((column) => (
                        <th key={column} className="border-b border-[#d8dde6] px-3 py-2">
                          {fieldLabel(activeCrmObject, column)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((record) => (
                      <tr key={requiredId(record)} className="border-t border-[#d8dde6] hover:bg-brand-50/40">
                        {selectedColumns.map((column) => (
                          <td key={column} className="px-3 py-2">
                            {formatCell(record[column]) || "-"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </BaseDialog>
  );
}
