import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizationErrorResponse, requireOrganizationContext } from "@/lib/organization-context";
import { handleAnalyticsMutation } from "@/server/resources/mutations/analytics";
import { handleCalendarAndPartnersMutation } from "@/server/resources/mutations/calendar-and-partners";
import type { ResourceMutationHandler } from "@/server/resources/mutations/context";
import { handleListsMutation } from "@/server/resources/mutations/lists";
import { handleNotificationsMutation } from "@/server/resources/mutations/notifications";
import { handlePreferencesMutation } from "@/server/resources/mutations/preferences";

const resourceMutationSchema = z.object({
  action: z.string().min(1),
  id: z.string().optional(),
  values: z.record(z.string(), z.unknown()).optional()
});

const handlers: ResourceMutationHandler[] = [
  handleCalendarAndPartnersMutation,
  handleAnalyticsMutation,
  handleNotificationsMutation,
  handlePreferencesMutation,
  handleListsMutation
];

export async function executeResourceMutationRequest(request: NextRequest) {
  try {
    const authContext = await requireOrganizationContext();
    const parsed = resourceMutationSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "Invalid resource mutation.",
            fieldErrors: parsed.error.flatten().fieldErrors
          }
        },
        { status: 400 }
      );
    }
    const payload = parsed.data;
    const context = {
      payload,
      values: payload.values ?? {},
      organizationId: authContext.organizationId,
      userId: authContext.userId,
      personalWhere: { organizationId: authContext.organizationId, userId: authContext.userId }
    };
    for (const handler of handlers) {
      const response = await handler(context);
      if (response) return response;
    }
    return NextResponse.json(
      { error: { code: "UNKNOWN_ACTION", message: "Unknown resource mutation." } },
      { status: 400 }
    );
  } catch (error) {
    console.error(error);
    const response = authorizationErrorResponse(error);
    if (response) return response;
    return NextResponse.json(
      { error: { code: "RESOURCE_MUTATION_FAILED", message: "Unable to update resource state." } },
      { status: 500 }
    );
  }
}
