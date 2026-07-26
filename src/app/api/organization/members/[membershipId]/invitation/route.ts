import { NextResponse } from "next/server";
import { authorizationErrorResponse, requireOrganizationAdmin } from "@/lib/organization-context";
import { resendOrganizationInvitation, UserManagementError } from "@/lib/user-management";

type Params = Promise<{ membershipId: string }>;

export async function POST(_request: Request, { params }: { params: Params }) {
  try {
    const context = await requireOrganizationAdmin();
    const { membershipId } = await params;
    const result = await resendOrganizationInvitation({
      organizationId: context.organizationId,
      membershipId,
      initiatedByUserId: context.userId
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof UserManagementError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    return (
      authorizationErrorResponse(error) ??
      NextResponse.json({ error: "Unable to resend organization invitation." }, { status: 500 })
    );
  }
}
