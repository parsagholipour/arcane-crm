"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import { AlertCircle, ChevronDown, ChevronsUpDown, RefreshCw, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { OBJECT_DEFINITIONS } from "@/lib/crm-metadata";
import { recordTitle } from "@/lib/crm-data";
import { type ScopedCrmData, type RecordData } from "@/lib/crm-types";
import { type AiActivityInsightPayload, type AiInsightResponse } from "@/lib/ai-types";
import { cn, formatDateTime } from "@/lib/utils";
import { toDateInputValue } from "@/lib/calendar";
import { Button, type ToastState } from "@/components/ui/crm-primitives";
import {
  activityDetail,
  activityMatchesStatus,
  activityStatusLabel,
  activityTab,
  activityWithinRange,
  groupTimelineActivities
} from "@/features/crm/activity-model";
import { checkboxClass, FieldShell, inputClass, NativeSelect } from "@/features/crm/controls";
import { apiRequest, jsonBody } from "@/lib/api/client";
import { requiredId } from "@/features/crm/record-model";
import { type TimelineActivity } from "@/features/crm/shared-types";

export function ActivityPanel({
  object,
  record,
  data,
  onSaveActivity,
  onOpenEvent,
  onToast,
  onRefreshData
}: {
  object: "Account" | "Contact";
  record: RecordData;
  data: ScopedCrmData;
  onSaveActivity: (activity: RecordData) => Promise<boolean>;
  onOpenEvent: () => void;
  onToast: (toast: ToastState) => void;
  onRefreshData: (successMessage: string) => Promise<boolean>;
}) {
  const [mode, setMode] = useState<"email" | "call" | "task">("email");
  const [emailAction, setEmailAction] = useState<"send" | "log">("send");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipient, setRecipient] = useState(String(record.email ?? ""));
  const [taskDueDate, setTaskDueDate] = useState(toDateInputValue(new Date()));
  const [taskStatus, setTaskStatus] = useState("Not Started");
  const [taskPriority, setTaskPriority] = useState("Normal");
  const [callResult, setCallResult] = useState("Connected");
  const [insightsOnly, setInsightsOnly] = useState(false);
  const [rangeFilter, setRangeFilter] = useState("Within 2 months");
  const [statusFilter, setStatusFilter] = useState("All activities");
  const [typeFilter, setTypeFilter] = useState("All types");
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [showAllActivities, setShowAllActivities] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState(new Date());
  const [activityInsight, setActivityInsight] = useState<AiInsightResponse<AiActivityInsightPayload> | null>(null);
  const [activityInsightLoading, setActivityInsightLoading] = useState(false);
  const [activityInsightError, setActivityInsightError] = useState("");
  const related = { relatedObjectType: object, relatedRecordId: record.id };
  const relatedTypes = [object, OBJECT_DEFINITIONS[object]?.plural].filter(Boolean).map(String);
  const activities: TimelineActivity[] = [
    ...data.emailActivities
      .filter((item) => item.relatedObjectType === object && item.relatedRecordId === record.id)
      .map((item) => ({ ...item, kind: "Email" as const, date: item.sentAt })),
    ...data.callActivities
      .filter((item) => item.relatedObjectType === object && item.relatedRecordId === record.id)
      .map((item) => ({ ...item, kind: "Call" as const, date: item.completedAt })),
    ...data.tasks
      .filter((item) => item.relatedObjectType === object && item.relatedRecordId === record.id)
      .map((item) => ({ ...item, kind: "Task" as const, date: item.dueDate ?? item.createdAt })),
    ...data.events
      .filter((item) => {
        const relatedMatch =
          relatedTypes.includes(String(item.relatedObjectType)) && String(item.relatedRecordId) === String(record.id);
        const nameMatch =
          object === "Contact" &&
          String(item.nameRecordId) === String(record.id) &&
          (String(item.nameObjectType) === OBJECT_DEFINITIONS[object].plural || String(item.nameObjectType) === object);
        return relatedMatch || nameMatch;
      })
      .map((item) => ({ ...item, kind: "Event" as const, date: item.startAt }))
  ].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const activitySourceKey = activities
    .map((activity) => `${requiredId(activity)}:${String(activity.date ?? "")}`)
    .join("|");
  const insightByActivityId = new Map(
    (activityInsight?.payload.insights ?? []).map((insight) => [insight.activityId, insight])
  );
  const filteredActivities = activities.filter((activity) => {
    if (insightsOnly && !insightByActivityId.has(requiredId(activity))) return false;
    if (typeFilter !== "All types" && activity.kind !== typeFilter) return false;
    if (!activityWithinRange(activity, rangeFilter)) return false;
    return activityMatchesStatus(activity, statusFilter);
  });
  const visibleActivities = showAllActivities ? filteredActivities : filteredActivities.slice(0, 4);
  const groupedVisibleActivities = groupTimelineActivities(visibleActivities);
  const filterSummary = `${rangeFilter} - ${statusFilter} - ${typeFilter}`;

  useEffect(() => {
    setRecipient(String(record.email ?? ""));
    setSubject("");
    setBody("");
    setExpandedIds([]);
    setShowAllActivities(false);
  }, [record.id, record.email]);

  useEffect(() => {
    setActivityInsight(null);
    setActivityInsightError("");
    void loadActivityInsights(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record.id, activitySourceKey]);

  async function loadActivityInsights(force: boolean) {
    setActivityInsightLoading(true);
    setActivityInsightError("");
    try {
      const payload = await apiRequest<AiInsightResponse<AiActivityInsightPayload>>("/api/ai/insights", {
        method: "POST",
        body: jsonBody({ surface: "activity", object, recordId: requiredId(record), force })
      });
      const nextInsight = payload;
      setActivityInsight(nextInsight);
      setRefreshedAt(new Date(nextInsight.generatedAt));
      if (nextInsight.warning) onToast({ tone: "warning", message: nextInsight.warning });
    } catch {
      setActivityInsightError("Activity insights are unavailable. Check your connection and retry.");
    } finally {
      setActivityInsightLoading(false);
    }
  }

  async function submit() {
    const id = `${mode}-${Date.now()}`;
    const saved =
      mode === "email"
        ? await onSaveActivity({
            id,
            type: "email",
            to: recipient,
            subject: subject || (emailAction === "send" ? "Email" : "Logged Email"),
            body,
            emailAction,
            ...related
          })
        : mode === "call"
          ? await onSaveActivity({
              id,
              type: "call",
              subject: subject || "Call",
              comments: [callResult, body].filter(Boolean).join("\n"),
              ...related
            })
          : await onSaveActivity({
              id,
              type: "task",
              subject: subject || "Task",
              dueDate: taskDueDate,
              status: taskStatus,
              priority: taskPriority,
              ...related
            });
    if (!saved) return;
    setSubject("");
    setBody("");
    if (mode === "email") setEmailAction("send");
    if (mode === "task") {
      setTaskStatus("Not Started");
      setTaskPriority("Normal");
      setTaskDueDate(toDateInputValue(new Date()));
    }
  }

  function chooseEmailAction(action: "send" | "log") {
    setMode("email");
    setEmailAction(action);
  }

  function makeFollowUpTask() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setMode("task");
    setSubject(`Follow up with ${recordTitle(object, record)}`);
    setTaskDueDate(toDateInputValue(tomorrow));
  }

  function toggleActivity(id: string) {
    setExpandedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function expandAll() {
    const nextExpanded = visibleActivities.map((activity) => requiredId(activity)).filter(Boolean);
    setExpandedIds((current) => (nextExpanded.every((id) => current.includes(id)) ? [] : nextExpanded));
  }

  async function refreshActivity() {
    if (await onRefreshData("Activity refreshed from the CRM.")) {
      setRefreshedAt(new Date());
      void loadActivityInsights(true);
    }
  }

  return (
    <aside className="rounded-lg border border-[#e4e7ec] bg-white shadow-card">
      <div className="border-b border-[#d8dde6] px-3 py-2 font-semibold">Activity</div>
      <div className="p-3">
        <div className="mb-3 grid grid-cols-4 gap-1">
          <button className={activityTab(mode === "email")} onClick={() => setMode("email")}>
            Email
          </button>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="rounded border border-[#c9c9c9] px-2 py-1 text-xs hover:bg-[#f3f3f3]">
                More Email Actions
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="z-50 rounded border border-[#d8dde6] bg-white p-1 text-sm shadow-popover">
                <DropdownMenu.Item
                  onSelect={() => chooseEmailAction("send")}
                  className="cursor-pointer rounded px-3 py-2 hover:bg-brand-50"
                >
                  Send Email
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onSelect={() => chooseEmailAction("log")}
                  className="cursor-pointer rounded px-3 py-2 hover:bg-brand-50"
                >
                  Log Email
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onSelect={() => setBody((current) => `${current}${current ? "\n\n" : ""}Regards,\n${data.user.name}`)}
                  className="cursor-pointer rounded px-3 py-2 hover:bg-brand-50"
                >
                  Insert Signature
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
          <button
            className="rounded border border-[#c9c9c9] px-2 py-1 text-xs hover:bg-[#f3f3f3]"
            onClick={onOpenEvent}
          >
            New Event
          </button>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="rounded border border-[#c9c9c9] px-2 py-1 text-xs hover:bg-[#f3f3f3]">
                More New Event Actions
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="z-50 rounded border border-[#d8dde6] bg-white p-1 text-sm shadow-popover">
                <DropdownMenu.Item
                  onSelect={onOpenEvent}
                  className="cursor-pointer rounded px-3 py-2 hover:bg-brand-50"
                >
                  New Event
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onSelect={makeFollowUpTask}
                  className="cursor-pointer rounded px-3 py-2 hover:bg-brand-50"
                >
                  Follow-Up Task
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onSelect={() => setMode("call")}
                  className="cursor-pointer rounded px-3 py-2 hover:bg-brand-50"
                >
                  Log a Call
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
        <div className="mb-2 grid grid-cols-2 gap-1">
          <button className={activityTab(mode === "call")} onClick={() => setMode("call")}>
            Log a Call
          </button>
          <button className={activityTab(mode === "task")} onClick={() => setMode("task")}>
            New Task
          </button>
        </div>
        <div className="space-y-2 rounded border border-[#d8dde6] p-2">
          {mode === "email" && (
            <input
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
              className={inputClass}
              placeholder="To"
            />
          )}
          {mode === "call" && (
            <NativeSelect
              options={["Connected", "Left Voicemail", "No Answer", "Wrong Number"]}
              value={callResult}
              onChange={setCallResult}
            />
          )}
          {mode === "task" && (
            <div className="grid gap-2 sm:grid-cols-3">
              <input
                type="date"
                value={taskDueDate}
                onChange={(event) => setTaskDueDate(event.target.value)}
                className={inputClass}
                aria-label="Task due date"
              />
              <NativeSelect
                options={["Not Started", "In Progress", "Completed", "Deferred"]}
                value={taskStatus}
                onChange={setTaskStatus}
              />
              <NativeSelect options={["Low", "Normal", "High"]} value={taskPriority} onChange={setTaskPriority} />
            </div>
          )}
          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            className={inputClass}
            placeholder={mode === "email" ? "Subject" : mode === "call" ? "Call subject" : "Task subject"}
          />
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className={cn(inputClass, "h-20")}
            placeholder={mode === "email" ? "Email body" : "Comments"}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-[#706e6b]">
              {mode === "email"
                ? emailAction === "send"
                  ? "Send and log on timeline"
                  : "Log an existing email"
                : mode === "call"
                  ? "Completed call activity"
                  : "Task will appear in Upcoming & Overdue"}
            </span>
            <Button variant="primary" onClick={submit}>
              {mode === "email" ? (emailAction === "send" ? "Send" : "Log Email") : "Save"}
            </Button>
          </div>
        </div>
      </div>
      <div className="border-t border-[#d8dde6] p-3">
        <div className="mb-2 rounded border border-[#d8dde6] bg-[#f8f8f8] p-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-[#444]">AI Activity Insights</span>
            <button
              className="rounded p-1 text-brand-700 hover:bg-white disabled:opacity-50"
              disabled={activityInsightLoading}
              aria-label="Refresh AI activity insights"
              onClick={() => void loadActivityInsights(true)}
            >
              <RefreshCw size={13} className={cn(activityInsightLoading && "animate-spin")} />
            </button>
          </div>
          {activityInsightLoading && !activityInsight && (
            <div className="mt-1 flex items-center gap-1 text-[#706e6b]" aria-live="polite">
              <RefreshCw size={12} className="animate-spin" />
              Analyzing recent activity…
            </div>
          )}
          {activityInsight && <p className="mt-1 text-[#444]">{activityInsight.payload.summary}</p>}
          {activityInsight && (
            <div className="mt-1 text-[10px] text-[#706e6b]">
              {activityInsight.stale
                ? "Stale saved insight"
                : activityInsight.cached
                  ? "Cached insight"
                  : "Fresh insight"}{" "}
              · {formatDateTime(activityInsight.generatedAt)}
            </div>
          )}
          {activityInsightError && (
            <div className="mt-1 flex items-start gap-1 text-[#8e030f]" role="alert">
              <AlertCircle size={12} className="mt-0.5 shrink-0" />
              {activityInsightError}{" "}
              <button className="font-semibold underline" onClick={() => void loadActivityInsights(false)}>
                Retry
              </button>
            </div>
          )}
        </div>
        <div className="mb-2 flex items-center gap-1 text-xs text-[#706e6b]">
          <input
            type="checkbox"
            checked={insightsOnly}
            disabled={activityInsightLoading && !activityInsight}
            onChange={(event) => setInsightsOnly(event.target.checked)}
            className={checkboxClass}
          />{" "}
          Only show activities with insights
        </div>
        <div className="mb-2 flex flex-wrap items-center gap-1 text-xs text-[#706e6b]">
          <span>{filterSummary}</span>
          <Popover.Root open={settingsOpen} onOpenChange={setSettingsOpen}>
            <Popover.Trigger asChild>
              <button className="ml-auto rounded p-1 hover:bg-[#f3f3f3]" aria-label="Timeline Settings">
                <Settings size={13} />
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                align="end"
                className="z-50 w-72 rounded border border-[#d8dde6] bg-white p-3 text-sm shadow-popover"
              >
                <div className="mb-3 font-semibold">Timeline Settings</div>
                <div className="grid gap-3">
                  <FieldShell label="Date Range">
                    <NativeSelect
                      options={["Within 7 days", "Within 2 months", "All time"]}
                      value={rangeFilter}
                      onChange={setRangeFilter}
                    />
                  </FieldShell>
                  <FieldShell label="Activity Status">
                    <NativeSelect
                      options={["All activities", "Upcoming", "Overdue", "Completed"]}
                      value={statusFilter}
                      onChange={setStatusFilter}
                    />
                  </FieldShell>
                  <FieldShell label="Activity Type">
                    <NativeSelect
                      options={["All types", "Email", "Call", "Task", "Event"]}
                      value={typeFilter}
                      onChange={setTypeFilter}
                    />
                  </FieldShell>
                  <Button onClick={() => setSettingsOpen(false)}>Done</Button>
                </div>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
          <button
            className="rounded p-1 hover:bg-[#f3f3f3]"
            aria-label="Refresh"
            onClick={() => void refreshActivity()}
          >
            <RefreshCw size={13} />
          </button>
          <button className="rounded p-1 hover:bg-[#f3f3f3]" aria-label="Expand All" onClick={expandAll}>
            <ChevronsUpDown size={13} />
          </button>
        </div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="font-semibold">Upcoming & Overdue</div>
          <div className="text-[11px] text-[#706e6b]">Updated {formatDateTime(refreshedAt.toISOString())}</div>
        </div>
        {filteredActivities.length === 0 ? (
          <div className="rounded border border-dashed border-[#d8dde6] p-4 text-sm text-[#706e6b]">
            No activities to show. Get started by sending an email, scheduling a task, and more.
          </div>
        ) : (
          <div className="space-y-3">
            {groupedVisibleActivities.map((group) => (
              <section key={group.label} className="space-y-2" aria-label={`${group.label} activities`}>
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase text-[#706e6b]">
                  <span>{group.label}</span>
                  <span className="h-px flex-1 bg-[#e4e7ec]" />
                </div>
                {group.activities.map((activity) => {
                  const id = requiredId(activity);
                  const expanded = expandedIds.includes(id);
                  const insight = insightByActivityId.get(id);
                  return (
                    <div key={id} className="rounded border border-[#d8dde6] p-2 text-sm">
                      <button
                        className="flex w-full items-start justify-between gap-2 text-left"
                        onClick={() => toggleActivity(id)}
                      >
                        <span>
                          <span className="block font-medium">
                            {activity.kind}: {String(activity.subject ?? "Activity")}
                          </span>
                          <span className="block text-xs text-[#706e6b]">
                            {formatDateTime(activity.date as string)} - {activityStatusLabel(activity)}
                          </span>
                        </span>
                        <ChevronDown
                          size={14}
                          className={cn("mt-0.5 text-[#706e6b] transition-transform", expanded && "rotate-180")}
                        />
                      </button>
                      {expanded && (
                        <div className="mt-2 rounded bg-[#f8f8f8] p-2 text-xs text-[#444]">
                          <div>{activityDetail(activity)}</div>
                          {insight && (
                            <div
                              className={cn(
                                "mt-2 rounded border-l-2 bg-white p-2",
                                insight.signal === "attention"
                                  ? "border-l-[#ba0517]"
                                  : insight.signal === "positive"
                                    ? "border-l-[#2e844a]"
                                    : "border-l-brand-500"
                              )}
                            >
                              <div className="font-semibold text-brand-700">AI Insight: {insight.summary}</div>
                              {insight.nextStep && (
                                <div className="mt-1 text-[#706e6b]">Suggested next step: {insight.nextStep}</div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </section>
            ))}
          </div>
        )}
        {filteredActivities.length > 4 && (
          <button
            className="mt-2 text-sm text-brand-700 hover:underline"
            onClick={() => setShowAllActivities((current) => !current)}
          >
            {showAllActivities ? "Show Fewer Activities" : "Show All Activities"}
          </button>
        )}
      </div>
    </aside>
  );
}
