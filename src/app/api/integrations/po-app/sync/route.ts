import { z } from "zod";
import { apiErrorResponse, apiSuccess } from "@/lib/api/response";
import { requireOrganizationAdmin } from "@/lib/organization-context";
import { poAppErrorResponse } from "@/lib/po-app-api";
import { loadPoAppIntegration, poAppIntegrationDto } from "@/lib/po-app-integration";
import { runDuePoAppSyncs } from "@/lib/po-app-sync";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const syncSchema = z.object({
  mode: z.enum(["incremental", "full"]).optional(),
  force: z.boolean().optional()
});

/**
 * Foreground twin of the scheduled dispatch route, scoped to the caller's organization. The sync
 * service still takes the lease, so this can never collide with a scheduled run.
 */
export async function POST(request: NextRequest) {
  try {
    const context = await requireOrganizationAdmin();
    const body = await request.json().catch(() => ({}));
    const { mode = "incremental", force = true } = syncSchema.parse(body ?? {});
    const summary = await runDuePoAppSyncs({ organizationId: context.organizationId, mode, force, limit: 1 });
    const integration = await loadPoAppIntegration(context.organizationId);
    return apiSuccess({ summary, integration: poAppIntegrationDto(integration) });
  } catch (error) {
    return poAppErrorResponse(error) ?? apiErrorResponse(error, "Unable to sync the PO App catalogue.");
  }
}
