import { apiErrorResponse, apiSuccess } from "@/lib/api/response";
import { loadShellData } from "@/server/shell/load-shell";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return apiSuccess(await loadShellData());
  } catch (error) {
    return apiErrorResponse(error, "Unable to load the CRM shell.");
  }
}
