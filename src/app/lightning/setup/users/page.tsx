import Link from "next/link";
import { redirect } from "next/navigation";
import { OrganizationUsersClient } from "@/components/admin/OrganizationUsersClient";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { ReloriqLogo } from "@/components/brand/ReloriqLogo";
import { AppAuthorizationError, requireOrganizationAdmin } from "@/lib/organization-context";
import { ORGANIZATION_INVITATION_SOURCE } from "@/lib/organization-invitations";
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
    const deliveries = memberships.length
      ? await prisma.emailDelivery.findMany({
          where: {
            organizationId: context.organizationId,
            sourceType: ORGANIZATION_INVITATION_SOURCE,
            sourceId: { in: memberships.map((membership) => membership.id) }
          },
          orderBy: { acceptedAt: "desc" }
        })
      : [];
    const latestDeliveries = new Map<string, (typeof deliveries)[number]>();
    for (const delivery of deliveries) {
      if (delivery.sourceId && !latestDeliveries.has(delivery.sourceId))
        latestDeliveries.set(delivery.sourceId, delivery);
    }
    const membershipsWithDelivery = memberships.map((membership) => ({
      ...membership,
      invitationDelivery: latestDeliveries.get(membership.id) ?? null
    }));
    return (
      <div className="min-h-screen bg-[#f3f3f3] text-[#181818]">
        <header className="flex min-h-14 items-center gap-4 border-b border-[#d8dde6] bg-white px-5">
          <Link href="/lightning/page/home">
            <ReloriqLogo wordmarkClassName="text-lg font-bold text-shell" />
          </Link>
          <span className="rounded bg-brand-50 px-2 py-1 text-xs text-brand-900">
            {context.organization.name} · Organization Admin
          </span>
          <div className="ml-auto flex gap-3 text-sm">
            <Link href="/lightning/page/home">Back to Reloriq</Link>
            {isSuperAdminEmail(context.user.email) && <Link href="/super-admin">Super admin</Link>}
            <SignOutButton />
          </div>
        </header>
        <main className="mx-auto max-w-6xl p-5">
          <h1 className="text-2xl font-semibold">Organization users</h1>
          <p className="mb-5 mt-1 text-sm text-[#706e6b]">
            Manage roles and access for {context.organization.name}. Global identity and credential operations require a
            super admin.
          </p>
          <OrganizationUsersClient initialMemberships={JSON.parse(JSON.stringify(membershipsWithDelivery))} />
        </main>
      </div>
    );
  } catch (error) {
    if (error instanceof AppAuthorizationError)
      redirect(error.status === 401 ? "/auth/keycloak?callbackUrl=/lightning/setup/users" : "/lightning/page/home");
    throw error;
  }
}
