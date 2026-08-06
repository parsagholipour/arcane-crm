import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

export default async function AuthErrorPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
      <section className="w-full max-w-md rounded-lg border bg-white p-8 text-center shadow-sm">
        <Logo className="mb-6 justify-center" wordmarkClassName="text-xl font-bold text-shell" />
        <h1 className="text-xl font-semibold text-slate-900">Unable to sign in</h1>
        <p className="mt-3 text-sm text-slate-600">
          Your Keycloak identity is not invited, is suspended, or could not be verified.
        </p>
        {error && <p className="mt-2 text-xs text-slate-500">Error: {error}</p>}
        <Link
          className="mt-6 inline-flex rounded bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          href="/auth/keycloak?callbackUrl=/"
        >
          Try again
        </Link>
      </section>
    </main>
  );
}
