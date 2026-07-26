import type { RecordData } from "@/lib/crm-types";

export const MINUTES_PER_DAY = 1440;
export const SNAP_MINUTES = 15;
export const MIN_ITEM_MINUTES = 20;

export type CalendarItemKind = "event" | "task" | "videoCall";

export type CalendarItem = {
  kind: CalendarItemKind;
  id: string;
  occurrenceKey: string;
  title: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  color: string;
  recurring: boolean;
  occurrenceStart?: string | null;
  record: RecordData;
};

export type ZonedParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string) {
  const cached = partsFormatterCache.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });
  partsFormatterCache.set(timeZone, formatter);
  return formatter;
}

/** Wall-clock fields of an instant as observed in `timeZone`. */
export function utcToZonedParts(value: unknown, timeZone: string): ZonedParts {
  const date = value instanceof Date ? value : new Date(String(value));
  const parts = Object.fromEntries(
    partsFormatter(timeZone)
      .formatToParts(date)
      .map((part) => [part.type, part.value])
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    // Intl renders midnight as "24" in some ICU builds under hourCycle h23.
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second)
  };
}

/** Milliseconds `timeZone` is ahead of UTC at `instant`. */
export function timeZoneOffsetMs(instant: Date, timeZone: string) {
  const parts = utcToZonedParts(instant, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * Convert a wall-clock date/time in `timeZone` to the UTC instant it names.
 *
 * Two passes: guess by treating the wall time as UTC and subtracting the offset
 * observed there, then re-derive the offset at the guessed instant so DST
 * transitions land on the correct side.
 */
export function zonedTimeToUtc(dateText: string, timeText: string, timeZone: string): Date {
  const [year, month, day] = String(dateText).split("-").map(Number);
  const [hour = 0, minute = 0] = String(timeText || "00:00")
    .split(":")
    .map(Number);
  if (!year || !month || !day) return new Date(NaN);
  const naive = Date.UTC(year, month - 1, day, hour, minute, 0);
  const firstPass = new Date(naive - timeZoneOffsetMs(new Date(naive), timeZone));
  const secondOffset = timeZoneOffsetMs(firstPass, timeZone);
  return new Date(naive - secondOffset);
}

/** Convert an instant into the `{ date, time }` pair a form would show in `timeZone`. */
export function utcToZonedFormValues(value: unknown, timeZone: string) {
  const parts = utcToZonedParts(value, timeZone);
  return {
    date: `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`,
    time: `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`
  };
}

export function minutesFromMidnight(value: unknown, timeZone: string) {
  const parts = utcToZonedParts(value, timeZone);
  return parts.hour * 60 + parts.minute;
}

export function sameDateInTimeZone(value: unknown, day: Date, timeZone: string) {
  const parts = utcToZonedParts(value, timeZone);
  return parts.year === day.getFullYear() && parts.month === day.getMonth() + 1 && parts.day === day.getDate();
}

export function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** `weekStartsOn` is 0 (Sunday) through 6 (Saturday). */
export function startOfWeek(date: Date, weekStartsOn = 0) {
  const copy = new Date(date);
  copy.setHours(12, 0, 0, 0);
  const offset = (copy.getDay() - weekStartsOn + 7) % 7;
  copy.setDate(copy.getDate() - offset);
  return copy;
}

export function addCalendarDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function addCalendarMonths(date: Date, months: number) {
  const copy = new Date(date);
  const targetDay = copy.getDate();
  copy.setDate(1);
  copy.setMonth(copy.getMonth() + months);
  // Clamp so 31 Jan + 1 month lands on the last day of February, not 3 March.
  copy.setDate(Math.min(targetDay, daysInMonth(copy.getFullYear(), copy.getMonth())));
  return copy;
}

export function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** 42-cell month grid starting on `weekStartsOn`. */
export function getMonthDays(date: Date, weekStartsOn = 0) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1, 12);
  const gridStart = startOfWeek(first, weekStartsOn);
  return Array.from({ length: 42 }, (_, index) => addCalendarDays(gridStart, index));
}

export function sameDate(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function sameMonth(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

export function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function minutesToTimeText(minutes: number) {
  const clamped = Math.max(0, Math.min(MINUTES_PER_DAY - 1, Math.round(minutes)));
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}

export function timeTextToMinutes(time: string) {
  const [hour = 0, minute = 0] = String(time || "00:00")
    .split(":")
    .map(Number);
  return hour * 60 + minute;
}

export function snapMinutes(minutes: number, step = SNAP_MINUTES) {
  return Math.round(minutes / step) * step;
}

/** One hour later, clamped to 23:59 so late-evening slots never wrap past midnight. */
export function nextTimeSlot(time: string) {
  return minutesToTimeText(Math.min(timeTextToMinutes(time) + 60, MINUTES_PER_DAY - 1));
}

export function monthYearLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date);
}

export function monthDayYearLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(date);
}

export function fullDateLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(
    date
  );
}

export function shortDayLabel(date: Date) {
  return `${new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date).toUpperCase()} ${date.getDate()}`;
}

export function weekdayHeaderLabels(weekStartsOn = 0) {
  const base = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return Array.from({ length: 7 }, (_, index) => base[(index + weekStartsOn) % 7]);
}

export function calendarTimeRange(item: { allDay?: unknown; startAt?: unknown; endAt?: unknown }, timeZone: string) {
  if (item.allDay) return "All day";
  const formatter = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone
  });
  return `${formatter.format(new Date(String(item.startAt)))}-${formatter.format(new Date(String(item.endAt)))}`;
}

export type PositionedItem<T> = {
  item: T;
  startMinutes: number;
  endMinutes: number;
  topPct: number;
  heightPct: number;
  columnIndex: number;
  columnCount: number;
};

type Span<T> = { item: T; startMinutes: number; endMinutes: number; columnIndex: number };

/**
 * Position timed items within a single day column and resolve overlaps.
 *
 * Items are clipped to `day` so multi-day events render their portion of each
 * column. Overlapping items are grouped into clusters and each is assigned the
 * lowest column free at its start, so a cluster of N mutually-overlapping items
 * renders as N side-by-side lanes.
 */
export function layoutDayItems<T extends { startAt: string; endAt: string; allDay?: boolean }>(
  items: T[],
  day: Date,
  timeZone: string
): PositionedItem<T>[] {
  const spans: Span<T>[] = [];

  for (const item of items) {
    if (item.allDay) continue;
    const start = new Date(String(item.startAt));
    const end = new Date(String(item.endAt));
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;

    const startsToday = sameDateInTimeZone(start, day, timeZone);
    const endsToday = sameDateInTimeZone(end, day, timeZone);
    // A span also covers this day when it straddles it entirely.
    const covers =
      startsToday ||
      endsToday ||
      (start < dayBoundary(day, timeZone, 0) && end > dayBoundary(day, timeZone, MINUTES_PER_DAY));
    if (!covers) continue;

    const startMinutes = startsToday ? minutesFromMidnight(start, timeZone) : 0;
    const rawEnd = endsToday ? minutesFromMidnight(end, timeZone) : MINUTES_PER_DAY;
    // Overlap is computed from the real end; the minimum height is applied at render
    // time only, so back-to-back short events stay stacked rather than side by side.
    spans.push({
      item,
      startMinutes,
      endMinutes: Math.min(Math.max(rawEnd, startMinutes), MINUTES_PER_DAY),
      columnIndex: 0
    });
  }

  spans.sort((left, right) => left.startMinutes - right.startMinutes || right.endMinutes - left.endMinutes);

  const positioned: PositionedItem<T>[] = [];
  let cluster: Span<T>[] = [];
  let clusterEnd = -1;

  const flush = () => {
    if (cluster.length === 0) return;
    const columnCount = Math.max(...cluster.map((span) => span.columnIndex)) + 1;
    for (const span of cluster) {
      positioned.push({
        item: span.item,
        startMinutes: span.startMinutes,
        endMinutes: span.endMinutes,
        topPct: (span.startMinutes / MINUTES_PER_DAY) * 100,
        heightPct: (Math.max(span.endMinutes - span.startMinutes, MIN_ITEM_MINUTES) / MINUTES_PER_DAY) * 100,
        columnIndex: span.columnIndex,
        columnCount
      });
    }
    cluster = [];
    clusterEnd = -1;
  };

  for (const span of spans) {
    if (cluster.length > 0 && span.startMinutes >= clusterEnd) flush();
    // Lowest lane whose latest occupant has already finished.
    const laneEnds = new Map<number, number>();
    for (const existing of cluster)
      laneEnds.set(existing.columnIndex, Math.max(laneEnds.get(existing.columnIndex) ?? 0, existing.endMinutes));
    let lane = 0;
    while ((laneEnds.get(lane) ?? 0) > span.startMinutes) lane += 1;
    span.columnIndex = lane;
    cluster.push(span);
    clusterEnd = Math.max(clusterEnd, span.endMinutes);
  }
  flush();

  return positioned;
}

/** The instant `minutes` past midnight on `day` as observed in `timeZone`. */
export function dayBoundary(day: Date, timeZone: string, minutes: number) {
  return zonedTimeToUtc(toDateInputValue(day), minutesToTimeText(Math.min(minutes, MINUTES_PER_DAY - 1)), timeZone);
}

export function allDayItemsForDay<T extends { startAt: string; endAt: string; allDay?: boolean }>(
  items: T[],
  day: Date,
  timeZone: string
) {
  return items.filter((item) => {
    if (!item.allDay) return false;
    const start = new Date(String(item.startAt));
    const end = new Date(String(item.endAt));
    if (sameDateInTimeZone(start, day, timeZone)) return true;
    return start <= dayBoundary(day, timeZone, 0) && end >= dayBoundary(day, timeZone, MINUTES_PER_DAY - 1);
  });
}
