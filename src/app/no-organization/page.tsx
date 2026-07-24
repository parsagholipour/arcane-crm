import Link from "next/link";
import { auth } from "@/lib/auth";
import { ReloriqLogo } from "@/components/brand/ReloriqLogo";

export default async function NoOrganizationPage() {
  const session = await auth();
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
      <section className="w-full max-w-lg rounded-lg border bg-white p-8 text-center shadow-sm">
        <ReloriqLogo className="mb-6 justify-center" wordmarkClassName="text-xl font-bold text-shell" />
        <h1 className="text-xl font-semibold text-slate-900">No active organization</h1>
        <p className="mt-3 text-sm text-slate-600">Your account does not currently have access to an active Reloriq organization.</p>
        <div className="mt-6 flex justify-center gap-3">
          {session?.user?.isSuperAdmin && <Link className="rounded bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700" href="/super-admin">Open super admin</Link>}
          <Link className="rounded border px-4 py-2 text-sm font-semibold" href="/auth/signout">Sign out</Link>
        </div>
      </section>
    </main>
  );
}
