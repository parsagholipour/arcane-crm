import { NextRequest, NextResponse } from "next/server";
import {
  activateOrganizationForUser,
  authorizationErrorResponse,
  requireAuthenticatedUser,
  setActiveOrganizationCookie
} from "@/lib/organization-context";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const organizationId = request.nextUrl.searchParams.get("organizationId")?.trim() ?? "";
    if (!organizationId) return NextResponse.json({ error: "Organization is required." }, { status: 400 });
    await activateOrganizationForUser(user.id, organizationId);
    const response = NextResponse.redirect(new URL("/lightning/page/home", request.url));
    return setActiveOrganizationCookie(response, organizationId);
  } catch (error) {
    return (
      authorizationErrorResponse(error) ??
      NextResponse.json({ error: "Unable to open the organization." }, { status: 500 })
    );
  }
}
