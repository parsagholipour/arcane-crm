import { NextRequest, NextResponse } from "next/server";
import { authorizationErrorResponse, requireOrganizationAdmin } from "@/lib/organization-context";
import { removeOrganizationMembership, updateOrganizationMembership, UserManagementError } from "@/lib/user-management";

type Params = Promise<{ membershipId: string }>;

export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  try {
    const context = await requireOrganizationAdmin();
    const { membershipId } = await params;
    const payload = (await request.json()) as { role?: unknown; status?: unknown };
    const membership = await updateOrganizationMembership({
      organizationId: context.organizationId,
      membershipId,
      role: payload.role === "ADMIN" || payload.role === "MEMBER" ? payload.role : undefined,
      status: payload.status === "ACTIVE" || payload.status === "SUSPENDED" ? payload.status : undefined
    });
    return NextResponse.json({ membership });
  } catch (error) {
    if (error instanceof UserManagementError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    return (
      authorizationErrorResponse(error) ??
      NextResponse.json({ error: "Unable to update organization user." }, { status: 500 })
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Params }) {
  try {
    const context = await requireOrganizationAdmin();
    const { membershipId } = await params;
    await removeOrganizationMembership(context.organizationId, membershipId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof UserManagementError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    return (
      authorizationErrorResponse(error) ??
      NextResponse.json({ error: "Unable to remove organization user." }, { status: 500 })
    );
  }
}
