import { apiErrorResponse, apiSuccess } from "@/lib/api/response";
import { requireOrganizationAdmin } from "@/lib/organization-context";
import { poAppErrorResponse } from "@/lib/po-app-api";
import { poAppIntegrationDto, testPoAppConnection } from "@/lib/po-app-integration";

export const dynamic = "force-dynamic";

/** Connectivity check against GET /api/v1/me. Records the store the token can reach. */
export async function POST() {
  try {
    const context = await requireOrganizationAdmin();
    const { integration, identity } = await testPoAppConnection(context.organizationId);
    return apiSuccess({ integration: poAppIntegrationDto(integration), identity });
  } catch (error) {
    return poAppErrorResponse(error) ?? apiErrorResponse(error, "Unable to reach PO App.");
  }
}
