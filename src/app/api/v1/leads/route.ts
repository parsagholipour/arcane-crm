import { NextRequest } from "next/server";
import { apiErrorResponse, apiSuccess } from "@/lib/api/response";
import { requireOrganizationApiToken } from "@/lib/public-api/auth";
import { listPublicLeads, publicLeadListQuerySchema } from "@/lib/public-api/lead";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const context = await requireOrganizationApiToken(request);
    const query = publicLeadListQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    return apiSuccess(await listPublicLeads(context.organizationId, query));
  } catch (error) {
    return apiErrorResponse(error, "Unable to list leads.");
  }
}
