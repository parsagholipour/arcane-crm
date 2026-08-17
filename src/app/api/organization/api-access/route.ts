import { NextRequest } from "next/server";
import { z } from "zod";
import { apiErrorResponse, apiSuccess } from "@/lib/api/response";
import {
  loadOrganizationApiAccess,
  organizationApiAccessDto,
  organizationApiAccessFailure,
  saveOrganizationWebhookSettings
} from "@/lib/organization-api-access";
import { requireOrganizationAdmin } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

const settingsSchema = z.object({
  webhookUrl: z.string().nullable().optional(),
  webhookEnabled: z.boolean().optional()
});

export async function GET() {
  try {
    const context = await requireOrganizationAdmin();
    return apiSuccess(organizationApiAccessDto(await loadOrganizationApiAccess(context.organizationId)));
  } catch (error) {
    return organizationApiAccessFailure(error) ?? apiErrorResponse(error, "Unable to load API access settings.");
  }
}

export async function PUT(request: NextRequest) {
  try {
    const context = await requireOrganizationAdmin();
    const input = settingsSchema.parse(await request.json());
    return apiSuccess(await saveOrganizationWebhookSettings(context.organizationId, input));
  } catch (error) {
    return organizationApiAccessFailure(error) ?? apiErrorResponse(error, "Unable to save API access settings.");
  }
}
