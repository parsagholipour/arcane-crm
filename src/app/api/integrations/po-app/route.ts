import { z } from "zod";
import { apiErrorResponse, apiSuccess } from "@/lib/api/response";
import { requireOrganizationAdmin } from "@/lib/organization-context";
import { poAppErrorResponse } from "@/lib/po-app-api";
import { loadPoAppIntegration, poAppIntegrationDto, savePoAppIntegration } from "@/lib/po-app-integration";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

// Every field is optional so the settings screen can save one card at a time. An omitted token
// keeps the stored one; an empty string clears it.
const settingsSchema = z.object({
  baseUrl: z.string().optional(),
  token: z.string().optional(),
  webhookSecret: z.string().optional(),
  enabled: z.boolean().optional(),
  storeId: z.string().nullable().optional(),
  syncIntervalMinutes: z.number().int().optional()
});

export async function GET() {
  try {
    const context = await requireOrganizationAdmin();
    return apiSuccess(poAppIntegrationDto(await loadPoAppIntegration(context.organizationId)));
  } catch (error) {
    return poAppErrorResponse(error) ?? apiErrorResponse(error, "Unable to load the PO App integration.");
  }
}

export async function PUT(request: NextRequest) {
  try {
    const context = await requireOrganizationAdmin();
    const input = settingsSchema.parse(await request.json());
    const integration = await savePoAppIntegration(context.organizationId, input);
    return apiSuccess(poAppIntegrationDto(integration));
  } catch (error) {
    return poAppErrorResponse(error) ?? apiErrorResponse(error, "Unable to save the PO App integration.");
  }
}
