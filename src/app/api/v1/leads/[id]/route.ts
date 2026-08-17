import { apiErrorResponse, apiSuccess } from "@/lib/api/response";
import { requireOrganizationApiToken } from "@/lib/public-api/auth";
import { loadPublicLead } from "@/lib/public-api/lead";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function GET(request: Request, context: { params: Params }) {
  try {
    const auth = await requireOrganizationApiToken(request);
    const { id } = await context.params;
    return apiSuccess(await loadPublicLead(auth.organizationId, id));
  } catch (error) {
    return apiErrorResponse(error, "Unable to load the lead.");
  }
}
