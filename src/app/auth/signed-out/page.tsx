import Link from "next/link";
import { ReloriqLogo } from "@/components/brand/ReloriqLogo";

export default function SignedOutPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
      <section className="w-full max-w-md rounded-lg border bg-white p-8 text-center shadow-sm">
        <ReloriqLogo className="mb-6 justify-center" wordmarkClassName="text-xl font-bold text-shell" />
        <h1 className="text-xl font-semibold text-slate-900">You are signed out</h1>
        <Link className="mt-6 inline-flex rounded bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700" href="/auth/keycloak?callbackUrl=/">Sign in again</Link>
      </section>
    </main>
  );
}
