import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountSessionsClient } from "@/components/admin/AccountSessionsClient";
import { AppAuthorizationError, requireAuthenticatedUser } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

export default async function AccountSessionsPage() {
  try {
    const user = await requireAuthenticatedUser();
    return (
      <div className="min-h-screen bg-[#f3f3f3] text-[#181818]">
        <header className="flex min-h-14 items-center border-b bg-white px-5"><Link className="font-semibold text-[#032d60]" href="/lightning/page/home">Salesforce CRM</Link><span className="ml-auto text-sm text-[#706e6b]">{user.email}</span></header>
        <main className="mx-auto max-w-4xl p-5"><h1 className="text-2xl font-semibold">Account sessions</h1><p className="mt-1 mb-5 text-sm text-[#706e6b]">Review and revoke application and Keycloak sessions associated with your identity.</p><AccountSessionsClient /></main>
      </div>
    );
  } catch (error) {
    if (error instanceof AppAuthorizationError) redirect("/auth/keycloak?callbackUrl=/account/sessions");
    throw error;
  }
}
