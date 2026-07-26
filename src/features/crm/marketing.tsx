"use client";

import Link from "next/link";
import { LIST_EMAIL_LAYOUTS } from "@/lib/crm-metadata";
import { type ScopedCrmData, type CrmObject } from "@/lib/crm-types";
import { formatDateTime } from "@/lib/utils";
import { MarketingLandingPagesPanel } from "@/components/crm/MarketingLandingPagesPanel";
import { Button, DashboardPanel, type ToastState } from "@/components/ui/crm-primitives";
import { type ScopedCrmDataUpdater } from "@/features/crm/shared-types";

export function MarketingPage({
  data,
  onCreate,
  onActivate,
  onDataChange,
  onToast
}: {
  data: ScopedCrmData;
  onCreate: (object: CrmObject) => void;
  onActivate: () => void;
  onDataChange: ScopedCrmDataUpdater;
  onToast: (toast: ToastState) => void;
}) {
  const latestActivation = data.marketingActivations[0];
  function manageLandingPages() {
    const panel = document.getElementById("marketing-landing-pages");
    if (!panel) return;
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
    panel.focus({ preventScroll: true });
  }
  const growthEngines = [
    {
      title: "Email Campaigns",
      body: "Compose, preview, save, schedule, or send list emails to leads and contacts.",
      action: "Send Email",
      onClick: () => onCreate("ListEmail")
    },
    {
      title: "Custom Landing Pages with Forms",
      body: "Create, publish, and monitor branded lead-capture forms with optional Campaign attribution.",
      action: "Manage Pages",
      onClick: manageLandingPages
    },
    {
      title: "Audience Building",
      body: "Open lead lists and build targeted recipient groups from the CRM data.",
      action: "Open Leads",
      href: "/lightning/o/Lead/list?filterName=AllOpenLeads"
    },
    {
      title: "Pre-Built Analytics",
      body: "Review campaign, pipeline, lead, and service reports from the analytics workspace.",
      action: "Open Analytics",
      href: "/lightning/page/analytics"
    }
  ];
  return (
    <section className="space-y-3">
      <div className="rounded-lg border border-[#e4e7ec] bg-white p-6 shadow-card">
        <h1 className="text-2xl font-semibold">
          {latestActivation ? "Marketing tools are active" : "Activate powerful marketing tools and boost sales"}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[#706e6b]">
          {latestActivation
            ? `Default sender: ${latestActivation.senderName ?? "Configured sender"} (${latestActivation.senderEmail ?? "email configured"}).`
            : "Accelerate lead generation with campaigns, analytics, and list email tools."}
        </p>
        {latestActivation && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded bg-[#e4f6e6] px-2 py-1 font-semibold text-[#194f25]">Active</span>
            <span className="rounded bg-[#f3f3f3] px-2 py-1 text-[#514f4d]">
              {latestActivation.tracking === false ? "Tracking disabled" : "Tracking enabled"}
            </span>
            <span className="rounded bg-[#f3f3f3] px-2 py-1 text-[#514f4d]">
              Activated{" "}
              {latestActivation.activatedAt ? formatDateTime(String(latestActivation.activatedAt)) : "recently"}
            </span>
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <Button variant="primary" onClick={onActivate}>
            {latestActivation ? "Edit Activation" : "Activate Marketing"}
          </Button>
          <Button onClick={() => onCreate("ListEmail")}>Send Email</Button>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <DashboardPanel title="Send emails with ease" action="Send Email" onAction={() => onCreate("ListEmail")}>
          <div className="space-y-3 text-sm">
            <p className="text-[#706e6b]">
              Access Sales List Emails for leads and contacts, choose a layout, then send now or schedule delivery.
            </p>
            <div className="grid gap-2">
              <div className="flex items-center justify-between border-b border-[#eef1f6] pb-2">
                <span>Layout picker</span>
                <span className="text-xs text-[#706e6b]">{LIST_EMAIL_LAYOUTS.length} templates</span>
              </div>
              <div className="flex items-center justify-between border-b border-[#eef1f6] pb-2">
                <span>Recipient targeting</span>
                <span className="text-xs text-[#706e6b]">
                  {data.leads.length + data.contacts.length} lead/contact record
                  {data.leads.length + data.contacts.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Saved emails</span>
                <span className="text-xs text-[#706e6b]">
                  {data.listEmails.length} draft/sent item{data.listEmails.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>
          </div>
        </DashboardPanel>
        <DashboardPanel title="Activate Your Growth Engines">
          <div className="divide-y divide-[#eef1f6] text-sm">
            {growthEngines.map((engine) => {
              const action = (
                <span className="shrink-0 rounded border border-[#c9c9c9] bg-white px-2 py-1 text-xs font-semibold text-brand-700">
                  {engine.action}
                </span>
              );
              const body = (
                <>
                  <span className="block font-semibold">{engine.title}</span>
                  <span className="mt-1 block text-xs text-[#706e6b]">{engine.body}</span>
                </>
              );
              const className = "flex w-full items-center justify-between gap-3 py-3 text-left hover:text-brand-700";
              if (engine.href) {
                return (
                  <Link key={engine.title} href={engine.href} className={className}>
                    <span className="min-w-0">{body}</span>
                    {action}
                  </Link>
                );
              }
              return (
                <button key={engine.title} className={className} onClick={engine.onClick}>
                  <span className="min-w-0">{body}</span>
                  {action}
                </button>
              );
            })}
          </div>
        </DashboardPanel>
      </div>
      <MarketingLandingPagesPanel data={data} onDataChange={onDataChange} onToast={onToast} />
    </section>
  );
}
