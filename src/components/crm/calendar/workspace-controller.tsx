"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addCalendarDays,
  addCalendarMonths,
  fullDateLabel,
  getMonthDays,
  monthDayYearLabel,
  monthYearLabel,
  startOfWeek,
  toDateInputValue,
  zonedTimeToUtc,
  type CalendarItem
} from "@/lib/calendar";
import { DEFAULT_CALENDAR_COLOR, expandEventsToItems, taskToItem, videoCallToItem } from "@/lib/calendar-items";
import { type RecordData } from "@/lib/crm-types";
import { apiRequest } from "@/lib/api/client";
import { resourceApi } from "@/lib/api/resources";
import {
  text,
  type ViewMode,
  type CalendarSourceDialogState,
  type ScopePrompt,
  AGENDA_HORIZON_DAYS,
  recordId,
  calendarSourceType,
  type CalendarWorkspaceProps
} from "@/components/crm/calendar/primitives";
import { EventDetail } from "@/components/crm/calendar/event-detail";
import { createCalendarActions } from "@/components/crm/calendar/calendar-actions";

export function useCalendarWorkspace({
  data,
  onCreate,
  onEditEvent,
  onOpenVideoCall,
  onDataChange,
  onToast,
  onRefreshData,
  onNavigate
}: CalendarWorkspaceProps) {
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
    if (viewMode === "Agenda")
      return Array.from({ length: AGENDA_HORIZON_DAYS }, (_, index) => addCalendarDays(anchorDate, index));
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
  const contactsById = useMemo(
    () => new Map(data.contacts.map((record) => [recordId(record), record])),
    [data.contacts]
  );
  const leadsById = useMemo(() => new Map(data.leads.map((record) => [recordId(record), record])), [data.leads]);
  const accountsById = useMemo(
    () => new Map(data.accounts.map((record) => [recordId(record), record])),
    [data.accounts]
  );
  const opportunitiesById = useMemo(
    () => new Map(data.opportunities.map((record) => [recordId(record), record])),
    [data.opportunities]
  );
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
  const sourcesById = useMemo(
    () => new Map(calendarSources.map((source) => [recordId(source), source])),
    [calendarSources]
  );
  const colorForSource = useCallback(
    (calendarSourceId: string | null) => text(sourcesById.get(text(calendarSourceId))?.color) || DEFAULT_CALENDAR_COLOR,
    [sourcesById]
  );
  // Events with no calendar assigned follow the visibility of the user's "My" calendars.
  const unassignedVisible =
    myCalendarSources.length === 0 || myCalendarSources.some((source) => source.visible !== false);
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
        const response = await resourceApi.createCalendarSource({
          name: data.user.name,
          type: "My",
          color: DEFAULT_CALENDAR_COLOR,
          visible: true
        });
        const created = Array.isArray(response.calendarSources)
          ? (response.calendarSources as RecordData[])
          : response.calendarSource
            ? [response.calendarSource as RecordData]
            : [];
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
          recurrenceExceptionDates: Array.isArray(record.recurrenceExceptionDates)
            ? record.recurrenceExceptionDates.map(text)
            : [],
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
    if (showTasks)
      for (const task of data.tasks) {
        const item = taskToItem(task);
        if (item) items.push(item);
      }
    if (showVideoCalls)
      for (const call of data.videoCalls) {
        const item = videoCallToItem(call);
        if (item) items.push(item);
      }
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
        const attendees = (
          Array.isArray(item.record.attendeeIds) ? item.record.attendeeIds.map((id) => personName(text(id))) : []
        ).join(" ");
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
  }, [
    fetchedItems,
    seededItems,
    overlayItems,
    optimistic,
    showTasks,
    showVideoCalls,
    sourceVisible,
    showTimeAsFilter,
    assignedToFilter,
    searchText,
    personName,
    relatedName
  ]);
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
      const payload = await apiRequest<RecordData>(`/api/calendar/events?${params.toString()}`);
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
    if (previous.events === data.events && previous.tasks === data.tasks && previous.videoCalls === data.videoCalls)
      return;
    calendarDataRef.current = { events: data.events, tasks: data.tasks, videoCalls: data.videoCalls };
    void loadWindow();
  }, [data.events, data.tasks, data.videoCalls, loadWindow]);
  /** Keep the open calendar synchronized while the server scheduler handles reliable delivery. */
  useEffect(() => {
    let active = true;
    async function sweep() {
      try {
        const payload = await apiRequest<RecordData>("/api/calendar/reminders", { method: "POST" });
        const notifications = Array.isArray(payload.notifications) ? (payload.notifications as RecordData[]) : [];
        if (!active || notifications.length === 0) return;
        const incoming = new Set(notifications.map((notification) => recordId(notification)));
        onDataChange((previous) => ({
          ...previous,
          notifications: [...notifications, ...previous.notifications.filter((item) => !incoming.has(recordId(item)))]
        }));
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
  /** A fresh calendar load should begin at the top of the timed grid. */
  useEffect(() => {
    if (didScrollRef.current || !scrollRef.current || viewMode === "Month" || viewMode === "Agenda") return;
    didScrollRef.current = true;
    scrollRef.current.scrollTop = 0;
  }, [viewMode]);
  // ------------------------------------------------------------ navigation

  function movePrevious() {
    setAnchorDate((date) =>
      viewMode === "Month"
        ? addCalendarMonths(date, -1)
        : addCalendarDays(date, viewMode === "Day" ? -1 : viewMode === "Agenda" ? -AGENDA_HORIZON_DAYS : -7)
    );
  }
  function moveNext() {
    setAnchorDate((date) =>
      viewMode === "Month"
        ? addCalendarMonths(date, 1)
        : addCalendarDays(date, viewMode === "Day" ? 1 : viewMode === "Agenda" ? AGENDA_HORIZON_DAYS : 7)
    );
  }
  const rangeLabel =
    viewMode === "Month"
      ? monthYearLabel(anchorDate)
      : viewMode === "Day"
        ? fullDateLabel(anchorDate)
        : `${monthDayYearLabel(visibleDays[0])} – ${monthDayYearLabel(visibleDays[visibleDays.length - 1])}`;
  const {
    deleteCalendarSource,
    deleteItem,
    openItem,
    persistTimes,
    requestDelete,
    requestMove,
    saveCalendarSource,
    setSourceVisibility
  } = createCalendarActions({
    loadWindow,
    onDataChange,
    onEditEvent,
    onNavigate,
    onOpenVideoCall,
    onToast,
    setCalendarDialog,
    setOptimistic,
    setScopePrompt,
    setSelectedKey
  });

  async function refreshCalendar() {
    await loadWindow();
    if (await onRefreshData("Calendar refreshed from the CRM.")) setRefreshedAt(new Date());
  }
  function renderPopover(item: CalendarItem) {
    return (
      <EventDetail
        item={item}
        timeZone={timeZone}
        attendeeNames={(Array.isArray(item.record.attendeeIds)
          ? item.record.attendeeIds.map((id) => personName(text(id)))
          : []
        ).filter(Boolean)}
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

  return {
    data,
    onCreate,
    timeZone,
    weekStartsOn,
    anchorDate,
    setAnchorDate,
    viewMode,
    setViewMode,
    sidebarVisible,
    setSidebarVisible,
    miniMonth,
    setMiniMonth,
    calendarDialog,
    setCalendarDialog,
    refreshedAt,
    now,
    searchText,
    setSearchText,
    showTimeAsFilter,
    setShowTimeAsFilter,
    assignedToFilter,
    setAssignedToFilter,
    showTasks,
    setShowTasks,
    showVideoCalls,
    setShowVideoCalls,
    loading,
    selectedKey,
    setSelectedKey,
    expandedDay,
    setExpandedDay,
    scopePrompt,
    setScopePrompt,
    scrollRef,
    visibleDays,
    myCalendarSources,
    otherCalendarSources,
    items,
    movePrevious,
    moveNext,
    rangeLabel,
    persistTimes,
    deleteItem,
    requestMove,
    saveCalendarSource,
    setSourceVisibility,
    deleteCalendarSource,
    refreshCalendar,
    renderPopover
  };
}

export type CalendarWorkspaceModel = ReturnType<typeof useCalendarWorkspace>;
