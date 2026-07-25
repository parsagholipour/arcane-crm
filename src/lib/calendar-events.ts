import "server-only";

import { prisma } from "@/lib/prisma";
import { parseRecurrenceRule } from "@/lib/calendar-recurrence";
import { DEFAULT_CALENDAR_COLOR, TASK_OVERLAY_COLOR, VIDEO_CALL_OVERLAY_COLOR, expandEventsToItems, occurrenceKey } from "@/lib/calendar-items";
import { MAX_EVENT_REMINDER_MINUTES } from "@/lib/calendar-reminder-values";
import type { CalendarItem } from "@/lib/calendar";
import type { RecordData } from "@/lib/crm-types";

export { DEFAULT_CALENDAR_COLOR, TASK_OVERLAY_COLOR, VIDEO_CALL_OVERLAY_COLOR, occurrenceKey };

/** Window seeded into the initial bootstrap payload, in days either side of now. */
export const BOOTSTRAP_EVENT_WINDOW_BEFORE_DAYS = 31;
export const BOOTSTRAP_EVENT_WINDOW_AFTER_DAYS = 92;
export const BOOTSTRAP_EVENT_LIMIT = 2000;
/** Widest window a single request may ask for, so one query cannot expand years of a daily series. */
export const MAX_WINDOW_DAYS = 400;

export class CalendarValidationError extends Error {
  readonly status: number;
  readonly field?: string;

  constructor(message: string, status = 400, field?: string) {
    super(message);
    this.name = "CalendarValidationError";
    this.status = status;
    this.field = field;
  }
}

export function calendarErrorResponse(error: unknown) {
  if (error instanceof CalendarValidationError) return { error: error.message, status: error.status, field: error.field };
  return null;
}

export function validateEventReminderMinutes(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const minutes = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > MAX_EVENT_REMINDER_MINUTES) {
    throw new CalendarValidationError(
      `Reminder must be a whole number of minutes from 0 to ${MAX_EVENT_REMINDER_MINUTES}.`,
      400,
      "reminderMinutes"
    );
  }
  return minutes;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function bootstrapEventWindow(now = new Date()) {
  return {
    start: new Date(now.getTime() - BOOTSTRAP_EVENT_WINDOW_BEFORE_DAYS * DAY_MS),
    end: new Date(now.getTime() + BOOTSTRAP_EVENT_WINDOW_AFTER_DAYS * DAY_MS)
  };
}

export function parseWindow(startText: unknown, endText: unknown) {
  const start = new Date(String(startText ?? ""));
  const end = new Date(String(endText ?? ""));
  if (Number.isNaN(start.getTime())) throw new CalendarValidationError("Provide a valid range start.", 400, "start");
  if (Number.isNaN(end.getTime())) throw new CalendarValidationError("Provide a valid range end.", 400, "end");
  if (end <= start) throw new CalendarValidationError("The range end must be after the range start.", 400, "end");
  if (end.getTime() - start.getTime() > MAX_WINDOW_DAYS * DAY_MS) {
    throw new CalendarValidationError(`Request at most ${MAX_WINDOW_DAYS} days of calendar data at a time.`, 400, "end");
  }
  return { start, end };
}

/**
 * Events visible to `userId` that could produce an occurrence inside the window.
 *
 * Recurring masters are fetched regardless of their own `startAt` because a
 * series that began years ago still yields occurrences today; non-recurring
 * events are narrowed by the window so the query stays bounded.
 */
export function eventWindowWhere(organizationId: string, userId: string, start: Date, end: Date) {
  return {
    organizationId,
    OR: [{ private: false }, { assignedToId: userId }],
    AND: [
      {
        OR: [
          { AND: [{ recurrenceRule: null }, { startAt: { lt: end } }, { endAt: { gt: start } }] },
          { AND: [{ NOT: { recurrenceRule: null } }, { startAt: { lt: end } }] }
        ]
      }
    ]
  };
}

export async function loadEventsForWindow(organizationId: string, userId: string, start: Date, end: Date) {
  return prisma.event.findMany({
    where: eventWindowWhere(organizationId, userId, start, end),
    orderBy: { startAt: "asc" },
    take: BOOTSTRAP_EVENT_LIMIT
  });
}

function serialize(value: unknown): RecordData {
  return JSON.parse(JSON.stringify(value)) as RecordData;
}

/** Tasks with a due date, surfaced as all-day chips on the day they are due. */
export async function loadTaskItems(organizationId: string, start: Date, end: Date): Promise<CalendarItem[]> {
  const tasks = await prisma.task.findMany({
    where: { organizationId, dueDate: { gte: start, lt: end } },
    orderBy: { dueDate: "asc" },
    take: BOOTSTRAP_EVENT_LIMIT
  });

  return tasks
    .filter((task) => task.dueDate)
    .map((task) => ({
      kind: "task" as const,
      id: task.id,
      occurrenceKey: `task:${task.id}`,
      title: task.subject ?? "Task",
      startAt: task.dueDate!.toISOString(),
      endAt: task.dueDate!.toISOString(),
      allDay: true,
      color: TASK_OVERLAY_COLOR,
      recurring: false,
      occurrenceStart: null,
      record: serialize(task)
    }));
}

export async function loadVideoCallItems(organizationId: string, start: Date, end: Date): Promise<CalendarItem[]> {
  const calls = await prisma.videoCall.findMany({
    where: { organizationId, scheduledStartAt: { lt: end }, scheduledEndAt: { gt: start } },
    orderBy: { scheduledStartAt: "asc" },
    take: BOOTSTRAP_EVENT_LIMIT
  });

  return calls.map((call) => ({
    kind: "videoCall" as const,
    id: call.id,
    occurrenceKey: `videoCall:${call.id}`,
    title: call.name,
    startAt: call.scheduledStartAt.toISOString(),
    endAt: call.scheduledEndAt.toISOString(),
    allDay: false,
    color: VIDEO_CALL_OVERLAY_COLOR,
    recurring: false,
    occurrenceStart: null,
    record: serialize(call)
  }));
}

/**
 * Event columns to write, with `undefined` for anything the payload did not mention.
 * Shared by the ordinary update path and the detached-occurrence override.
 */
export function eventUpdateData(payload: RecordData) {
  return {
    subject: payload.subject ? String(payload.subject) : undefined,
    description: payload.description as string | null | undefined,
    startAt: payload.startAt ? new Date(String(payload.startAt)) : undefined,
    endAt: payload.endAt ? new Date(String(payload.endAt)) : undefined,
    attendeeIds: Array.isArray(payload.attendeeIds) ? payload.attendeeIds.map(String) : undefined,
    nameObjectType: payload.nameObjectType as string | null | undefined,
    nameRecordId: payload.nameRecordId as string | null | undefined,
    relatedObjectType: payload.relatedObjectType as string | null | undefined,
    relatedRecordId: payload.relatedRecordId as string | null | undefined,
    assignedToId: payload.assignedToId ? String(payload.assignedToId) : undefined,
    calendarSourceId: payload.calendarSourceId as string | null | undefined,
    location: payload.location as string | null | undefined,
    showTimeAs: payload.showTimeAs ? String(payload.showTimeAs) : undefined,
    allDay: payload.allDay === undefined ? undefined : Boolean(payload.allDay),
    private: payload.private === undefined ? undefined : Boolean(payload.private),
    recurrenceRule: payload.recurrenceRule === undefined ? undefined : (payload.recurrenceRule as string | null),
    recurrenceEndAt: payload.recurrenceEndAt === undefined ? undefined : payload.recurrenceEndAt ? new Date(String(payload.recurrenceEndAt)) : null,
    reminderMinutes: validateEventReminderMinutes(payload.reminderMinutes)
  };
}

export type RecurrenceScope = "single" | "all";

export function parseRecurrenceScope(value: unknown): RecurrenceScope {
  return String(value ?? "all") === "single" ? "single" : "all";
}

function parseOccurrenceStart(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Apply an edit to one occurrence of a series by detaching it into its own row.
 *
 * The occurrence's slot is added to the master's exception list so the series no
 * longer generates it, and a child row carrying the edited values takes its
 * place. Returns null when the request does not describe a single-occurrence
 * edit, so the caller can fall through to an ordinary update.
 */
export async function detachOccurrence(
  organizationId: string,
  eventId: string,
  occurrenceStartValue: unknown,
  overrides: Record<string, unknown>
) {
  const occurrenceStart = parseOccurrenceStart(occurrenceStartValue);
  if (!occurrenceStart) throw new CalendarValidationError("Editing a single occurrence needs the occurrence date.", 400, "occurrenceStart");

  const master = await prisma.event.findFirst({ where: { id: eventId, organizationId } });
  if (!master) throw new CalendarValidationError("Record not found.", 404);
  // An already-detached override is just an ordinary event; edit it in place.
  if (master.recurrenceParentId || !parseRecurrenceRule(master.recurrenceRule)) return null;

  const durationMs = master.endAt.getTime() - master.startAt.getTime();
  const {
    id: _id,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    recurrenceRule: _rule,
    recurrenceEndAt: _end,
    recurrenceExceptionDates: _exceptions,
    ...inherited
  } = master;

  // The update payload marks untouched columns as `undefined`; spreading those
  // would blank out the values inherited from the series, so drop them first.
  const changes = Object.fromEntries(Object.entries(overrides).filter(([, value]) => value !== undefined));

  return prisma.$transaction(async (tx) => {
    const child = await tx.event.create({
      data: {
        ...inherited,
        startAt: occurrenceStart,
        endAt: new Date(occurrenceStart.getTime() + durationMs),
        ...changes,
        recurrenceRule: null,
        recurrenceEndAt: null,
        recurrenceExceptionDates: [],
        recurrenceParentId: master.id,
        recurrenceOriginalStart: occurrenceStart
      }
    });
    await tx.event.update({
      where: { id: master.id },
      data: { recurrenceExceptionDates: { push: occurrenceStart } }
    });
    return child;
  });
}

/**
 * Remove one occurrence of a series without touching the rest.
 * Returns false when the target is not a recurring master, so the caller deletes normally.
 */
export async function excludeOccurrence(organizationId: string, eventId: string, occurrenceStartValue: unknown) {
  const occurrenceStart = parseOccurrenceStart(occurrenceStartValue);
  if (!occurrenceStart) throw new CalendarValidationError("Deleting a single occurrence needs the occurrence date.", 400, "occurrenceStart");

  const master = await prisma.event.findFirst({ where: { id: eventId, organizationId } });
  if (!master) throw new CalendarValidationError("Record not found.", 404);
  if (master.recurrenceParentId || !parseRecurrenceRule(master.recurrenceRule)) return false;

  await prisma.$transaction(async (tx) => {
    await tx.event.update({ where: { id: master.id }, data: { recurrenceExceptionDates: { push: occurrenceStart } } });
    // Drop any override that was carved out of this same slot.
    await tx.event.deleteMany({ where: { organizationId, recurrenceParentId: master.id, recurrenceOriginalStart: occurrenceStart } });
  });
  return true;
}

export async function loadCalendarItems(
  organizationId: string,
  userId: string,
  options: { start: Date; end: Date; timeZone: string; includeTasks?: boolean; includeVideoCalls?: boolean }
): Promise<CalendarItem[]> {
  const { start, end, timeZone } = options;

  const [events, sources] = await Promise.all([
    loadEventsForWindow(organizationId, userId, start, end),
    prisma.calendarSource.findMany({ where: { organizationId, userId }, select: { id: true, color: true } })
  ]);

  const colorById = new Map(sources.map((source) => [source.id, source.color]));
  const colorForSource = (calendarSourceId: string | null) => (calendarSourceId ? colorById.get(calendarSourceId) ?? DEFAULT_CALENDAR_COLOR : DEFAULT_CALENDAR_COLOR);

  const items = expandEventsToItems(events, start, end, timeZone, { colorForSource, toRecord: serialize });

  const [tasks, videoCalls] = await Promise.all([
    options.includeTasks ? loadTaskItems(organizationId, start, end) : Promise.resolve([]),
    options.includeVideoCalls ? loadVideoCallItems(organizationId, start, end) : Promise.resolve([])
  ]);

  return [...items, ...tasks, ...videoCalls].sort((left, right) => left.startAt.localeCompare(right.startAt));
}
