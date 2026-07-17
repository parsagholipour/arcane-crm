import Link from "next/link";
import { auth } from "@/lib/auth";

export default async function NoOrganizationPage() {
  const session = await auth();
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
      <section className="w-full max-w-lg rounded-lg border bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">No active organization</h1>
        <p className="mt-3 text-sm text-slate-600">Your account does not currently have access to an active CRM organization.</p>
        <div className="mt-6 flex justify-center gap-3">
          {session?.user?.isSuperAdmin && <Link className="rounded bg-[#0176d3] px-4 py-2 text-sm font-semibold text-white" href="/super-admin">Open super admin</Link>}
          <Link className="rounded border px-4 py-2 text-sm font-semibold" href="/auth/signout">Sign out</Link>
        </div>
      </section>
    </main>
  );
}
