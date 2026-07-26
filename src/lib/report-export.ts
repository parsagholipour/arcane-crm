export class ReportExportValidationError extends Error {
  status = 400;
}

const maxReportExportCharacters = 2_000_000;

export function validateReportExportCsv(value: unknown) {
  const csv = String(value ?? "");
  if (!csv.trim()) throw new ReportExportValidationError("The report export is empty.");
  if (csv.length > maxReportExportCharacters) throw new ReportExportValidationError("The report export is too large.");
  return csv;
}

export function reportExportFilename(value: unknown) {
  const base =
    String(value ?? "report")
      .toLowerCase()
      .replace(/\.csv$/i, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 120) || "report";
  return `${base}.csv`;
}
