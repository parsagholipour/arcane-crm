import Link from "next/link";
import { redirect } from "next/navigation";
import { OrganizationUsersClient } from "@/components/admin/OrganizationUsersClient";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { ReloriqLogo } from "@/components/brand/ReloriqLogo";
import { AppAuthorizationError, requireOrganizationAdmin } from "@/lib/organization-context";
import { prisma } from "@/lib/prisma";
import { isSuperAdminEmail } from "@/lib/super-admin-constants";

export const dynamic = "force-dynamic";

export default async function OrganizationUsersPage() {
  try {
    const context = await requireOrganizationAdmin();
    const memberships = await prisma.organizationMembership.findMany({
      where: { organizationId: context.organizationId },
      include: { user: true },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }]
    });
    return (
      <div className="min-h-screen bg-[#f3f3f3] text-[#181818]">
        <header className="flex min-h-14 items-center gap-4 border-b border-[#d8dde6] bg-white px-5">
          <Link href="/lightning/page/home"><ReloriqLogo wordmarkClassName="text-lg font-bold text-shell" /></Link>
          <span className="rounded bg-brand-50 px-2 py-1 text-xs text-brand-900">{context.organization.name} · Organization Admin</span>
          <div className="ml-auto flex gap-3 text-sm"><Link href="/lightning/page/home">Back to Reloriq</Link>{isSuperAdminEmail(context.user.email) && <Link href="/super-admin">Super admin</Link>}<SignOutButton /></div>
        </header>
        <main className="mx-auto max-w-6xl p-5">
          <h1 className="text-2xl font-semibold">Organization users</h1>
          <p className="mt-1 mb-5 text-sm text-[#706e6b]">Manage roles and access for {context.organization.name}. Global identity and credential operations require a super admin.</p>
          <OrganizationUsersClient initialMemberships={JSON.parse(JSON.stringify(memberships))} />
        </main>
      </div>
    );
  } catch (error) {
    if (error instanceof AppAuthorizationError) redirect(error.status === 401 ? "/auth/keycloak?callbackUrl=/lightning/setup/users" : "/lightning/page/home");
    throw error;
  }
}
