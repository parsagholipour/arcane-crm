import assert from "node:assert/strict";
import test from "node:test";
import { reportExportFilename, ReportExportValidationError, validateReportExportCsv } from "@/lib/report-export";

test("report export filenames are constrained to safe CSV attachments", () => {
  assert.equal(reportExportFilename("Pipeline by Stage.csv"), "pipeline-by-stage.csv");
  assert.equal(reportExportFilename('../../Quarterly "Forecast"'), "quarterly-forecast.csv");
  assert.equal(reportExportFilename(""), "report.csv");
});

test("report exports reject empty and oversized CSV payloads", () => {
  assert.equal(validateReportExportCsv('"Stage","Records"\n"Closed Won","1"'), '"Stage","Records"\n"Closed Won","1"');
  assert.throws(() => validateReportExportCsv(" \n"), ReportExportValidationError);
  assert.throws(() => validateReportExportCsv("x".repeat(2_000_001)), ReportExportValidationError);
});
