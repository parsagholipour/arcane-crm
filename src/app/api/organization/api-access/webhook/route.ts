import { z } from "zod";
import { apiErrorResponse, apiSuccess } from "@/lib/api/response";
import { organizationApiAccessFailure, rotateOrganizationWebhookSecret } from "@/lib/organization-api-access";
import { requireOrganizationAdmin } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

const rotateSchema = z.object({ rotateSecret: z.literal(true) });

export async function PUT(request: Request) {
  try {
    const context = await requireOrganizationAdmin();
    rotateSchema.parse(await request.json().catch(() => ({ rotateSecret: true })));
    return apiSuccess(await rotateOrganizationWebhookSecret(context.organizationId));
  } catch (error) {
    return organizationApiAccessFailure(error) ?? apiErrorResponse(error, "Unable to rotate the webhook secret.");
  }
}
