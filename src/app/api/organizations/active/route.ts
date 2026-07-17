import { NextRequest, NextResponse } from "next/server";
import { ACTIVE_ORGANIZATION_COOKIE, authorizationErrorResponse, requireAuthenticatedUser } from "@/lib/organization-context";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const payload = (await request.json()) as { organizationId?: unknown };
    const organizationId = typeof payload.organizationId === "string" ? payload.organizationId : "";
    const membership = await prisma.organizationMembership.findFirst({
      where: { organizationId, userId: user.id, status: "ACTIVE", organization: { status: "ACTIVE" } },
      include: { organization: true }
    });
    if (!membership) return NextResponse.json({ error: "Organization membership not found." }, { status: 404 });
    await prisma.organizationMembership.update({ where: { id: membership.id }, data: { lastAccessedAt: new Date() } });
    const response = NextResponse.json({
      organization: { id: membership.organization.id, name: membership.organization.name, slug: membership.organization.slug },
      role: membership.role
    });
    response.cookies.set(ACTIVE_ORGANIZATION_COOKIE, organizationId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 30 * 24 * 60 * 60
    });
    return response;
  } catch (error) {
    return authorizationErrorResponse(error) ?? NextResponse.json({ error: "Unable to switch organization." }, { status: 500 });
  }
}
