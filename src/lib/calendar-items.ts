import { expandRecurrence, parseRecurrenceRule } from "@/lib/calendar-recurrence";
import type { CalendarItem } from "@/lib/calendar";
import type { RecordData } from "@/lib/crm-types";

export const DEFAULT_CALENDAR_COLOR = "#4f46e5";
export const TASK_OVERLAY_COLOR = "#f3b451";
export const VIDEO_CALL_OVERLAY_COLOR = "#0176d3";

/** Stable identity for one occurrence of a series, used for React keys and override lookups. */
export function occurrenceKey(id: string, originalStart: Date | string | null | undefined) {
  if (!originalStart) return id;
  const date = originalStart instanceof Date ? originalStart : new Date(String(originalStart));
  return Number.isNaN(date.getTime()) ? id : `${id}:${date.toISOString()}`;
}

export type EventLike = {
  id: string;
  subject: string;
  startAt: Date | string;
  endAt: Date | string;
  allDay?: boolean;
  calendarSourceId?: string | null;
  recurrenceRule?: string | null;
  recurrenceEndAt?: Date | string | null;
  recurrenceParentId?: string | null;
  recurrenceOriginalStart?: Date | string | null;
  recurrenceExceptionDates?: (Date | string)[] | null;
};

/**
 * Expand stored events into the concrete occurrences inside a window.
 *
 * Detached overrides (rows carrying a `recurrenceParentId`) replace the series
 * slot they were carved out of, so an edited occurrence never renders twice.
 */
export function expandEventsToItems<T extends EventLike>(
  events: T[],
  start: Date,
  end: Date,
  timeZone: string,
  options: { colorForSource: (calendarSourceId: string | null) => string; toRecord: (event: T) => RecordData }
): CalendarItem[] {
  const overriddenSlots = new Set<string>();
  for (const event of events) {
    if (event.recurrenceParentId && event.recurrenceOriginalStart) {
      overriddenSlots.add(occurrenceKey(event.recurrenceParentId, event.recurrenceOriginalStart));
    }
  }

  const items: CalendarItem[] = [];

  for (const event of events) {
    const record = options.toRecord(event);
    const color = options.colorForSource(event.calendarSourceId ?? null);
    const recurring = Boolean(parseRecurrenceRule(event.recurrenceRule));

    for (const occurrence of expandRecurrence(event, start, end, timeZone)) {
      if (recurring && overriddenSlots.has(occurrenceKey(event.id, occurrence.originalStart))) continue;
      items.push({
        kind: "event",
        id: event.id,
        occurrenceKey: recurring ? occurrenceKey(event.id, occurrence.originalStart) : event.id,
        title: event.subject,
        startAt: occurrence.startAt.toISOString(),
        endAt: occurrence.endAt.toISOString(),
        allDay: Boolean(event.allDay),
        color,
        recurring,
        occurrenceStart: recurring ? occurrence.originalStart.toISOString() : null,
        record: {
          ...record,
          calendarColor: color,
          occurrenceStartAt: occurrence.startAt.toISOString(),
          occurrenceEndAt: occurrence.endAt.toISOString()
        }
      });
    }
  }

  return items;
}

/** Tasks appear as all-day chips on the day they are due. */
export function taskToItem(task: RecordData): CalendarItem | null {
  const dueDate = task.dueDate ? new Date(String(task.dueDate)) : null;
  if (!dueDate || Number.isNaN(dueDate.getTime())) return null;
  return {
    kind: "task",
    id: String(task.id ?? ""),
    occurrenceKey: `task:${String(task.id ?? "")}`,
    title: String(task.subject ?? "Task"),
    startAt: dueDate.toISOString(),
    endAt: dueDate.toISOString(),
    allDay: true,
    color: TASK_OVERLAY_COLOR,
    recurring: false,
    occurrenceStart: null,
    record: task
  };
}

export function videoCallToItem(call: RecordData): CalendarItem | null {
  const start = call.scheduledStartAt ? new Date(String(call.scheduledStartAt)) : null;
  const end = call.scheduledEndAt ? new Date(String(call.scheduledEndAt)) : null;
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return {
    kind: "videoCall",
    id: String(call.id ?? ""),
    occurrenceKey: `videoCall:${String(call.id ?? "")}`,
    title: String(call.name ?? "Video call"),
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    allDay: false,
    color: VIDEO_CALL_OVERLAY_COLOR,
    recurring: false,
    occurrenceStart: null,
    record: call
  };
}

export function itemIntersects(item: CalendarItem, start: Date, end: Date) {
  const itemStart = new Date(item.startAt).getTime();
  const itemEnd = new Date(item.endAt).getTime();
  return itemEnd >= start.getTime() && itemStart <= end.getTime();
}
