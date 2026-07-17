import { NextRequest, NextResponse } from "next/server";
import { authorizationErrorResponse, requireOrganizationAdmin } from "@/lib/organization-context";
import { prisma } from "@/lib/prisma";
import { inviteOrganizationMember, UserManagementError } from "@/lib/user-management";

export async function GET() {
  try {
    const context = await requireOrganizationAdmin();
    const memberships = await prisma.organizationMembership.findMany({
      where: { organizationId: context.organizationId },
      include: { user: true },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }]
    });
    return NextResponse.json({ memberships });
  } catch (error) {
    return authorizationErrorResponse(error) ?? NextResponse.json({ error: "Unable to list organization users." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireOrganizationAdmin();
    const payload = (await request.json()) as { email?: unknown; name?: unknown; role?: unknown };
    const result = await inviteOrganizationMember({
      organizationId: context.organizationId,
      email: typeof payload.email === "string" ? payload.email : "",
      name: typeof payload.name === "string" ? payload.name : "",
      role: payload.role === "ADMIN" ? "ADMIN" : "MEMBER"
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof UserManagementError) return NextResponse.json({ error: error.message }, { status: error.status });
    return authorizationErrorResponse(error) ?? NextResponse.json({ error: "Unable to invite organization user." }, { status: 500 });
  }
}
