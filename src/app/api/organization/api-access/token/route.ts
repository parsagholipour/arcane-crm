import { apiErrorResponse, apiSuccess } from "@/lib/api/response";
import {
  issueOrganizationApiToken,
  organizationApiAccessFailure,
  revokeOrganizationApiToken
} from "@/lib/organization-api-access";
import { requireOrganizationAdmin } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const context = await requireOrganizationAdmin();
    return apiSuccess(await issueOrganizationApiToken(context.organizationId));
  } catch (error) {
    return organizationApiAccessFailure(error) ?? apiErrorResponse(error, "Unable to create an API token.");
  }
}

export async function DELETE() {
  try {
    const context = await requireOrganizationAdmin();
    return apiSuccess(await revokeOrganizationApiToken(context.organizationId));
  } catch (error) {
    return organizationApiAccessFailure(error) ?? apiErrorResponse(error, "Unable to revoke the API token.");
  }
}
