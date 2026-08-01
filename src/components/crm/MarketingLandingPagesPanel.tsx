"use client";

import { Archive, ExternalLink, FileText, Plus, RotateCcw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import type { FieldDefinition, ScopedCrmData, RecordData } from "@/lib/crm-types";
import { cn, formatDateTime, slugify } from "@/lib/utils";
import { AsyncButton } from "@/components/crm/AsyncButton";
import { LookupField } from "@/features/crm/form-controls";
import { apiRequest } from "@/lib/api/client";

type Toast = { tone: "success" | "error" | "warning"; message: string } | null;
type Updater = (updater: (previous: ScopedCrmData) => ScopedCrmData) => void;
const optionalFields = ["firstName", "phone", "title", "message"];
const fieldLabels: Record<string, string> = {
  firstName: "First Name",
  phone: "Phone",
  title: "Title",
  message: "Message"
};
const input =
  "w-full rounded border border-[#c9c9c9] bg-white px-3 py-2 text-sm outline-none focus:border-[#0176d3] focus:ring-2 focus:ring-[#0176d333]";
const secondary =
  "inline-flex min-h-8 items-center justify-center gap-1 rounded border border-[#c9c9c9] bg-white px-3 py-1 text-xs font-semibold text-brand-700 hover:bg-[#f3f3f3] disabled:opacity-50";
const primary =
  "inline-flex min-h-8 items-center justify-center gap-1 rounded border border-brand-700 bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50";
const danger =
  "inline-flex min-h-8 items-center justify-center gap-1 rounded border border-[#ba0517] bg-white px-3 py-1 text-xs font-semibold text-[#ba0517] hover:bg-[#fff1f1] disabled:opacity-50";
const campaignLookupField: FieldDefinition = {
  name: "campaignId",
  label: "Campaign",
  section: "Landing Page",
  type: "lookup",
  lookupObject: "Campaign"
};

export function MarketingLandingPagesPanel({
  data,
  onDataChange,
  onToast
}: {
  data: ScopedCrmData;
  onDataChange: Updater;
  onToast: (toast: Toast) => void;
}) {
  const [editing, setEditing] = useState<RecordData | null | undefined>(undefined);
  const pages = data.marketingLandingPages as Array<RecordData & { campaign?: RecordData }>;

  function apply(payload: Record<string, unknown>) {
    const page = payload.page as RecordData | undefined;
    const notifications = Array.isArray(payload.notifications) ? (payload.notifications as RecordData[]) : [];
    if (!page?.id) return;
    onDataChange((previous) => ({
      ...previous,
      marketingLandingPages: previous.marketingLandingPages.some((item) => item.id === page.id)
        ? previous.marketingLandingPages.map((item) => (item.id === page.id ? page : item))
        : [page, ...previous.marketingLandingPages],
      notifications: [
        ...notifications,
        ...previous.notifications.filter((item) => !notifications.some((incoming) => incoming.id === item.id))
      ]
    }));
  }

  async function action(page: RecordData, actionName: string) {
    if (
      (actionName === "archive" || actionName === "restore") &&
      !window.confirm(`${actionName === "archive" ? "Archive" : "Restore"} ${String(page.name)}?`)
    )
      return;
    try {
      const payload = await json(`/api/marketing/landing-pages/${String(page.id)}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionName })
      });
      apply(payload);
      onToast({ tone: "success", message: `Landing page is now ${String((payload.page as RecordData).status)}.` });
    } catch (error) {
      onToast({ tone: "error", message: error instanceof Error ? error.message : "Unable to update landing page." });
    }
  }

  async function remove(page: RecordData) {
    if (!window.confirm(`Delete ${String(page.name)}? This cannot be undone.`)) return;
    try {
      await json(`/api/marketing/landing-pages/${String(page.id)}`, { method: "DELETE" });
      onDataChange((previous) => ({
        ...previous,
        marketingLandingPages: previous.marketingLandingPages.filter((item) => item.id !== page.id)
      }));
      onToast({ tone: "success", message: "Landing page deleted." });
    } catch (error) {
      onToast({ tone: "error", message: error instanceof Error ? error.message : "Unable to delete landing page." });
    }
  }

  return (
    <section
      id="marketing-landing-pages"
      tabIndex={-1}
      aria-labelledby="marketing-landing-pages-heading"
      className="scroll-mt-3 rounded-lg border border-[#e4e7ec] bg-white shadow-card outline-none transition-shadow focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#d8dde6] p-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="text-brand-600" size={20} />
            <h2 id="marketing-landing-pages-heading" className="text-lg font-semibold">
              Landing Pages & Lead Forms
            </h2>
          </div>
          <p className="mt-1 text-sm text-[#706e6b]">
            Publish branded forms that create organization-scoped Leads and optionally add them to a Campaign.
          </p>
        </div>
        <button className={primary} onClick={() => setEditing(null)}>
          <Plus size={13} /> New Landing Page
        </button>
      </div>
      <div className="grid gap-3 p-4 lg:grid-cols-2">
        {pages.map((page) => {
          const submissions = Array.isArray(page.submissions) ? (page.submissions as RecordData[]) : [];
          const submissionCount = Number((page._count as RecordData | undefined)?.submissions ?? submissions.length);
          const publicHref = `/forms/${encodeURIComponent(data.organization.slug)}/${encodeURIComponent(String(page.slug))}`;
          return (
            <article key={String(page.id)} className="rounded border border-[#d8dde6] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{String(page.name)}</h3>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs">
                    <Status value={page.status} />
                    <span className="text-[#706e6b]">
                      {submissionCount} submission{submissionCount === 1 ? "" : "s"}
                    </span>
                    {page.campaign && (
                      <span className="text-[#706e6b]">Campaign: {String((page.campaign as RecordData).name)}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-1">
                  {page.status === "Draft" && (
                    <button className={secondary} onClick={() => setEditing(page)}>
                      Edit
                    </button>
                  )}
                  {page.status === "Draft" && (
                    <button className={primary} onClick={() => void action(page, "publish")}>
                      Publish
                    </button>
                  )}
                  {page.status === "Published" && (
                    <a className={secondary} href={publicHref} target="_blank" rel="noreferrer">
                      <ExternalLink size={12} /> Open
                    </a>
                  )}
                  {page.status === "Published" && (
                    <button className={secondary} onClick={() => void action(page, "archive")}>
                      <Archive size={12} /> Archive
                    </button>
                  )}
                  {page.status === "Archived" && (
                    <button className={secondary} onClick={() => void action(page, "restore")}>
                      <RotateCcw size={12} /> Restore Draft
                    </button>
                  )}
                  {page.status === "Draft" && submissionCount === 0 && (
                    <button
                      className={danger}
                      onClick={() => void remove(page)}
                      aria-label={`Delete ${String(page.name)}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-3 rounded bg-[#f8f9fb] p-3">
                <div className="text-xs text-[#706e6b]">Headline</div>
                <div className="font-medium">{String(page.headline)}</div>
                <div className="mt-2 break-all text-xs text-brand-700">{publicHref}</div>
              </div>
              {submissions.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1 text-xs font-semibold uppercase text-[#706e6b]">Recent submissions</div>
                  {submissions.slice(0, 3).map((submission) => {
                    const lead = submission.lead as RecordData | undefined;
                    return (
                      <div
                        key={String(submission.id)}
                        className="flex items-center justify-between border-t border-[#eef1f6] py-2 text-sm"
                      >
                        <div>
                          <div className="font-medium">
                            {lead ? [lead.firstName, lead.lastName].filter(Boolean).join(" ") : "Retained submission"}
                          </div>
                          <div className="text-xs text-[#706e6b]">{formatDateTime(String(submission.submittedAt))}</div>
                        </div>
                        {lead?.id && (
                          <Link
                            className="text-xs font-semibold text-brand-700 hover:underline"
                            href={`/lightning/r/Lead/${String(lead.id)}/view`}
                          >
                            Open Lead
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </article>
          );
        })}
        {pages.length === 0 && (
          <div className="col-span-full rounded border border-dashed border-[#d8dde6] p-8 text-center text-sm text-[#706e6b]">
            Create a Draft, choose form fields, then publish a real lead-capture page.
          </div>
        )}
      </div>
      {editing !== undefined && (
        <LandingPageEditor
          data={data}
          initial={editing ?? undefined}
          onClose={() => setEditing(undefined)}
          onSaved={(payload) => {
            apply(payload);
            setEditing(undefined);
            onToast({
              tone: "success",
              message: editing?.id ? "Landing page updated." : "Landing page created as a Draft."
            });
          }}
        />
      )}
    </section>
  );
}

function LandingPageEditor({
  data,
  initial,
  onClose,
  onSaved
}: {
  data: ScopedCrmData;
  initial?: RecordData;
  onClose: () => void;
  onSaved: (payload: Record<string, unknown>) => void;
}) {
  const [values, setValues] = useState(() => ({
    name: String(initial?.name ?? ""),
    slug: String(initial?.slug ?? ""),
    headline: String(initial?.headline ?? ""),
    description: String(initial?.description ?? ""),
    submitLabel: String(initial?.submitLabel ?? "Submit"),
    successMessage: String(initial?.successMessage ?? "Thanks. Your information was received."),
    ownerId: String(initial?.ownerId ?? data.user.id),
    campaignId: String(initial?.campaignId ?? ""),
    fields: Array.isArray(initial?.fields)
      ? initial.fields.map(String)
      : ["firstName", "lastName", "email", "company", "phone"]
  }));
  const [slugManual, setSlugManual] = useState(Boolean(initial?.slug));
  const initialSnapshot = useMemo(() => JSON.stringify(values), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const dirty = JSON.stringify(values) !== initialSnapshot;
  function close() {
    if (!dirty || window.confirm("Discard unsaved landing-page changes?")) onClose();
  }
  function toggle(field: string) {
    setValues((current) => ({
      ...current,
      fields: current.fields.includes(field)
        ? current.fields.filter((item) => item !== field)
        : [...current.fields, field]
    }));
  }
  async function save() {
    setSaving(true);
    setError("");
    try {
      const payload = await json(
        initial?.id ? `/api/marketing/landing-pages/${String(initial.id)}` : "/api/marketing/landing-pages",
        {
          method: initial?.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values)
        }
      );
      onSaved(payload);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save landing page.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal
      title={initial ? `Edit ${String(initial.name)}` : "New Landing Page"}
      onClose={close}
      footer={
        <>
          <button className={secondary} onClick={close}>
            Cancel
          </button>
          <AsyncButton className={primary} disabled={saving} onClick={() => save()}>
            {saving ? "Saving…" : "Save Draft"}
          </AsyncButton>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {error && (
          <div className="rounded border border-[#ea001e] bg-[#fff1f1] p-3 text-sm text-[#8e030f] sm:col-span-2">
            {error}
          </div>
        )}
        <Field label="Page Name" required>
          <input
            className={input}
            value={values.name}
            onChange={(event) => {
              const name = event.target.value;
              setValues({ ...values, name, slug: slugManual ? values.slug : slugify(name) });
            }}
          />
        </Field>
        <Field label="URL Slug" required>
          <input
            className={input}
            value={values.slug}
            onChange={(event) => {
              setSlugManual(true);
              setValues({ ...values, slug: slugify(event.target.value) });
            }}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Headline" required>
            <input
              className={input}
              value={values.headline}
              onChange={(event) => setValues({ ...values, headline: event.target.value })}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Description">
            <textarea
              className={cn(input, "min-h-20")}
              value={values.description}
              onChange={(event) => setValues({ ...values, description: event.target.value })}
            />
          </Field>
        </div>
        <Field label="Owner">
          <select
            className={input}
            value={values.ownerId}
            onChange={(event) => setValues({ ...values, ownerId: event.target.value })}
          >
            {data.users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Campaign">
          <LookupField
            field={campaignLookupField}
            value={values.campaignId}
            data={{ ...data, campaigns: data.campaigns.filter((campaign) => campaign.status !== "Archived") }}
            inlineSelection
            onChange={(campaignId) => setValues({ ...values, campaignId })}
          />
        </Field>
        <Field label="Submit Button">
          <input
            className={input}
            value={values.submitLabel}
            onChange={(event) => setValues({ ...values, submitLabel: event.target.value })}
          />
        </Field>
        <Field label="Success Message">
          <input
            className={input}
            value={values.successMessage}
            onChange={(event) => setValues({ ...values, successMessage: event.target.value })}
          />
        </Field>
        <div className="sm:col-span-2">
          <div className="mb-2 text-sm font-semibold">Form Fields</div>
          <div className="mb-2 rounded bg-[#f8f9fb] p-2 text-xs text-[#706e6b]">
            Last Name, Email, and Company are always required so each submission can create a usable Lead.
          </div>
          <div className="flex flex-wrap gap-3">
            {optionalFields.map((field) => (
              <label key={field} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={values.fields.includes(field)} onChange={() => toggle(field)} />{" "}
                {fieldLabels[field]}
              </label>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Status({ value }: { value: unknown }) {
  const status = String(value);
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 font-semibold",
        status === "Published"
          ? "bg-[#e4f6e6] text-[#194f25]"
          : status === "Archived"
            ? "bg-[#f3f3f3] text-[#514f4d]"
            : "bg-brand-50 text-brand-900"
      )}
    >
      {status}
    </span>
  );
}
function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label>
      <span className="mb-1 block text-sm font-semibold">
        {label}
        {required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}
function Modal({
  title,
  onClose,
  footer,
  children
}: {
  title: string;
  onClose: () => void;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#d8dde6] px-5 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className={secondary} onClick={onClose}>
            Close
          </button>
        </div>
        <div className="p-5">{children}</div>
        <div className="flex justify-end gap-2 border-t border-[#d8dde6] px-5 py-3">{footer}</div>
      </div>
    </div>
  );
}
const json = apiRequest<Record<string, unknown>>;
