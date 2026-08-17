import { apiErrorResponse, apiSuccess } from "@/lib/api/response";
import { organizationApiAccessFailure, testOrganizationWebhook } from "@/lib/organization-api-access";
import { requireOrganizationAdmin } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const context = await requireOrganizationAdmin();
    return apiSuccess(await testOrganizationWebhook(context.organizationId));
  } catch (error) {
    return organizationApiAccessFailure(error) ?? apiErrorResponse(error, "Unable to send a webhook test.");
  }
}
