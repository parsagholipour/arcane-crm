import "server-only";

import { redirect } from "next/navigation";
import { AppAuthorizationError, requireAuthenticatedUser } from "@/lib/organization-context";
import { isSuperAdminEmail } from "@/lib/super-admin-constants";

export async function assertSuperAdmin() {
  const user = await requireAuthenticatedUser();
  if (!isSuperAdminEmail(user.email)) throw new AppAuthorizationError("Super administrator access required.", 403);
  return user;
}

export async function requireSuperAdminPage() {
  try {
    return await assertSuperAdmin();
  } catch {
    redirect("/");
  }
}
