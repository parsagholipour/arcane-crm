import { NextRequest, NextResponse } from "next/server";
import { authorizationErrorResponse, requireOrganizationContext } from "@/lib/organization-context";
import { reportExportFilename, ReportExportValidationError, validateReportExportCsv } from "@/lib/report-export";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    await requireOrganizationContext();
    const payload = await request.formData();
    const csv = validateReportExportCsv(payload.get("csv"));
    const filename = reportExportFilename(payload.get("filename"));
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store"
      }
    });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    if (error instanceof ReportExportValidationError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Unable to export report." }, { status: 500 });
  }
}
