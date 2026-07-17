import Link from "next/link";

export default function SignedOutPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
      <section className="w-full max-w-md rounded-lg border bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">You are signed out</h1>
        <Link className="mt-6 inline-flex rounded bg-[#0176d3] px-4 py-2 text-sm font-semibold text-white" href="/auth/keycloak?callbackUrl=/">Sign in again</Link>
      </section>
    </main>
  );
}
