import Link from "next/link";

export default async function AuthErrorPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
      <section className="w-full max-w-md rounded-lg border bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Unable to sign in</h1>
        <p className="mt-3 text-sm text-slate-600">Your Keycloak identity is not invited, is suspended, or could not be verified.</p>
        {error && <p className="mt-2 text-xs text-slate-500">Error: {error}</p>}
        <Link className="mt-6 inline-flex rounded bg-[#0176d3] px-4 py-2 text-sm font-semibold text-white" href="/auth/keycloak?callbackUrl=/">Try again</Link>
      </section>
    </main>
  );
}
