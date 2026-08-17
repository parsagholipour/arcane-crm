import Link from "next/link";
import { redirect } from "next/navigation";
import { OrganizationApiAccessClient } from "@/components/admin/OrganizationApiAccessClient";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { Logo } from "@/components/brand/Logo";
import { BRAND } from "@/lib/brand";
import { loadOrganizationApiAccess, organizationApiAccessDto } from "@/lib/organization-api-access";
import { AppAuthorizationError, requireOrganizationAdmin } from "@/lib/organization-context";
import { isSuperAdminEmail } from "@/lib/super-admin-constants";

export const dynamic = "force-dynamic";

export default async function OrganizationApiAccessPage() {
  try {
    const context = await requireOrganizationAdmin();
    return (
      <div className="min-h-screen bg-[#f3f3f3] text-[#181818]">
        <header className="flex min-h-14 items-center gap-4 border-b border-[#d8dde6] bg-white px-5">
          <Link href="/lightning/page/home">
            <Logo wordmarkClassName="text-lg font-bold text-shell" />
          </Link>
          <span className="rounded bg-brand-50 px-2 py-1 text-xs text-brand-900">
            {context.organization.name} · Organization Admin
          </span>
          <div className="ml-auto flex gap-3 text-sm">
            <Link href="/lightning/o/Lead/list?filterName=AllOpenLeads">Leads</Link>
            <Link href="/lightning/page/home">Back to {BRAND.name}</Link>
            {isSuperAdminEmail(context.user.email) && <Link href="/super-admin">Super admin</Link>}
            <SignOutButton />
          </div>
        </header>
        <main className="mx-auto max-w-4xl p-5">
          <h1 className="text-2xl font-semibold">API access</h1>
          <p className="mb-5 mt-1 text-sm text-[#706e6b]">
            Issue a token so integrations can read Leads for {context.organization.name}, and optionally receive signed
            webhooks when those Leads change.
          </p>
          <OrganizationApiAccessClient
            initialSettings={organizationApiAccessDto(await loadOrganizationApiAccess(context.organizationId))}
          />
        </main>
      </div>
    );
  } catch (error) {
    if (error instanceof AppAuthorizationError)
      redirect(error.status === 401 ? "/auth/keycloak?callbackUrl=/lightning/setup/api" : "/lightning/page/home");
    throw error;
  }
}
