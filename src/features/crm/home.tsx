"use client";

import { AlertCircle, RefreshCw, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { type ScopedCrmData, type RecordData } from "@/lib/crm-types";
import { type AiHomeInsight, type AiInsightResponse } from "@/lib/ai-types";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { sameDate, startOfDay } from "@/lib/calendar";
import { BaseDialog, Button, DashboardPanel, EmptyPanel, type ToastState } from "@/components/ui/crm-primitives";
import {
  buildHomeRecentRecords,
  homeReportCards,
  isClosedOpportunity,
  parseReportDate,
  sumReportAmount
} from "@/features/crm/analytics-model";
import { FieldShell, inputClass, NativeSelect } from "@/features/crm/controls";
import { resourceApi } from "@/lib/api/resources";
import { formatKanbanSummary, numberFromRecord } from "@/features/crm/list-model";
import { requiredId } from "@/features/crm/record-model";
import { reportHref } from "@/features/crm/route-model";
import { apiRequest, jsonBody } from "@/lib/api/client";
import { type ScopedCrmDataUpdater } from "@/features/crm/shared-types";

export function HomePage({
  data,
  onReportBuilder,
  onDataChange,
  onToast,
  onRefreshData
}: {
  data: ScopedCrmData;
  onReportBuilder: (reportType?: string) => void;
  onDataChange: ScopedCrmDataUpdater;
  onToast: (toast: ToastState) => void;
  onRefreshData: (successMessage: string) => Promise<boolean>;
}) {
  const preferences = data.userPreferences[0];
  const preferredMode = String(preferences?.homeMode ?? "Onboarding") === "Dashboard" ? "Dashboard" : "Onboarding";
  const [homeMode, setHomeMode] = useState<"Onboarding" | "Dashboard">(preferredMode);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<string[]>([]);
  const [allCardsOpen, setAllCardsOpen] = useState(false);
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState(new Date());
  const [taskView, setTaskView] = useState("Due Today");
  const [homeInsight, setHomeInsight] = useState<AiInsightResponse<AiHomeInsight> | null>(null);
  const [homeInsightLoading, setHomeInsightLoading] = useState(false);
  const [homeInsightError, setHomeInsightError] = useState("");
  const closedWonAmount = sumReportAmount(
    data.opportunities.filter((record) => String(record.stage ?? "") === "Closed Won"),
    "amount"
  );
  const openHighProbabilityAmount = sumReportAmount(
    data.opportunities.filter((record) => !isClosedOpportunity(record) && numberFromRecord(record.probability) >= 70),
    "amount"
  );
  const suggestedGoal = Math.max(100000, closedWonAmount + openHighProbabilityAmount);
  const [goalInput, setGoalInput] = useState(String(numberFromRecord(preferences?.quarterlyGoal) || suggestedGoal));
  const goalAmount = numberFromRecord(preferences?.quarterlyGoal) || numberFromRecord(goalInput) || suggestedGoal;
  const today = new Date();
  const todayEvents = data.events.filter((event) => {
    const startAt = parseReportDate(event.startAt);
    return startAt ? sameDate(startAt, today) : false;
  });
  const todayTasks = data.tasks.filter((task) => {
    const dueDate = parseReportDate(task.dueDate);
    const status = String(task.status ?? "");
    if (status === "Completed") return false;
    if (taskView === "All Open") return true;
    if (taskView === "Overdue") return Boolean(dueDate && dueDate < startOfDay(today));
    return !dueDate || sameDate(dueDate, today);
  });
  const recentRecords = buildHomeRecentRecords(data);
  const keyDeals = data.opportunities.filter((record) => !isClosedOpportunity(record)).slice(0, 3);
  const suggestionCards = [
    {
      id: "lead",
      title: "Create your first lead",
      body: "Convert leads into contacts, accounts, and opportunities.",
      href: "/lightning/o/Lead/new"
    },
    {
      id: "marketing",
      title: "Turn on marketing features",
      body: "Access tools to reach audiences and engage customers.",
      href: "/lightning/app/marketing",
      newTab: true
    },
    {
      id: "deal",
      title: "Create your first deal",
      body: "Add an opportunity and track stages as deals move forward.",
      href: "/lightning/o/Opportunity/new"
    },
    {
      id: "calendar",
      title: "Schedule today",
      body: "Create an event and keep your activity timeline current.",
      href: "/lightning/o/Event/home"
    },
    {
      id: "reports",
      title: "Review analytics",
      body: "Open reports for pipeline, service, contacts, and lead generation.",
      href: "/lightning/page/analytics"
    }
  ];
  const visibleSuggestions = suggestionCards.filter((card) => !dismissedSuggestions.includes(card.id));
  useEffect(() => {
    setHomeMode(preferredMode);
    setGoalInput(String(numberFromRecord(preferences?.quarterlyGoal) || suggestedGoal));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferences?.id, preferences?.homeMode, preferences?.quarterlyGoal]);

  useEffect(() => {
    if (homeMode !== "Dashboard" || homeInsight || homeInsightLoading) return;
    void loadHomeInsight(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeMode]);

  async function loadHomeInsight(force: boolean) {
    setHomeInsightLoading(true);
    setHomeInsightError("");
    try {
      const payload = await apiRequest<AiInsightResponse<AiHomeInsight>>("/api/ai/insights", {
        method: "POST",
        body: jsonBody({ surface: "home", force })
      });
      setHomeInsight(payload);
      if (payload.warning) onToast({ tone: "warning", message: String(payload.warning) });
    } catch {
      setHomeInsightError("Home AI insights are unavailable. Check your connection and retry.");
    } finally {
      setHomeInsightLoading(false);
    }
  }

  async function saveHomePreferences(values: RecordData) {
    const response = await resourceApi.updatePreferences(values);
    const nextPreferences = response?.preferences as RecordData | undefined;
    if (!nextPreferences?.id) {
      onToast({ tone: "error", message: "Home preferences couldn't be saved." });
      return false;
    }
    onDataChange((previous) => ({
      ...previous,
      userPreferences: [
        nextPreferences,
        ...previous.userPreferences.filter(
          (item) => item.id !== nextPreferences.id && item.userId !== nextPreferences.userId
        )
      ]
    }));
    return true;
  }

  async function switchHomeMode(mode: "Onboarding" | "Dashboard") {
    setHomeMode(mode);
    const saved = await saveHomePreferences({ homeMode: mode });
    if (saved)
      onToast({
        tone: "success",
        message: mode === "Dashboard" ? "Dashboard is now your Home." : "Onboarding cards are now your Home."
      });
  }

  async function saveGoal() {
    const value = Math.max(0, Math.round(numberFromRecord(goalInput)));
    const saved = await saveHomePreferences({ quarterlyGoal: value });
    if (saved) {
      setGoalDialogOpen(false);
      onToast({ tone: "success", message: "Quarterly goal saved." });
    }
  }

  async function refreshDashboard() {
    if (await onRefreshData("Home dashboard refreshed from the CRM.")) setRefreshedAt(new Date());
  }

  if (homeMode === "Dashboard") {
    return (
      <div className="grid gap-3 lg:grid-cols-3">
        <DashboardPanel title="Quarterly Performance">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-[#706e6b]">As of {formatDateTime(refreshedAt.toISOString())}</div>
            <div className="flex gap-1">
              <Button onClick={() => void refreshDashboard()}>
                <RefreshCw size={13} /> Refresh Chart
              </Button>
              <Button onClick={() => setGoalDialogOpen(true)}>Edit Goal</Button>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              ["Closed", formatKanbanSummary(closedWonAmount)],
              ["Open (>70%)", formatKanbanSummary(openHighProbabilityAmount)],
              ["Goal", formatKanbanSummary(goalAmount)]
            ].map(([metric, value]) => (
              <div key={metric} className="rounded border border-[#d8dde6] p-3">
                <div className="text-xs text-[#706e6b]">{metric}</div>
                <div className="text-lg font-semibold">{value}</div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-[#706e6b]">
            {data.opportunities.length === 0
              ? "Add opportunities and return to view performance."
              : `${data.opportunities.length} opportunit${data.opportunities.length === 1 ? "y" : "ies"} included in performance.`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/lightning/o/Opportunity/list"
              className="inline-flex min-h-8 items-center justify-center gap-1 rounded border border-[#c9c9c9] bg-white px-3 py-1 text-xs font-semibold text-brand-700 transition-colors hover:bg-[#f3f3f3]"
            >
              Open Opportunities
            </Link>
            <Link
              href={reportHref("Pipeline by Stage")}
              className="inline-flex min-h-8 items-center justify-center gap-1 rounded border border-[#c9c9c9] bg-white px-3 py-1 text-xs font-semibold text-brand-700 transition-colors hover:bg-[#f3f3f3]"
            >
              View Report
            </Link>
          </div>
        </DashboardPanel>
        <DashboardPanel title="Today's Events" action="View Calendar" actionHref="/lightning/o/Event/home">
          {todayEvents.length === 0 ? (
            <p className="text-sm text-[#706e6b]">You&apos;re free and clear for the day.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {todayEvents.slice(0, 4).map((event) => (
                <li key={requiredId(event)} className="rounded border border-[#d8dde6] p-2">
                  <div className="font-medium">{String(event.subject ?? "Event")}</div>
                  <div className="text-xs text-[#706e6b]">{formatDateTime(String(event.startAt))}</div>
                </li>
              ))}
            </ul>
          )}
        </DashboardPanel>
        <DashboardPanel title="Recent Records" action="View All" actionHref="/lightning/page/analytics">
          <ul className="space-y-2 text-sm">
            {recentRecords.map((item) => (
              <li key={item.id}>
                <Link href={item.href} className="text-brand-700 hover:underline">
                  {item.label}
                </Link>
                <span className="text-[#706e6b]"> - {item.context}</span>
              </li>
            ))}
          </ul>
        </DashboardPanel>
        <DashboardPanel title="Today's Tasks">
          <div className="mb-3 max-w-xs">
            <NativeSelect options={["Due Today", "Overdue", "All Open"]} value={taskView} onChange={setTaskView} />
          </div>
          {todayTasks.length === 0 ? (
            <p className="text-sm text-[#706e6b]">Nothing due today.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {todayTasks.slice(0, 4).map((task) => (
                <li key={requiredId(task)} className="rounded border border-[#d8dde6] p-2">
                  <div className="font-medium">{String(task.subject ?? "Task")}</div>
                  <div className="text-xs text-[#706e6b]">
                    {task.dueDate ? formatDate(String(task.dueDate)) : "No due date"} -{" "}
                    {String(task.priority ?? "Normal")}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <button className="mt-3 text-sm text-brand-700 hover:underline" onClick={() => setTaskView("All Open")}>
            View All
          </button>
        </DashboardPanel>
        <DashboardPanel
          title="Key Deals - Recent Opportunities"
          action="View Deals"
          actionHref="/lightning/o/Opportunity/list"
        >
          {keyDeals.length === 0 ? (
            <p className="text-sm text-[#706e6b]">No deals match this view.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {keyDeals.map((deal) => (
                <li key={requiredId(deal)} className="rounded border border-[#d8dde6] p-2">
                  <div className="font-medium">{String(deal.name ?? "Opportunity")}</div>
                  <div className="text-xs text-[#706e6b]">
                    {String(deal.stage ?? "Stage")} - {formatKanbanSummary(numberFromRecord(deal.amount))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DashboardPanel>
        <DashboardPanel title="Assistant">
          {homeInsightLoading && (
            <div className="flex items-center gap-2 text-sm text-[#706e6b]" aria-live="polite">
              <RefreshCw size={14} className="animate-spin" /> Analyzing your CRM workspace…
            </div>
          )}
          {!homeInsightLoading && homeInsightError && (
            <div className="space-y-2">
              <div
                className="flex items-start gap-1 rounded border border-[#ea001e] bg-[#fff1f1] p-2 text-xs text-[#8e030f]"
                role="alert"
              >
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                {homeInsightError}
              </div>
              <Button onClick={() => void loadHomeInsight(false)}>Retry</Button>
            </div>
          )}
          {!homeInsightLoading && homeInsight && (
            <div className="space-y-3">
              <p className="text-sm text-[#444]">{homeInsight.payload.summary}</p>
              {homeInsight.payload.facts.length > 0 && (
                <div className="grid grid-cols-2 gap-1">
                  {homeInsight.payload.facts.map((fact) => (
                    <div key={fact.id} className="rounded border border-[#d8dde6] p-2">
                      <div className="text-[10px] uppercase text-[#706e6b]">{fact.label}</div>
                      <div className="font-semibold">{fact.value}</div>
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-2">
                {homeInsight.payload.recommendations.map((item, index) => (
                  <div key={`${item.title}-${index}`} className="rounded border border-[#d8dde6] p-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{item.title}</span>
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] uppercase",
                          item.priority === "high"
                            ? "bg-[#fff1f1] text-[#ba0517]"
                            : item.priority === "medium"
                              ? "bg-[#fff7e5] text-[#8a4b00]"
                              : "bg-[#eef4ff] text-brand-700"
                        )}
                      >
                        {item.priority}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#706e6b]">{item.rationale}</p>
                    {item.action && (
                      <Link
                        href={item.action.href}
                        className="mt-2 inline-block text-xs font-semibold text-brand-700 hover:underline"
                      >
                        {item.action.label}
                      </Link>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-[#e4e7ec] pt-2 text-[10px] text-[#706e6b]">
                <span>
                  {homeInsight.stale ? "Stale saved insight" : homeInsight.cached ? "Cached insight" : "Fresh insight"}{" "}
                  · {formatDateTime(homeInsight.generatedAt)}
                </span>
                <Button onClick={() => void loadHomeInsight(true)}>Refresh AI</Button>
              </div>
            </div>
          )}
        </DashboardPanel>
        <DashboardPanel title="Home Settings">
          <p className="mb-3 text-sm text-[#706e6b]">
            Dashboard is your default Home page. You can switch back to onboarding cards any time.
          </p>
          <Button onClick={() => void switchHomeMode("Onboarding")}>Show Onboarding Home</Button>
        </DashboardPanel>
        {goalDialogOpen && (
          <BaseDialog
            open
            title="Edit Quarterly Goal"
            onClose={() => setGoalDialogOpen(false)}
            footer={
              <>
                <Button onClick={() => setGoalDialogOpen(false)}>Cancel</Button>
                <Button variant="primary" onClick={() => saveGoal()}>
                  Save Goal
                </Button>
              </>
            }
          >
            <FieldShell label="Quarterly Goal">
              <input
                className={inputClass}
                type="number"
                min={0}
                value={goalInput}
                onChange={(event) => setGoalInput(event.target.value)}
              />
            </FieldShell>
          </BaseDialog>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-[#e4e7ec] bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold">Welcome, {data.user.name.split(/\s+/)[0] || data.user.name}</h1>
            <p className="text-sm text-[#706e6b]">Check out these suggestions to kick off your day.</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => void switchHomeMode("Dashboard")}>Hide suggestions</Button>
            <Button onClick={() => setAllCardsOpen(true)}>View All Cards</Button>
          </div>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {visibleSuggestions.slice(0, 3).map((card) => (
          <div key={card.id} className="rounded-lg border border-[#e4e7ec] bg-white p-4 shadow-card">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-semibold">{card.title}</h2>
              <button
                className="rounded p-1 hover:bg-[#f3f3f3]"
                aria-label="Dismiss this suggestion"
                onClick={() => setDismissedSuggestions((current) => [...current, card.id])}
              >
                <X size={14} />
              </button>
            </div>
            <p className="mt-2 text-sm text-[#706e6b]">{card.body}</p>
            <Link
              href={card.href}
              target={card.newTab ? "_blank" : undefined}
              className="mt-3 inline-flex text-sm font-semibold text-brand-700 hover:underline"
            >
              Open
            </Link>
          </div>
        ))}
        {visibleSuggestions.length === 0 && (
          <EmptyPanel
            title="All suggestions hidden"
            body="You can still view every onboarding card from View All Cards."
            action="View All Cards"
            onAction={() => setAllCardsOpen(true)}
          />
        )}
      </div>
      <div className="grid gap-3 lg:grid-cols-4">
        {homeReportCards.map((item) => (
          <DashboardPanel key={item.objectLabel} title={`${item.objectLabel} report`}>
            <NativeSelect
              className="mb-3"
              options={[item.reportTitle]}
              value={item.reportTitle}
              onChange={() => undefined}
            />
            <div className="flex justify-between">
              <Button onClick={() => onReportBuilder(item.objectLabel)}>New</Button>
              <Link
                href={reportHref(item.reportTitle)}
                className="inline-flex min-h-8 items-center justify-center gap-1 rounded border border-[#c9c9c9] bg-white px-3 py-1 text-xs font-semibold text-brand-700 transition-colors hover:bg-[#f3f3f3]"
              >
                View Report
              </Link>
            </div>
          </DashboardPanel>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <DashboardPanel title="Recent Records" action="View All" actionHref="/lightning/page/analytics">
          <ul className="space-y-2 text-sm">
            {recentRecords.slice(0, 5).map((item) => (
              <li key={item.id}>
                <Link href={item.href} className="text-brand-700 hover:underline">
                  {item.label}
                </Link>
                <span className="text-[#706e6b]"> - {item.context}</span>
              </li>
            ))}
          </ul>
        </DashboardPanel>
        <DashboardPanel title="Make It Your Home">
          <p className="mb-3 text-sm text-[#706e6b]">
            Use this onboarding workspace as your default Home page, or switch to the dashboard view once setup is
            complete.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => void switchHomeMode("Onboarding")}>
              Make It Your Home
            </Button>
            <Button onClick={() => void switchHomeMode("Dashboard")}>Use Dashboard Home</Button>
          </div>
        </DashboardPanel>
      </div>
      {allCardsOpen && (
        <BaseDialog
          open
          title="All Suggested Cards"
          onClose={() => setAllCardsOpen(false)}
          wide
          footer={<Button onClick={() => setAllCardsOpen(false)}>Done</Button>}
        >
          <div className="grid gap-3 md:grid-cols-2">
            {suggestionCards.map((card) => (
              <div key={card.id} className="rounded border border-[#d8dde6] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">{card.title}</div>
                    <p className="mt-1 text-sm text-[#706e6b]">{card.body}</p>
                  </div>
                  <button
                    className="rounded p-1 hover:bg-[#f3f3f3]"
                    aria-label="Dismiss this suggestion"
                    onClick={() => setDismissedSuggestions((current) => Array.from(new Set([...current, card.id])))}
                  >
                    <X size={14} />
                  </button>
                </div>
                <Link
                  href={card.href}
                  target={card.newTab ? "_blank" : undefined}
                  className="mt-3 inline-flex text-sm font-semibold text-brand-700 hover:underline"
                >
                  Open
                </Link>
              </div>
            ))}
          </div>
        </BaseDialog>
      )}
    </div>
  );
}
