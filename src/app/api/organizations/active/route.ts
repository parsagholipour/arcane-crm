import { NextRequest, NextResponse } from "next/server";
import {
  activateOrganizationForUser,
  authorizationErrorResponse,
  requireAuthenticatedUser,
  setActiveOrganizationCookie
} from "@/lib/organization-context";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const payload = (await request.json()) as { organizationId?: unknown };
    const organizationId = typeof payload.organizationId === "string" ? payload.organizationId : "";
    const membership = await activateOrganizationForUser(user.id, organizationId, 404);
    const response = NextResponse.json({
      organization: {
        id: membership.organization.id,
        name: membership.organization.name,
        slug: membership.organization.slug
      },
      role: membership.role
    });
    return setActiveOrganizationCookie(response, organizationId);
  } catch (error) {
    return (
      authorizationErrorResponse(error) ??
      NextResponse.json({ error: "Unable to switch organization." }, { status: 500 })
    );
  }
}
