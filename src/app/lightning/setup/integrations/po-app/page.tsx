import Link from "next/link";
import { redirect } from "next/navigation";
import { PoAppIntegrationClient } from "@/components/admin/PoAppIntegrationClient";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { ReloriqLogo } from "@/components/brand/ReloriqLogo";
import { AppAuthorizationError, requireOrganizationAdmin } from "@/lib/organization-context";
import { loadPoAppIntegration, poAppIntegrationDto } from "@/lib/po-app-integration";
import { prisma } from "@/lib/prisma";
import { resolvePublicAppUrl } from "@/lib/public-app-url";
import { isSuperAdminEmail } from "@/lib/super-admin-constants";

export const dynamic = "force-dynamic";

export default async function PoAppIntegrationPage() {
  try {
    const context = await requireOrganizationAdmin();
    const [integration, stores] = await Promise.all([
      loadPoAppIntegration(context.organizationId),
      prisma.marketingStore.findMany({
        where: { organizationId: context.organizationId, archivedAt: null },
        orderBy: [{ name: "asc" }],
        select: { id: true, name: true, currency: true }
      })
    ]);
    const webhookUrl = `${resolvePublicAppUrl()}/api/integrations/po-app/webhook/${context.organizationId}`;

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
            <Link href="/lightning/o/Product2/list">Products</Link>
            <Link href="/lightning/page/home">Back to Reloriq</Link>
            {isSuperAdminEmail(context.user.email) && <Link href="/super-admin">Super admin</Link>}
            <SignOutButton />
          </div>
        </header>
        <main className="mx-auto max-w-4xl p-5">
          <h1 className="text-2xl font-semibold">PO App product sync</h1>
          <p className="mb-5 mt-1 text-sm text-[#706e6b]">
            Connect a PO App store to import its catalogue into {context.organization.name}. Products are matched on
            their PO App id, so re-running a sync updates rows instead of duplicating them.
          </p>
          <PoAppIntegrationClient
            initialSettings={poAppIntegrationDto(integration)}
            stores={stores}
            webhookUrl={webhookUrl}
          />
        </main>
      </div>
    );
  } catch (error) {
    if (error instanceof AppAuthorizationError)
      redirect(
        error.status === 401
          ? "/auth/keycloak?callbackUrl=/lightning/setup/integrations/po-app"
          : "/lightning/page/home"
      );
    throw error;
  }
}
