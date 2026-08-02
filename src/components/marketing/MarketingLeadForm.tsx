"use client";

import { useState, type FormEvent } from "react";
import { apiRequest, jsonBody } from "@/lib/api/client";

type Page = {
  name: string;
  slug: string;
  headline: string;
  description: string | null;
  submitLabel: string;
  successMessage: string;
  fields: string[];
};
const labels: Record<string, string> = {
  firstName: "First Name",
  lastName: "Last Name",
  email: "Email",
  company: "Company",
  phone: "Phone",
  title: "Title",
  message: "How can we help?"
};

export function MarketingLeadForm({
  organizationSlug,
  organizationName,
  page
}: {
  organizationSlug: string;
  organizationName: string;
  page: Page;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const payload = await apiRequest<{ successMessage?: string }>(
        `/api/marketing/public/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(page.slug)}/submissions`,
        { method: "POST", body: jsonBody(values) }
      );
      setSuccess(String(payload.successMessage ?? page.successMessage));
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "The form could not be submitted.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#eef4ff] to-[#f7fbff] px-4 py-10 text-[#181818]">
      <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-[#d8dde6] bg-white shadow-xl">
        <header className="bg-[#032d60] px-6 py-8 text-white">
          <div className="text-sm font-semibold text-[#c9e0f5]">{organizationName}</div>
          <h1 className="mt-2 text-3xl font-bold">{page.headline}</h1>
          {page.description && <p className="mt-3 max-w-xl text-[#eaf5fe]">{page.description}</p>}
        </header>
        <div className="p-6">
          {success ? (
            <div className="rounded-lg border border-[#2e844a] bg-[#e4f6e6] p-5 text-[#194f25]">
              <h2 className="font-semibold">Submission received</h2>
              <p className="mt-1">{success}</p>
            </div>
          ) : (
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
              <input name="website" className="hidden" tabIndex={-1} autoComplete="off" />
              {page.fields.map((field) => (
                <label key={field} className={field === "message" ? "sm:col-span-2" : ""}>
                  <span className="mb-1 block text-sm font-semibold">
                    {labels[field] ?? field}
                    {field === "email" ? " *" : ""}
                  </span>
                  {field === "message" ? (
                    <textarea
                      name={field}
                      className="min-h-28 w-full rounded border border-[#c9c9c9] px-3 py-2 outline-none focus:border-[#0176d3] focus:ring-2 focus:ring-[#0176d333]"
                    />
                  ) : (
                    <input
                      name={field}
                      type={field === "email" ? "email" : field === "phone" ? "tel" : "text"}
                      required={field === "email"}
                      className="w-full rounded border border-[#c9c9c9] px-3 py-2 outline-none focus:border-[#0176d3] focus:ring-2 focus:ring-[#0176d333]"
                    />
                  )}
                </label>
              ))}
              {error && (
                <div
                  className="rounded border border-[#ea001e] bg-[#fff1f1] p-3 text-sm text-[#8e030f] sm:col-span-2"
                  role="alert"
                >
                  {error}
                </div>
              )}
              <div className="sm:col-span-2">
                <button
                  disabled={submitting}
                  className="rounded bg-[#0176d3] px-5 py-2.5 font-semibold text-white hover:bg-[#014486] disabled:opacity-50"
                >
                  {submitting ? "Submitting…" : page.submitLabel}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
