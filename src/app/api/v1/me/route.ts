import { requireOrganizationApiToken } from "@/lib/public-api/auth";
import { apiErrorResponse, apiSuccess } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const context = await requireOrganizationApiToken(request);
    return apiSuccess({
      organization: {
        id: context.organization.id,
        name: context.organization.name,
        slug: context.organization.slug
      }
    });
  } catch (error) {
    return apiErrorResponse(error, "Unable to authenticate the API token.");
  }
}
