"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import { CalendarClock, CheckSquare, ChevronLeft, ChevronRight, Download, Edit3, Eye, MoreHorizontal, Plus, RefreshCw, Repeat, Search, Trash2, Video } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

import { AsyncButton } from "@/components/crm/AsyncButton";
import {
  MINUTES_PER_DAY,
  SNAP_MINUTES,
  addCalendarDays,
  addCalendarMonths,
  allDayItemsForDay,
  calendarTimeRange,
  fullDateLabel,
  getMonthDays,
  layoutDayItems,
  minutesToTimeText,
  minutesFromMidnight,
  monthDayYearLabel,
  monthYearLabel,
  nextTimeSlot,
  sameMonth,
  shortDayLabel,
  snapMinutes,
  startOfWeek,
  toDateInputValue,
  weekdayHeaderLabels,
  zonedTimeToUtc,
  type CalendarItem
} from "@/lib/calendar";
import { DEFAULT_CALENDAR_COLOR, expandEventsToItems, taskToItem, videoCallToItem } from "@/lib/calendar-items";
import { formatReminderOffset } from "@/lib/calendar-reminder-values";
import { describeRecurrence } from "@/lib/calendar-recurrence";
import { cn } from "@/lib/utils";
import type { BootstrapData, RecordData } from "@/lib/crm-types";

type Toast = { tone: "success" | "error" | "warning"; message: string };
type ViewMode = "Day" | "Week" | "Month" | "Agenda";
type CalendarSourceDialogState = { type: "new" } | { type: "edit"; source: RecordData } | null;
type ScopePrompt = { item: CalendarItem; action: "move"; startAt: Date; endAt: Date } | { item: CalendarItem; action: "delete" } | null;

const input = "min-h-9 w-full rounded border border-[#c9c9c9] bg-white px-3 py-2 text-sm outline-none focus:border-[#0176d3] focus:ring-2 focus:ring-[#0176d3]/20 disabled:bg-[#f3f3f3]";
const secondary = "inline-flex min-h-8 items-center justify-center gap-1 rounded border border-[#c9c9c9] bg-white px-3 py-1 text-xs font-semibold text-brand-700 hover:bg-[#f3f3f3] disabled:opacity-50";
const primary = "inline-flex min-h-8 items-center justify-center gap-1 rounded border border-brand-700 bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50";
const checkbox = "h-4 w-4 shrink-0 rounded border border-[#c9c9c9] accent-brand-600";

const VIEW_MODES: ViewMode[] = ["Day", "Week", "Month", "Agenda"];
const HOUR_HEIGHT = 48;
const DAY_COLUMN_HEIGHT = HOUR_HEIGHT * 24;
const AGENDA_HORIZON_DAYS = 30;
const CALENDAR_SOURCE_COLORS = [
  { label: "Indigo", value: "#4f46e5" },
  { label: "Green", value: "#2e844a" },
  { label: "Red", value: "#ba0517" },
  { label: "Gold", value: "#f3b451" },
  { label: "Gray", value: "#706e6b" }
];
const SHOW_TIME_AS_FILTERS = ["All", "Busy", "Free", "Tentative", "Out of Office"];

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function recordId(record: RecordData) {
  return text(record.id);
}

function calendarSourceType(source: RecordData) {
  return text(source.type ?? "My") === "Other" ? "Other" : "My";
}

async function json(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(text((payload as RecordData).error) || "The request failed.");
  return payload as RecordData;
}

async function postUtility(action: string, id?: string, values?: RecordData) {
  return json("/api/utilities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, id, values }) });
}

export type CalendarWorkspaceProps = {
  data: BootstrapData;
  onCreate: (startDate: string, startTime: string, endTime: string, allDay?: boolean) => void;
  onEditEvent: (record: RecordData, occurrence: { occurrenceStart: string | null; recurring: boolean }) => void;
  onOpenVideoCall: (record: RecordData) => void;
  onDataChange: (updater: (previous: BootstrapData) => BootstrapData) => void;
  onToast: (toast: Toast) => void;
  onRefreshData: (successMessage: string) => Promise<boolean>;
  onNavigate: (href: string) => void;
};

export function CalendarWorkspace({ data, onCreate, onEditEvent, onOpenVideoCall, onDataChange, onToast, onRefreshData, onNavigate }: CalendarWorkspaceProps) {
  const timeZone = text(data.userPreferences[0]?.timezone) || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const weekStartsOn = Number(data.userPreferences[0]?.weekStartsOn ?? 0) % 7;

  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("Week");
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [miniMonth, setMiniMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12));
  const [calendarDialog, setCalendarDialog] = useState<CalendarSourceDialogState>(null);
  const [refreshedAt, setRefreshedAt] = useState(() => new Date());
  const [now, setNow] = useState(() => new Date());

  const [searchText, setSearchText] = useState("");
  const [showTimeAsFilter, setShowTimeAsFilter] = useState("All");
  const [assignedToFilter, setAssignedToFilter] = useState("All");
  const [showTasks, setShowTasks] = useState(true);
  const [showVideoCalls, setShowVideoCalls] = useState(true);

  const [fetchedItems, setFetchedItems] = useState<CalendarItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [scopePrompt, setScopePrompt] = useState<ScopePrompt>(null);
  const [optimistic, setOptimistic] = useState<Record<string, { startAt: string; endAt: string }>>({});

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const didScrollRef = useRef(false);
  const defaultSourceRef = useRef(false);
  const calendarDataRef = useRef({ events: data.events, tasks: data.tasks, videoCalls: data.videoCalls });

  // ---------------------------------------------------------------- window

  const visibleDays = useMemo(() => {
    if (viewMode === "Day") return [anchorDate];
    if (viewMode === "Week") {
      const start = startOfWeek(anchorDate, weekStartsOn);
      return Array.from({ length: 7 }, (_, index) => addCalendarDays(start, index));
    }
    if (viewMode === "Agenda") return Array.from({ length: AGENDA_HORIZON_DAYS }, (_, index) => addCalendarDays(anchorDate, index));
    return getMonthDays(anchorDate, weekStartsOn);
  }, [anchorDate, viewMode, weekStartsOn]);

  const range = useMemo(() => {
    const first = visibleDays[0];
    const last = visibleDays[visibleDays.length - 1];
    return {
      start: zonedTimeToUtc(toDateInputValue(first), "00:00", timeZone),
      end: zonedTimeToUtc(toDateInputValue(addCalendarDays(last, 1)), "00:00", timeZone)
    };
  }, [visibleDays, timeZone]);

  const windowKey = `${range.start.toISOString()}|${range.end.toISOString()}|${showTasks}|${showVideoCalls}`;

  // ------------------------------------------------------------ lookup maps

  const usersById = useMemo(() => new Map(data.users.map((user) => [user.id, user])), [data.users]);
  const contactsById = useMemo(() => new Map(data.contacts.map((record) => [recordId(record), record])), [data.contacts]);
  const leadsById = useMemo(() => new Map(data.leads.map((record) => [recordId(record), record])), [data.leads]);
  const accountsById = useMemo(() => new Map(data.accounts.map((record) => [recordId(record), record])), [data.accounts]);
  const opportunitiesById = useMemo(() => new Map(data.opportunities.map((record) => [recordId(record), record])), [data.opportunities]);
  const casesById = useMemo(() => new Map(data.cases.map((record) => [recordId(record), record])), [data.cases]);

  const personName = useCallback(
    (id: string) => {
      const user = usersById.get(id);
      if (user) return user.name;
      const contact = contactsById.get(id) ?? leadsById.get(id);
      if (contact) return [contact.firstName, contact.lastName].filter(Boolean).join(" ") || text(contact.name);
      return "";
    },
    [usersById, contactsById, leadsById]
  );

  const relatedName = useCallback(
    (objectType: unknown, id: unknown) => {
      const key = text(id);
      if (!key) return "";
      switch (text(objectType)) {
        case "Contacts":
          return personName(key);
        case "Leads":
          return personName(key);
        case "Accounts":
          return text(accountsById.get(key)?.name);
        case "Opportunities":
          return text(opportunitiesById.get(key)?.name);
        case "Cases":
          return text(casesById.get(key)?.caseNumber ?? casesById.get(key)?.subject);
        default:
          return "";
      }
    },
    [personName, accountsById, opportunitiesById, casesById]
  );

  // ------------------------------------------------------- calendar sources

  const calendarSources = data.calendarSources;
  const myCalendarSources = calendarSources.filter((source) => calendarSourceType(source) === "My");
  const otherCalendarSources = calendarSources.filter((source) => calendarSourceType(source) === "Other");
  const sourcesById = useMemo(() => new Map(calendarSources.map((source) => [recordId(source), source])), [calendarSources]);

  const colorForSource = useCallback(
    (calendarSourceId: string | null) => text(sourcesById.get(text(calendarSourceId))?.color) || DEFAULT_CALENDAR_COLOR,
    [sourcesById]
  );

  // Events with no calendar assigned follow the visibility of the user's "My" calendars.
  const unassignedVisible = myCalendarSources.length === 0 || myCalendarSources.some((source) => source.visible !== false);
  const sourceVisible = useCallback(
    (calendarSourceId: unknown) => {
      const source = sourcesById.get(text(calendarSourceId));
      return source ? source.visible !== false : unassignedVisible;
    },
    [sourcesById, unassignedVisible]
  );

  /** Give a brand-new organization one real calendar row instead of a synthetic placeholder. */
  useEffect(() => {
    if (calendarSources.length > 0 || defaultSourceRef.current) return;
    defaultSourceRef.current = true;
    void (async () => {
      try {
        const response = await postUtility("createCalendarSource", undefined, { name: data.user.name, type: "My", color: DEFAULT_CALENDAR_COLOR, visible: true });
        const created = Array.isArray(response.calendarSources) ? (response.calendarSources as RecordData[]) : response.calendarSource ? [response.calendarSource as RecordData] : [];
        if (created.length > 0) onDataChange((previous) => ({ ...previous, calendarSources: created }));
      } catch {
        // A missing default calendar is not worth interrupting the user for.
      }
    })();
  }, [calendarSources.length, data.user.name, onDataChange]);

  // ------------------------------------------------------------ items

  /** Rendered immediately from the bootstrap payload so the grid is never blank while fetching. */
  const seededItems = useMemo(() => {
    const events = expandEventsToItems(
      data.events
        .filter((record) => record.startAt && record.endAt)
        .map((record) => ({
          id: recordId(record),
          subject: text(record.subject) || "Event",
          startAt: text(record.startAt),
          endAt: text(record.endAt),
          allDay: Boolean(record.allDay),
          calendarSourceId: record.calendarSourceId ? text(record.calendarSourceId) : null,
          recurrenceRule: record.recurrenceRule ? text(record.recurrenceRule) : null,
          recurrenceEndAt: record.recurrenceEndAt ? text(record.recurrenceEndAt) : null,
          recurrenceParentId: record.recurrenceParentId ? text(record.recurrenceParentId) : null,
          recurrenceOriginalStart: record.recurrenceOriginalStart ? text(record.recurrenceOriginalStart) : null,
          recurrenceExceptionDates: Array.isArray(record.recurrenceExceptionDates) ? record.recurrenceExceptionDates.map(text) : [],
          source: record
        })),
      range.start,
      range.end,
      timeZone,
      { colorForSource, toRecord: (event) => event.source }
    );
    return events;
  }, [data.events, range.start, range.end, timeZone, colorForSource]);

  const overlayItems = useMemo(() => {
    const items: CalendarItem[] = [];
    if (showTasks) for (const task of data.tasks) { const item = taskToItem(task); if (item) items.push(item); }
    if (showVideoCalls) for (const call of data.videoCalls) { const item = videoCallToItem(call); if (item) items.push(item); }
    return items.filter((item) => new Date(item.endAt) >= range.start && new Date(item.startAt) <= range.end);
  }, [data.tasks, data.videoCalls, showTasks, showVideoCalls, range.start, range.end]);

  const items = useMemo(() => {
    const baseItems = fetchedItems ?? [...seededItems, ...overlayItems];
    const assignedUser = assignedToFilter === "All" ? null : assignedToFilter;
    const query = searchText.trim().toLowerCase();

    return baseItems
      .map((item) => {
        const override = optimistic[item.occurrenceKey];
        return override ? { ...item, startAt: override.startAt, endAt: override.endAt } : item;
      })
      .filter((item) => {
        if (item.kind === "task" && !showTasks) return false;
        if (item.kind === "videoCall" && !showVideoCalls) return false;
        if (item.kind === "event") {
          if (!sourceVisible(item.record.calendarSourceId)) return false;
          if (showTimeAsFilter !== "All" && text(item.record.showTimeAs) !== showTimeAsFilter) return false;
          if (assignedUser && text(item.record.assignedToId) !== assignedUser) return false;
        } else if (assignedUser || showTimeAsFilter !== "All") {
          // Event-only filters hide the overlays rather than silently ignoring the filter.
          return false;
        }
        if (!query) return true;
        const attendees = (Array.isArray(item.record.attendeeIds) ? item.record.attendeeIds.map((id) => personName(text(id))) : []).join(" ");
        const haystack = [
          item.title,
          text(item.record.location),
          text(item.record.description),
          attendees,
          relatedName(item.record.nameObjectType, item.record.nameRecordId),
          relatedName(item.record.relatedObjectType, item.record.relatedRecordId)
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      });
  }, [fetchedItems, seededItems, overlayItems, optimistic, showTasks, showVideoCalls, sourceVisible, showTimeAsFilter, assignedToFilter, searchText, personName, relatedName]);

  // ------------------------------------------------------------- fetching

  const loadWindow = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        start: range.start.toISOString(),
        end: range.end.toISOString(),
        includeTasks: String(showTasks),
        includeVideoCalls: String(showVideoCalls)
      });
      const payload = await json(`/api/calendar/events?${params.toString()}`);
      setFetchedItems(Array.isArray(payload.items) ? (payload.items as CalendarItem[]) : []);
      setOptimistic({});
      setRefreshedAt(new Date());
    } catch (error) {
      onToast({ tone: "error", message: error instanceof Error ? error.message : "Unable to load calendar events." });
    } finally {
      setLoading(false);
    }
  }, [range.start, range.end, showTasks, showVideoCalls, onToast]);

  useEffect(() => {
    let cancelled = false;
    setFetchedItems(null);
    void (async () => {
      await loadWindow();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
    // windowKey collapses the window and overlay toggles into one dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowKey]);

  // Record editors update the bootstrap payload outside this workspace. Refresh
  // the active window so its fetched cache cannot mask the newly saved values.
  useEffect(() => {
    const previous = calendarDataRef.current;
    if (previous.events === data.events && previous.tasks === data.tasks && previous.videoCalls === data.videoCalls) return;
    calendarDataRef.current = { events: data.events, tasks: data.tasks, videoCalls: data.videoCalls };
    void loadWindow();
  }, [data.events, data.tasks, data.videoCalls, loadWindow]);

  /** Keep the open calendar synchronized while the server scheduler handles reliable delivery. */
  useEffect(() => {
    let active = true;
    async function sweep() {
      try {
        const payload = await json("/api/calendar/reminders", { method: "POST" });
        const notifications = Array.isArray(payload.notifications) ? (payload.notifications as RecordData[]) : [];
        if (!active || notifications.length === 0) return;
        const incoming = new Set(notifications.map((notification) => recordId(notification)));
        onDataChange((previous) => ({ ...previous, notifications: [...notifications, ...previous.notifications.filter((item) => !incoming.has(recordId(item)))] }));
      } catch {
        // A failed sweep retries on the next tick.
      }
    }
    void sweep();
    const timer = setInterval(sweep, 60_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [onDataChange]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  /** Open on the working day rather than at midnight. */
  useEffect(() => {
    if (didScrollRef.current || !scrollRef.current || viewMode === "Month" || viewMode === "Agenda") return;
    didScrollRef.current = true;
    const target = Math.max(0, (minutesFromMidnight(new Date(), timeZone) / MINUTES_PER_DAY) * DAY_COLUMN_HEIGHT - HOUR_HEIGHT);
    scrollRef.current.scrollTop = target;
  }, [viewMode, timeZone]);

  // ------------------------------------------------------------ navigation

  function movePrevious() {
    setAnchorDate((date) =>
      viewMode === "Month" ? addCalendarMonths(date, -1) : addCalendarDays(date, viewMode === "Day" ? -1 : viewMode === "Agenda" ? -AGENDA_HORIZON_DAYS : -7)
    );
  }

  function moveNext() {
    setAnchorDate((date) =>
      viewMode === "Month" ? addCalendarMonths(date, 1) : addCalendarDays(date, viewMode === "Day" ? 1 : viewMode === "Agenda" ? AGENDA_HORIZON_DAYS : 7)
    );
  }

  const rangeLabel =
    viewMode === "Month"
      ? monthYearLabel(anchorDate)
      : viewMode === "Day"
        ? fullDateLabel(anchorDate)
        : `${monthDayYearLabel(visibleDays[0])} – ${monthDayYearLabel(visibleDays[visibleDays.length - 1])}`;

  // ------------------------------------------------------------- mutations

  async function persistTimes(item: CalendarItem, startAt: Date, endAt: Date, scope: "single" | "all") {
    const key = item.occurrenceKey;
    setOptimistic((previous) => ({ ...previous, [key]: { startAt: startAt.toISOString(), endAt: endAt.toISOString() } }));
    try {
      await json(`/api/records/Event/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startAt: startAt.toISOString(), endAt: endAt.toISOString(), recurrenceScope: scope, occurrenceStart: item.occurrenceStart })
      });
      onToast({ tone: "success", message: "Event rescheduled." });
      await loadWindow();
    } catch (error) {
      setOptimistic((previous) => {
        const next = { ...previous };
        delete next[key];
        return next;
      });
      onToast({ tone: "error", message: error instanceof Error ? error.message : "Unable to reschedule the event." });
    }
  }

  async function deleteItem(item: CalendarItem, scope: "single" | "all") {
    try {
      const params = new URLSearchParams({ scope });
      if (item.occurrenceStart) params.set("occurrenceStart", item.occurrenceStart);
      await json(`/api/records/Event/${item.id}?${params.toString()}`, { method: "DELETE" });
      setSelectedKey(null);
      onToast({ tone: "success", message: scope === "single" ? "Occurrence removed." : "Event deleted." });
      onDataChange((previous) => ({ ...previous, events: previous.events.filter((record) => recordId(record) !== item.id || scope === "single") }));
      await loadWindow();
    } catch (error) {
      onToast({ tone: "error", message: error instanceof Error ? error.message : "Unable to delete the event." });
    }
  }

  function requestMove(item: CalendarItem, startAt: Date, endAt: Date) {
    if (item.recurring) setScopePrompt({ item, action: "move", startAt, endAt });
    else void persistTimes(item, startAt, endAt, "all");
  }

  function requestDelete(item: CalendarItem) {
    if (item.recurring) {
      setScopePrompt({ item, action: "delete" });
      return;
    }
    if (!globalThis.confirm(`Delete "${item.title}"?`)) return;
    void deleteItem(item, "all");
  }

  function openItem(item: CalendarItem) {
    if (item.kind === "videoCall") {
      onOpenVideoCall(item.record);
      return;
    }
    if (item.kind === "task") {
      const href = item.record.relatedObjectType && item.record.relatedRecordId ? `/lightning/r/${text(item.record.relatedObjectType)}/${text(item.record.relatedRecordId)}/view` : null;
      if (href) onNavigate(href);
      return;
    }
    onEditEvent(item.record, { occurrenceStart: item.occurrenceStart ?? null, recurring: item.recurring });
  }

  async function saveCalendarSource(values: RecordData, source?: RecordData) {
    const name = text(values.name).trim();
    if (!name) {
      onToast({ tone: "error", message: "Calendar name is required." });
      return;
    }
    const payload: RecordData = { name, type: calendarSourceType(values), color: text(values.color) || DEFAULT_CALENDAR_COLOR, visible: values.visible !== false };
    try {
      const response = await postUtility(source ? "updateCalendarSource" : "createCalendarSource", source ? recordId(source) : undefined, payload);
      const sources = Array.isArray(response.calendarSources) ? (response.calendarSources as RecordData[]) : null;
      onDataChange((previous) => ({
        ...previous,
        calendarSources:
          sources ??
          (source
            ? previous.calendarSources.map((item) => (recordId(item) === recordId(source) ? { ...item, ...payload } : item))
            : [...previous.calendarSources, { ...payload, id: text(response.calendarSource && (response.calendarSource as RecordData).id) }])
      }));
      setCalendarDialog(null);
      onToast({ tone: "success", message: source ? "Calendar updated." : "Calendar added." });
    } catch (error) {
      onToast({ tone: "error", message: error instanceof Error ? error.message : "Unable to save calendar." });
    }
  }

  async function setSourceVisibility(source: RecordData, visible: boolean) {
    // Reflect the toggle immediately; the grid filter reads straight off this state.
    onDataChange((previous) => ({ ...previous, calendarSources: previous.calendarSources.map((item) => (recordId(item) === recordId(source) ? { ...item, visible } : item)) }));
    try {
      await postUtility("updateCalendarSource", recordId(source), { ...source, visible });
    } catch {
      onDataChange((previous) => ({ ...previous, calendarSources: previous.calendarSources.map((item) => (recordId(item) === recordId(source) ? { ...item, visible: !visible } : item)) }));
      onToast({ tone: "error", message: "Unable to update calendar visibility." });
    }
  }

  async function deleteCalendarSource(source: RecordData) {
    if (!globalThis.confirm(`Delete the calendar "${text(source.name)}"? Its events stay in the CRM.`)) return;
    try {
      await postUtility("deleteCalendarSource", recordId(source));
      onDataChange((previous) => ({ ...previous, calendarSources: previous.calendarSources.filter((item) => recordId(item) !== recordId(source)) }));
      onToast({ tone: "success", message: "Calendar deleted." });
    } catch (error) {
      onToast({ tone: "error", message: error instanceof Error ? error.message : "Unable to delete calendar." });
    }
  }

  async function refreshCalendar() {
    await loadWindow();
    if (await onRefreshData("Calendar refreshed from the CRM.")) setRefreshedAt(new Date());
  }

  // --------------------------------------------------------------- render

  return (
    <>
      <div className={cn("grid gap-3", sidebarVisible && "xl:grid-cols-[280px_minmax(0,1fr)]")}>
        {sidebarVisible && (
          <CalendarSidebar
            data={data}
            miniMonth={miniMonth}
            anchorDate={anchorDate}
            weekStartsOn={weekStartsOn}
            myCalendarSources={myCalendarSources}
            otherCalendarSources={otherCalendarSources}
            showTasks={showTasks}
            showVideoCalls={showVideoCalls}
            onMiniMonthChange={setMiniMonth}
            onPickDate={(day) => setAnchorDate(day)}
            onAddCalendar={() => setCalendarDialog({ type: "new" })}
            onEditCalendar={(source) => setCalendarDialog({ type: "edit", source })}
            onToggleCalendar={(source, visible) => void setSourceVisibility(source, visible)}
            onDeleteCalendar={(source) => void deleteCalendarSource(source)}
            onToggleTasks={setShowTasks}
            onToggleVideoCalls={setShowVideoCalls}
          />
        )}

        <section className="min-w-0 rounded-lg border border-[#e4e7ec] bg-white shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#d8dde6] p-3">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold">Calendar</h1>
              <div className="text-xs text-[#706e6b]">
                {rangeLabel} · {timeZone} · {loading ? "Loading…" : `Updated ${new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit" }).format(refreshedAt)}`}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <label className="relative">
                <Search size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[#706e6b]" aria-hidden="true" />
                <input
                  className={cn(input, "min-h-8 w-44 py-1 pl-7 text-xs")}
                  placeholder="Search calendar"
                  aria-label="Search calendar"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                />
              </label>
              <select className={cn(input, "min-h-8 w-auto py-1 text-xs")} aria-label="Show time as" value={showTimeAsFilter} onChange={(event) => setShowTimeAsFilter(event.target.value)}>
                {SHOW_TIME_AS_FILTERS.map((option) => <option key={option} value={option}>{option === "All" ? "Any status" : option}</option>)}
              </select>
              <select className={cn(input, "min-h-8 w-auto py-1 text-xs")} aria-label="Assigned to" value={assignedToFilter} onChange={(event) => setAssignedToFilter(event.target.value)}>
                <option value="All">Anyone</option>
                {data.users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </select>
              <button className={secondary} onClick={movePrevious} aria-label="Previous"><ChevronLeft size={14} /></button>
              <button className={secondary} onClick={() => setAnchorDate(new Date())}>Today</button>
              <button className={secondary} onClick={moveNext} aria-label="Next"><ChevronRight size={14} /></button>
              <select className={cn(input, "min-h-8 w-auto py-1 text-xs")} aria-label="Calendar view" value={viewMode} onChange={(event) => setViewMode(event.target.value as ViewMode)}>
                {VIEW_MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
              </select>
              <AsyncButton className={secondary} onClick={() => refreshCalendar()}><RefreshCw size={14} /> Refresh</AsyncButton>
              <a href="/api/calendar/export" className={secondary}><Download size={14} /> Export .ics</a>
              <button className={secondary} onClick={() => setSidebarVisible((visible) => !visible)}>{sidebarVisible ? "Hide Sidebar" : "Show Sidebar"}</button>
              <button className={primary} onClick={() => onCreate(toDateInputValue(anchorDate), "09:00", nextTimeSlot("09:00"))}><Plus size={14} /> New Event</button>
            </div>
          </div>

          {viewMode === "Agenda" ? (
            <AgendaView items={items} days={visibleDays} timeZone={timeZone} onSelect={setSelectedKey} selectedKey={selectedKey} renderPopover={renderPopover} />
          ) : viewMode === "Month" ? (
            <MonthView
              items={items}
              days={visibleDays}
              anchorDate={anchorDate}
              weekStartsOn={weekStartsOn}
              timeZone={timeZone}
              expandedDay={expandedDay}
              selectedKey={selectedKey}
              onExpandDay={setExpandedDay}
              onSelect={setSelectedKey}
              onCreateAt={(day) => onCreate(toDateInputValue(day), "09:00", nextTimeSlot("09:00"))}
              renderPopover={renderPopover}
            />
          ) : (
            <TimeGridView
              scrollRef={scrollRef}
              items={items}
              days={visibleDays}
              timeZone={timeZone}
              now={now}
              selectedKey={selectedKey}
              onSelect={setSelectedKey}
              onCreateRange={(day, startMinutes, endMinutes) => onCreate(toDateInputValue(day), minutesToTimeText(startMinutes), minutesToTimeText(endMinutes))}
              onMove={requestMove}
              renderPopover={renderPopover}
            />
          )}
        </section>
      </div>

      {calendarDialog && <CalendarSourceModal state={calendarDialog} onClose={() => setCalendarDialog(null)} onSave={saveCalendarSource} />}
      {scopePrompt && (
        <ScopeDialog
          prompt={scopePrompt}
          onClose={() => setScopePrompt(null)}
          onChoose={(scope) => {
            const prompt = scopePrompt;
            setScopePrompt(null);
            if (prompt.action === "move") void persistTimes(prompt.item, prompt.startAt, prompt.endAt, scope);
            else void deleteItem(prompt.item, scope);
          }}
        />
      )}
    </>
  );

  function renderPopover(item: CalendarItem) {
    return (
      <EventDetail
        item={item}
        timeZone={timeZone}
        attendeeNames={(Array.isArray(item.record.attendeeIds) ? item.record.attendeeIds.map((id) => personName(text(id))) : []).filter(Boolean)}
        nameRecordName={relatedName(item.record.nameObjectType, item.record.nameRecordId)}
        relatedRecordName={relatedName(item.record.relatedObjectType, item.record.relatedRecordId)}
        calendarSourceName={text(sourcesById.get(text(item.record.calendarSourceId))?.name)}
        assignedToName={text(usersById.get(text(item.record.assignedToId))?.name)}
        onEdit={() => {
          setSelectedKey(null);
          openItem(item);
        }}
        onDelete={() => {
          setSelectedKey(null);
          requestDelete(item);
        }}
        onOpenRelated={() => {
          const objectType = text(item.record.relatedObjectType || item.record.nameObjectType);
          const id = text(item.record.relatedRecordId || item.record.nameRecordId);
          if (!objectType || !id) return;
          setSelectedKey(null);
          onNavigate(`/lightning/r/${objectType}/${id}/view`);
        }}
      />
    );
  }
}

// ============================================================ time grid

function TimeGridView({
  scrollRef,
  items,
  days,
  timeZone,
  now,
  selectedKey,
  onSelect,
  onCreateRange,
  onMove,
  renderPopover
}: {
  scrollRef: MutableRefObject<HTMLDivElement | null>;
  items: CalendarItem[];
  days: Date[];
  timeZone: string;
  now: Date;
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  onCreateRange: (day: Date, startMinutes: number, endMinutes: number) => void;
  onMove: (item: CalendarItem, startAt: Date, endAt: Date) => void;
  renderPopover: (item: CalendarItem) => ReactNode;
}) {
  const [draft, setDraft] = useState<{ dayIndex: number; startMinutes: number; endMinutes: number } | null>(null);
  const [drag, setDrag] = useState<{ key: string; mode: "move" | "resize"; startMinutes: number; endMinutes: number; dayIndex: number } | null>(null);

  const hours = Array.from({ length: 24 }, (_, hour) => hour);
  const nowMinutes = minutesFromMidnight(now, timeZone);

  function minutesFromPointer(element: HTMLElement, clientY: number) {
    const bounds = element.getBoundingClientRect();
    const ratio = (clientY - bounds.top) / bounds.height;
    return Math.max(0, Math.min(MINUTES_PER_DAY, snapMinutes(ratio * MINUTES_PER_DAY)));
  }

  function beginCreate(event: ReactPointerEvent<HTMLDivElement>, dayIndex: number) {
    if (event.button !== 0) return;
    const column = event.currentTarget;
    const startMinutes = minutesFromPointer(column, event.clientY);
    column.setPointerCapture(event.pointerId);
    setDraft({ dayIndex, startMinutes, endMinutes: startMinutes + SNAP_MINUTES });

    const move = (moveEvent: PointerEvent) => {
      const current = minutesFromPointer(column, moveEvent.clientY);
      setDraft({ dayIndex, startMinutes: Math.min(startMinutes, current), endMinutes: Math.max(startMinutes + SNAP_MINUTES, current) });
    };
    const finish = (upEvent: PointerEvent) => {
      column.removeEventListener("pointermove", move);
      column.removeEventListener("pointerup", finish);
      column.removeEventListener("pointercancel", finish);
      const current = minutesFromPointer(column, upEvent.clientY);
      const start = Math.min(startMinutes, current);
      const end = Math.max(startMinutes + SNAP_MINUTES, current);
      setDraft(null);
      // A plain click means "one hour here", a drag means the range that was drawn.
      onCreateRange(days[dayIndex], start, end - start < 30 ? Math.min(start + 60, MINUTES_PER_DAY - 1) : end);
    };
    column.addEventListener("pointermove", move);
    column.addEventListener("pointerup", finish);
    column.addEventListener("pointercancel", finish);
  }

  function beginDrag(event: ReactPointerEvent<HTMLElement>, item: CalendarItem, dayIndex: number, mode: "move" | "resize") {
    if (event.button !== 0) return;
    event.stopPropagation();
    if (item.kind !== "event") return;
    const column = event.currentTarget.closest("[data-day-column]") as HTMLElement | null;
    if (!column) return;

    const originStart = minutesFromMidnight(item.startAt, timeZone);
    const originEnd = originStart + Math.max(SNAP_MINUTES, (new Date(item.endAt).getTime() - new Date(item.startAt).getTime()) / 60000);
    const grabbedAt = minutesFromPointer(column, event.clientY);
    let moved = false;
    let latest = { startMinutes: originStart, endMinutes: originEnd };

    const move = (moveEvent: PointerEvent) => {
      const current = minutesFromPointer(column, moveEvent.clientY);
      if (Math.abs(current - grabbedAt) >= SNAP_MINUTES) moved = true;
      if (!moved) return;
      latest =
        mode === "move"
          ? (() => {
              const delta = current - grabbedAt;
              const duration = originEnd - originStart;
              const start = Math.max(0, Math.min(MINUTES_PER_DAY - duration, originStart + delta));
              return { startMinutes: start, endMinutes: start + duration };
            })()
          : { startMinutes: originStart, endMinutes: Math.max(originStart + SNAP_MINUTES, Math.min(MINUTES_PER_DAY, current)) };
      setDrag({ key: item.occurrenceKey, mode, dayIndex, ...latest });
    };

    const finish = () => {
      globalThis.removeEventListener("pointermove", move);
      globalThis.removeEventListener("pointerup", finish);
      globalThis.removeEventListener("pointercancel", finish);
      setDrag(null);
      if (!moved) {
        onSelect(item.occurrenceKey);
        return;
      }
      const dayText = toDateInputValue(days[dayIndex]);
      onMove(item, zonedTimeToUtc(dayText, minutesToTimeText(latest.startMinutes), timeZone), zonedTimeToUtc(dayText, minutesToTimeText(latest.endMinutes), timeZone));
    };

    globalThis.addEventListener("pointermove", move);
    globalThis.addEventListener("pointerup", finish);
    globalThis.addEventListener("pointercancel", finish);
  }

  return (
    <div ref={scrollRef} className="max-h-[70vh] overflow-auto">
      <div className={cn("grid min-w-[820px]", days.length === 1 ? "grid-cols-[64px_1fr]" : "grid-cols-[64px_repeat(7,minmax(0,1fr))]")}>
        <div className="sticky top-0 z-20 border-b border-[#d8dde6] bg-[#f3f3f3] p-2" />
        {days.map((day) => (
          <div key={toDateInputValue(day)} className="sticky top-0 z-20 border-b border-l border-[#d8dde6] bg-[#f3f3f3] p-2 text-center text-xs font-semibold">
            {shortDayLabel(day)}
          </div>
        ))}

        <div className="border-b border-[#d8dde6] p-2 text-[11px] text-[#706e6b]">All day</div>
        {days.map((day) => (
          <div key={`${toDateInputValue(day)}-allday`} className="min-h-10 space-y-1 border-b border-l border-[#d8dde6] p-1">
            {allDayItemsForDay(items, day, timeZone).map((item) => (
              <ItemPopover key={item.occurrenceKey} item={item} open={selectedKey === item.occurrenceKey} onOpenChange={(open) => onSelect(open ? item.occurrenceKey : null)} renderPopover={renderPopover}>
                <button
                  className="block w-full truncate rounded px-1.5 py-1 text-left text-[11px] font-semibold text-white"
                  style={{ backgroundColor: item.color }}
                  onClick={() => onSelect(selectedKey === item.occurrenceKey ? null : item.occurrenceKey)}
                >
                  {item.title}
                </button>
              </ItemPopover>
            ))}
          </div>
        ))}

        <div className="relative" style={{ height: DAY_COLUMN_HEIGHT }}>
          {hours.map((hour) => (
            <div key={hour} className="absolute right-1 -translate-y-1/2 text-[11px] text-[#706e6b]" style={{ top: (hour / 24) * DAY_COLUMN_HEIGHT }}>
              {hour === 0 ? "" : `${String(hour).padStart(2, "0")}:00`}
            </div>
          ))}
        </div>

        {days.map((day, dayIndex) => {
          const positioned = layoutDayItems(items, day, timeZone);
          const isToday = toDateInputValue(day) === toDateInputValue(now);
          return (
            <div
              key={`${toDateInputValue(day)}-grid`}
              data-day-column
              className="relative border-l border-[#d8dde6]"
              style={{ height: DAY_COLUMN_HEIGHT }}
              onPointerDown={(event) => beginCreate(event, dayIndex)}
            >
              {hours.map((hour) => (
                <div key={hour} className={cn("absolute inset-x-0 border-t", hour % 2 === 0 ? "border-[#d8dde6]" : "border-[#eef1f6]")} style={{ top: (hour / 24) * DAY_COLUMN_HEIGHT }} />
              ))}

              {draft?.dayIndex === dayIndex && (
                <div
                  className="pointer-events-none absolute inset-x-1 rounded border border-dashed border-brand-600 bg-brand-500/20"
                  style={{ top: (draft.startMinutes / MINUTES_PER_DAY) * DAY_COLUMN_HEIGHT, height: ((draft.endMinutes - draft.startMinutes) / MINUTES_PER_DAY) * DAY_COLUMN_HEIGHT }}
                />
              )}

              {isToday && (
                <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: (nowMinutes / MINUTES_PER_DAY) * DAY_COLUMN_HEIGHT }}>
                  <span className="h-2 w-2 shrink-0 rounded-full bg-[#ba0517]" />
                  <span className="h-px flex-1 bg-[#ba0517]" />
                </div>
              )}

              {positioned.map(({ item, topPct, heightPct, columnIndex, columnCount }) => {
                const dragging = drag?.key === item.occurrenceKey && drag.dayIndex === dayIndex;
                const top = dragging ? (drag.startMinutes / MINUTES_PER_DAY) * 100 : topPct;
                const height = dragging ? ((drag.endMinutes - drag.startMinutes) / MINUTES_PER_DAY) * 100 : heightPct;
                return (
                  <ItemPopover key={item.occurrenceKey} item={item} open={selectedKey === item.occurrenceKey} onOpenChange={(open) => onSelect(open ? item.occurrenceKey : null)} renderPopover={renderPopover}>
                    <div
                      role="button"
                      tabIndex={0}
                      aria-label={`${item.title} ${calendarTimeRange(item, timeZone)}`}
                      onPointerDown={(event) => beginDrag(event, item, dayIndex, "move")}
                      onClick={() => {
                        if (item.kind !== "event") onSelect(item.occurrenceKey);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onSelect(item.occurrenceKey);
                        }
                      }}
                      className={cn(
                        "absolute overflow-hidden rounded border-l-4 bg-white/95 px-1.5 py-0.5 text-[11px] leading-tight shadow-sm",
                        item.kind === "event" ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
                        dragging && "z-30 opacity-90 ring-2 ring-brand-500"
                      )}
                      style={{
                        top: `${top}%`,
                        height: `${height}%`,
                        left: `calc(${(columnIndex / columnCount) * 100}% + 2px)`,
                        width: `calc(${(1 / columnCount) * 100}% - 4px)`,
                        borderLeftColor: item.color,
                        boxShadow: `inset 0 0 0 1px ${item.color}33`
                      }}
                    >
                      <div className="flex items-center gap-1 truncate font-semibold text-[#181818]">
                        {item.kind === "videoCall" && <Video size={10} className="shrink-0" aria-hidden="true" />}
                        {item.recurring && <Repeat size={10} className="shrink-0" aria-hidden="true" />}
                        <span className="truncate">{item.title}</span>
                      </div>
                      <div className="truncate text-[#514f4d]">{calendarTimeRange(item, timeZone)}</div>
                      {item.kind === "event" && (
                        <span
                          role="presentation"
                          onPointerDown={(event) => beginDrag(event, item, dayIndex, "resize")}
                          className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
                        />
                      )}
                    </div>
                  </ItemPopover>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ================================================================ month

function MonthView({
  items,
  days,
  anchorDate,
  weekStartsOn,
  timeZone,
  expandedDay,
  selectedKey,
  onExpandDay,
  onSelect,
  onCreateAt,
  renderPopover
}: {
  items: CalendarItem[];
  days: Date[];
  anchorDate: Date;
  weekStartsOn: number;
  timeZone: string;
  expandedDay: string | null;
  selectedKey: string | null;
  onExpandDay: (key: string | null) => void;
  onSelect: (key: string | null) => void;
  onCreateAt: (day: Date) => void;
  renderPopover: (item: CalendarItem) => ReactNode;
}) {
  return (
    <div className="grid grid-cols-7 border-b border-[#d8dde6] text-xs">
      {weekdayHeaderLabels(weekStartsOn).map((label) => (
        <div key={label} className="border-b border-l border-[#d8dde6] bg-[#f3f3f3] p-2 text-center font-semibold">{label}</div>
      ))}
      {days.map((day) => {
        const key = toDateInputValue(day);
        const dayItems = itemsOnDay(items, day, timeZone);
        const expanded = expandedDay === key;
        const shown = expanded ? dayItems : dayItems.slice(0, 3);
        const isToday = key === toDateInputValue(new Date());
        return (
          <div key={key} className={cn("min-h-28 border-l border-t border-[#d8dde6] p-2 align-top", !sameMonth(day, anchorDate) && "bg-[#fafafa] text-[#a8a8a8]")}>
            <div className="mb-1 flex items-center justify-between">
              <button className={cn("rounded px-1 font-semibold hover:bg-brand-50", isToday && "bg-brand-500 text-white hover:bg-brand-600")} onClick={() => onCreateAt(day)}>
                {day.getDate()}
              </button>
            </div>
            <div className="space-y-1">
              {shown.map((item) => (
                <ItemPopover key={item.occurrenceKey} item={item} open={selectedKey === item.occurrenceKey} onOpenChange={(open) => onSelect(open ? item.occurrenceKey : null)} renderPopover={renderPopover}>
                  <button
                    className="flex w-full items-center gap-1 rounded border bg-white px-1.5 py-1 text-left text-[11px] leading-tight"
                    style={{ borderColor: item.color, boxShadow: `inset 3px 0 0 ${item.color}` }}
                    onClick={() => onSelect(selectedKey === item.occurrenceKey ? null : item.occurrenceKey)}
                  >
                    {item.recurring && <Repeat size={9} className="shrink-0" aria-hidden="true" />}
                    <span className="truncate font-semibold">{item.title}</span>
                  </button>
                </ItemPopover>
              ))}
              {dayItems.length > 3 && (
                <button className="text-[11px] font-semibold text-brand-700 hover:underline" onClick={() => onExpandDay(expanded ? null : key)}>
                  {expanded ? "Show less" : `+${dayItems.length - 3} more`}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// =============================================================== agenda

function AgendaView({
  items,
  days,
  timeZone,
  selectedKey,
  onSelect,
  renderPopover
}: {
  items: CalendarItem[];
  days: Date[];
  timeZone: string;
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  renderPopover: (item: CalendarItem) => ReactNode;
}) {
  const grouped = days.map((day) => ({ day, dayItems: itemsOnDay(items, day, timeZone) })).filter((entry) => entry.dayItems.length > 0);

  if (grouped.length === 0) {
    return (
      <div className="p-10 text-center">
        <CalendarClock size={28} className="mx-auto text-[#a8a8a8]" aria-hidden="true" />
        <p className="mt-3 text-sm text-[#706e6b]">Nothing scheduled in the next {days.length} days.</p>
      </div>
    );
  }

  return (
    <div className="max-h-[70vh] divide-y divide-[#e4e7ec] overflow-auto">
      {grouped.map(({ day, dayItems }) => (
        <div key={toDateInputValue(day)} className="grid gap-2 p-3 sm:grid-cols-[160px_minmax(0,1fr)]">
          <div className="text-sm font-semibold text-[#181818]">{fullDateLabel(day)}</div>
          <div className="space-y-1">
            {dayItems.map((item) => (
              <ItemPopover key={item.occurrenceKey} item={item} open={selectedKey === item.occurrenceKey} onOpenChange={(open) => onSelect(open ? item.occurrenceKey : null)} renderPopover={renderPopover}>
                <button
                  className="flex w-full items-start gap-3 rounded border border-[#e4e7ec] px-3 py-2 text-left hover:bg-brand-50"
                  onClick={() => onSelect(selectedKey === item.occurrenceKey ? null : item.occurrenceKey)}
                >
                  <span className="mt-1 h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: item.color }} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 truncate text-sm font-semibold">
                      {item.kind === "videoCall" && <Video size={12} aria-hidden="true" />}
                      {item.kind === "task" && <CheckSquare size={12} aria-hidden="true" />}
                      {item.recurring && <Repeat size={12} aria-hidden="true" />}
                      {item.title}
                    </span>
                    <span className="block truncate text-xs text-[#706e6b]">
                      {calendarTimeRange(item, timeZone)}
                      {item.record.location ? ` · ${text(item.record.location)}` : ""}
                    </span>
                  </span>
                </button>
              </ItemPopover>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================== pieces

function itemsOnDay(items: CalendarItem[], day: Date, timeZone: string) {
  const timed = layoutDayItems(items, day, timeZone).map((entry) => entry.item);
  return [...allDayItemsForDay(items, day, timeZone), ...timed];
}

function ItemPopover({
  item,
  open,
  onOpenChange,
  renderPopover,
  children
}: {
  item: CalendarItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  renderPopover: (item: CalendarItem) => ReactNode;
  children: ReactNode;
}) {
  // An Anchor rather than a Trigger: the callers own the open state, so a click
  // that ends a drag cannot race Radix's own toggle and reopen what it closed.
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Anchor asChild>{children}</Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-[80] w-80 rounded border border-[#d8dde6] bg-white p-3 shadow-popover"
          onPointerDown={(event) => event.stopPropagation()}
        >
          {renderPopover(item)}
          <Popover.Arrow className="fill-white" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function EventDetail({
  item,
  timeZone,
  attendeeNames,
  nameRecordName,
  relatedRecordName,
  calendarSourceName,
  assignedToName,
  onEdit,
  onDelete,
  onOpenRelated
}: {
  item: CalendarItem;
  timeZone: string;
  attendeeNames: string[];
  nameRecordName: string;
  relatedRecordName: string;
  calendarSourceName: string;
  assignedToName: string;
  onEdit: () => void;
  onDelete: () => void;
  onOpenRelated: () => void;
}) {
  const recurrence = describeRecurrence(item.record.recurrenceRule, timeZone);
  const related = relatedRecordName || nameRecordName;
  const reminderMinutes = item.record.reminderMinutes;

  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-start gap-2">
        <span className="mt-1 h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: item.color }} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-[#181818]">{item.title}</div>
          <div className="text-xs text-[#706e6b]">
            {new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone }).format(new Date(item.startAt))} · {calendarTimeRange(item, timeZone)}
          </div>
        </div>
      </div>

      <dl className="space-y-1 text-xs">
        {recurrence && <DetailRow label="Repeats" value={recurrence} />}
        {Boolean(item.record.location) && <DetailRow label="Location" value={text(item.record.location)} />}
        {attendeeNames.length > 0 && <DetailRow label="Attendees" value={attendeeNames.join(", ")} />}
        {assignedToName && <DetailRow label="Assigned to" value={assignedToName} />}
        {related && <DetailRow label="Related to" value={related} />}
        {calendarSourceName && <DetailRow label="Calendar" value={calendarSourceName} />}
        {Boolean(item.record.showTimeAs) && <DetailRow label="Shows as" value={text(item.record.showTimeAs)} />}
        {reminderMinutes !== null && reminderMinutes !== undefined && <DetailRow label="Reminder" value={formatReminderOffset(reminderMinutes)} />}
      </dl>

      {Boolean(item.record.description) && <p className="max-h-24 overflow-auto whitespace-pre-wrap rounded bg-[#f8f9fb] p-2 text-xs text-[#514f4d]">{text(item.record.description)}</p>}

      <div className="flex flex-wrap gap-1 border-t border-[#e4e7ec] pt-2">
        {item.kind === "task" ? (
          <button className={secondary} onClick={onOpenRelated}>Open related record</button>
        ) : (
          <>
            <button className={primary} onClick={onEdit}><Edit3 size={12} /> {item.kind === "videoCall" ? "Open" : "Edit"}</button>
            {(relatedRecordName || nameRecordName) && <button className={secondary} onClick={onOpenRelated}>Open record</button>}
            {item.kind === "event" && (
              <button className={cn(secondary, "border-[#ea001e] text-[#ba0517] hover:bg-[#fff1f1]")} onClick={onDelete}><Trash2 size={12} /> Delete</button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[84px_minmax(0,1fr)] gap-2">
      <dt className="text-[#706e6b]">{label}</dt>
      <dd className="min-w-0 break-words text-[#181818]">{value}</dd>
    </div>
  );
}

function CalendarSidebar({
  data,
  miniMonth,
  anchorDate,
  weekStartsOn,
  myCalendarSources,
  otherCalendarSources,
  showTasks,
  showVideoCalls,
  onMiniMonthChange,
  onPickDate,
  onAddCalendar,
  onEditCalendar,
  onToggleCalendar,
  onDeleteCalendar,
  onToggleTasks,
  onToggleVideoCalls
}: {
  data: BootstrapData;
  miniMonth: Date;
  anchorDate: Date;
  weekStartsOn: number;
  myCalendarSources: RecordData[];
  otherCalendarSources: RecordData[];
  showTasks: boolean;
  showVideoCalls: boolean;
  onMiniMonthChange: (updater: (date: Date) => Date) => void;
  onPickDate: (day: Date) => void;
  onAddCalendar: () => void;
  onEditCalendar: (source: RecordData) => void;
  onToggleCalendar: (source: RecordData, visible: boolean) => void;
  onDeleteCalendar: (source: RecordData) => void;
  onToggleTasks: (visible: boolean) => void;
  onToggleVideoCalls: (visible: boolean) => void;
}) {
  function renderSource(source: RecordData) {
    const visible = source.visible !== false;
    return (
      <div key={recordId(source)} className="flex items-center justify-between gap-2 rounded px-1 py-1 text-sm hover:bg-brand-50">
        <label className="flex min-w-0 flex-1 items-center gap-2">
          <input type="checkbox" className={checkbox} checked={visible} onChange={(event) => onToggleCalendar(source, event.target.checked)} />
          <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: text(source.color) || DEFAULT_CALENDAR_COLOR }} />
          <span className={cn("truncate", !visible && "text-[#706e6b] line-through")}>{text(source.name) || "Calendar"}</span>
        </label>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button aria-label={`${text(source.name) || "Calendar"} options`} className="rounded p-1 hover:bg-[#f3f3f3]"><MoreHorizontal size={14} /></button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" className="z-50 min-w-36 rounded border border-[#d8dde6] bg-white p-1 shadow-popover">
              <DropdownMenu.Item onSelect={() => onEditCalendar(source)} className="flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm outline-none hover:bg-brand-50"><Edit3 size={13} /> Edit</DropdownMenu.Item>
              <DropdownMenu.Item onSelect={() => onToggleCalendar(source, !visible)} className="flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm outline-none hover:bg-brand-50"><Eye size={13} /> {visible ? "Hide" : "Show"}</DropdownMenu.Item>
              <DropdownMenu.Item onSelect={() => onDeleteCalendar(source)} className="flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm text-[#ba0517] outline-none hover:bg-[#fff1f1]"><Trash2 size={13} /> Delete</DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    );
  }

  return (
    <aside className="rounded-lg border border-[#e4e7ec] bg-white p-3 shadow-card">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button className={secondary} aria-label="Previous month" onClick={() => onMiniMonthChange((date) => addCalendarMonths(date, -1))}><ChevronLeft size={14} /></button>
        <div className="min-w-0 flex-1 text-center text-sm font-semibold">{monthYearLabel(miniMonth)}</div>
        <button className={secondary} aria-label="Next month" onClick={() => onMiniMonthChange((date) => addCalendarMonths(date, 1))}><ChevronRight size={14} /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {weekdayHeaderLabels(weekStartsOn).map((label, index) => <div key={`${label}-${index}`} className="font-semibold text-[#706e6b]">{label.slice(0, 1)}</div>)}
        {getMonthDays(miniMonth, weekStartsOn).map((day) => {
          const active = toDateInputValue(day) === toDateInputValue(anchorDate);
          const today = toDateInputValue(day) === toDateInputValue(new Date());
          return (
            <button
              key={toDateInputValue(day)}
              onClick={() => onPickDate(day)}
              className={cn("rounded py-1 hover:bg-brand-50", active && "bg-brand-500 text-white hover:bg-brand-600", !sameMonth(day, miniMonth) && "text-[#a8a8a8]", today && !active && "ring-1 ring-brand-500")}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>

      <div className="mt-4 border-t border-[#d8dde6] pt-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-sm font-semibold">My Calendars</div>
          <button aria-label="Add calendar" className="rounded p-1 text-brand-700 hover:bg-brand-50" onClick={onAddCalendar}><Plus size={14} /></button>
        </div>
        <div className="space-y-1">
          {myCalendarSources.length > 0 ? myCalendarSources.map(renderSource) : <div className="text-sm text-[#706e6b]">{data.user.name}</div>}
        </div>
      </div>

      <div className="mt-4 border-t border-[#d8dde6] pt-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-sm font-semibold">Other Calendars</div>
          <button className="text-sm text-brand-700 hover:underline" onClick={onAddCalendar}>Add</button>
        </div>
        <div className="space-y-1">
          {otherCalendarSources.length > 0 ? otherCalendarSources.map(renderSource) : <div className="text-sm text-[#706e6b]">No other calendars</div>}
        </div>
      </div>

      <div className="mt-4 border-t border-[#d8dde6] pt-3">
        <div className="mb-2 text-sm font-semibold">Overlays</div>
        <label className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-brand-50">
          <input type="checkbox" className={checkbox} checked={showTasks} onChange={(event) => onToggleTasks(event.target.checked)} />
          <span className="h-3 w-3 shrink-0 rounded-sm bg-[#f3b451]" />
          <span>Tasks</span>
        </label>
        <label className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-brand-50">
          <input type="checkbox" className={checkbox} checked={showVideoCalls} onChange={(event) => onToggleVideoCalls(event.target.checked)} />
          <span className="h-3 w-3 shrink-0 rounded-sm bg-[#0176d3]" />
          <span>Video Calls</span>
        </label>
      </div>
    </aside>
  );
}

function CalendarSourceModal({ state, onClose, onSave }: { state: Exclude<CalendarSourceDialogState, null>; onClose: () => void; onSave: (values: RecordData, source?: RecordData) => Promise<void> }) {
  const source = state.type === "edit" ? state.source : undefined;
  const [values, setValues] = useState<RecordData>(() => ({
    name: text(source?.name),
    type: calendarSourceType(source ?? { type: "My" }),
    color: text(source?.color) || DEFAULT_CALENDAR_COLOR,
    visible: source?.visible !== false
  }));
  const [error, setError] = useState("");

  return (
    <Modal
      title={source ? "Edit Calendar" : "Add Calendar"}
      onClose={onClose}
      footer={
        <>
          <button className={secondary} onClick={onClose}>Cancel</button>
          <AsyncButton
            className={primary}
            onClick={() => {
              if (!text(values.name).trim()) {
                setError("Complete this field.");
                return;
              }
              setError("");
              return onSave(values, source);
            }}
          >
            Save
          </AsyncButton>
        </>
      }
    >
      <div className="grid gap-3">
        <div className="rounded border border-[#d8dde6] bg-[#f8f9fb] p-3 text-xs text-[#514f4d]">
          This creates a local CRM calendar. Google, Microsoft, and CalDAV synchronization require a configured provider connection and are not available. Use the calendar&apos;s .ics export for interoperability.
        </div>
        <Field label="Calendar Name" error={error}>
          <input className={input} value={text(values.name)} onChange={(event) => setValues({ ...values, name: event.target.value })} />
        </Field>
        <Field label="Type">
          <select className={input} value={calendarSourceType(values)} onChange={(event) => setValues({ ...values, type: event.target.value })}>
            <option value="My">My</option>
            <option value="Other">Other</option>
          </select>
        </Field>
        <Field label="Color">
          <div className="flex flex-wrap gap-2">
            {CALENDAR_SOURCE_COLORS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-label={`Use ${option.label}`}
                onClick={() => setValues({ ...values, color: option.value })}
                className={cn("h-8 w-8 rounded border border-[#c9c9c9] ring-offset-2", text(values.color) === option.value && "ring-2 ring-brand-500")}
                style={{ backgroundColor: option.value }}
              />
            ))}
          </div>
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className={checkbox} checked={values.visible !== false} onChange={(event) => setValues({ ...values, visible: event.target.checked })} />
          Visible
        </label>
      </div>
    </Modal>
  );
}

function ScopeDialog({ prompt, onClose, onChoose }: { prompt: NonNullable<ScopePrompt>; onClose: () => void; onChoose: (scope: "single" | "all") => void }) {
  const verb = prompt.action === "delete" ? "Delete" : "Reschedule";
  return (
    <Modal
      title={`${verb} repeating event`}
      onClose={onClose}
      footer={
        <>
          <button className={secondary} onClick={onClose}>Cancel</button>
          <button className={secondary} onClick={() => onChoose("single")}>This occurrence</button>
          <button className={primary} onClick={() => onChoose("all")}>All occurrences</button>
        </>
      }
    >
      <p className="text-sm text-[#514f4d]">
        &ldquo;{prompt.item.title}&rdquo; repeats. {verb} only this occurrence, or every occurrence in the series?
      </p>
    </Modal>
  );
}

function Modal({ title, onClose, footer, children }: { title: string; onClose: () => void; footer: ReactNode; children: ReactNode }) {
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[100] w-[min(30rem,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-[#d8dde6] bg-white shadow-popover">
          <Dialog.Title className="border-b border-[#d8dde6] px-4 py-3 text-base font-semibold">{title}</Dialog.Title>
          <div className="max-h-[70vh] overflow-auto p-4">{children}</div>
          <div className="flex justify-end gap-2 border-t border-[#d8dde6] px-4 py-3">{footer}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-[#514f4d]">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-[#ba0517]">{error}</span>}
    </label>
  );
}

export default CalendarWorkspace;
