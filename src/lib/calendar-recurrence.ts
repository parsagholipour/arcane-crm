import { daysInMonth, utcToZonedFormValues, utcToZonedParts, zonedTimeToUtc } from "@/lib/calendar";

export const RECURRENCE_FREQUENCIES = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"] as const;
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];

export const RECURRENCE_DAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;
export type RecurrenceDay = (typeof RECURRENCE_DAYS)[number];

/** Hard ceiling on generated occurrences so a malformed rule cannot hang a request. */
export const MAX_OCCURRENCES = 1000;

export type RecurrenceParts = {
  freq: RecurrenceFrequency;
  interval: number;
  byDay: RecurrenceDay[];
  count: number | null;
  until: Date | null;
};

export type RecurrenceOccurrence = {
  startAt: Date;
  endAt: Date;
  /** The series slot this occurrence fills — the identity used for exceptions and overrides. */
  originalStart: Date;
  index: number;
};

const DAY_LABELS: Record<RecurrenceDay, string> = {
  SU: "Sun",
  MO: "Mon",
  TU: "Tue",
  WE: "Wed",
  TH: "Thu",
  FR: "Fri",
  SA: "Sat"
};

function isFrequency(value: string): value is RecurrenceFrequency {
  return (RECURRENCE_FREQUENCIES as readonly string[]).includes(value);
}

function isDay(value: string): value is RecurrenceDay {
  return (RECURRENCE_DAYS as readonly string[]).includes(value);
}

/** Parse the RFC 5545 RRULE subset this calendar supports. Returns null for anything else. */
export function parseRecurrenceRule(rule: unknown): RecurrenceParts | null {
  const text = String(rule ?? "")
    .trim()
    .replace(/^RRULE:/i, "");
  if (!text) return null;

  const pairs = new Map<string, string>();
  for (const segment of text.split(";")) {
    const [key, value] = segment.split("=");
    if (!key || value === undefined) continue;
    pairs.set(key.trim().toUpperCase(), value.trim());
  }

  const freq = String(pairs.get("FREQ") ?? "").toUpperCase();
  if (!isFrequency(freq)) return null;

  const intervalText = pairs.get("INTERVAL");
  const interval = intervalText === undefined ? 1 : Number(intervalText);
  if (!Number.isInteger(interval) || interval < 1 || interval > 366) return null;

  const byDay = (pairs.get("BYDAY") ?? "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter((value) => value.length > 0);
  if (byDay.some((value) => !isDay(value))) return null;
  // BYDAY is only meaningful for weekly recurrence in this subset.
  const days = freq === "WEEKLY" ? (byDay as RecurrenceDay[]) : [];

  const countText = pairs.get("COUNT");
  const count = countText === undefined ? null : Number(countText);
  if (count !== null && (!Number.isInteger(count) || count < 1 || count > MAX_OCCURRENCES)) return null;

  const untilText = pairs.get("UNTIL");
  let until: Date | null = null;
  if (untilText !== undefined) {
    until = parseUntil(untilText);
    if (!until || Number.isNaN(until.getTime())) return null;
  }

  if (count !== null && until !== null) return null;

  return { freq, interval, byDay: days, count, until };
}

function parseUntil(value: string) {
  const compact = value.trim();
  // Basic form: 20260731T235959Z or 20260731
  const withTime = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/.exec(compact);
  if (withTime) {
    const [, year, month, day, hour, minute, second] = withTime;
    return new Date(
      Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second))
    );
  }
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(compact);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 23, 59, 59));
  }
  const parsed = new Date(compact);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatRecurrenceRule(parts: {
  freq: RecurrenceFrequency;
  interval?: number;
  byDay?: RecurrenceDay[];
  count?: number | null;
  until?: Date | string | null;
}) {
  const segments = [`FREQ=${parts.freq}`];
  const interval = parts.interval ?? 1;
  if (interval > 1) segments.push(`INTERVAL=${interval}`);
  if (parts.freq === "WEEKLY" && parts.byDay && parts.byDay.length > 0) segments.push(`BYDAY=${parts.byDay.join(",")}`);
  if (parts.count) segments.push(`COUNT=${parts.count}`);
  else if (parts.until) {
    const until = parts.until instanceof Date ? parts.until : new Date(String(parts.until));
    if (!Number.isNaN(until.getTime()))
      segments.push(
        `UNTIL=${until
          .toISOString()
          .replace(/[-:]/g, "")
          .replace(/\.\d{3}Z$/, "Z")}`
      );
  }
  return segments.join(";");
}

/** Human-readable summary shown in the event form and detail popover. */
export function describeRecurrence(rule: unknown, timeZone = "UTC") {
  const parts = parseRecurrenceRule(rule);
  if (!parts) return "";
  const { freq, interval, byDay, count, until } = parts;
  const unit = freq === "DAILY" ? "day" : freq === "WEEKLY" ? "week" : freq === "MONTHLY" ? "month" : "year";
  let summary = interval === 1 ? `Every ${unit}` : `Every ${interval} ${unit}s`;
  if (freq === "WEEKLY" && byDay.length > 0) summary += ` on ${byDay.map((day) => DAY_LABELS[day]).join(", ")}`;
  if (count) summary += `, ${count} times`;
  else if (until) summary += `, until ${utcToZonedFormValues(until, timeZone).date}`;
  return summary;
}

function toDayCode(date: Date, timeZone: string): RecurrenceDay {
  const parts = utcToZonedParts(date, timeZone);
  // Date.UTC on the zoned wall-clock fields yields the correct weekday for that zone.
  return RECURRENCE_DAYS[new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay()];
}

type RecurrenceSource = {
  startAt: Date | string;
  endAt: Date | string;
  recurrenceRule?: unknown;
  recurrenceEndAt?: Date | string | null;
  recurrenceExceptionDates?: (Date | string)[] | null;
};

/**
 * Expand a recurring event into the occurrences that intersect [rangeStart, rangeEnd].
 *
 * Occurrences are advanced in wall-clock terms within `timeZone`, so a 09:00
 * weekly meeting stays at 09:00 across a DST transition rather than drifting.
 * A non-recurring event yields its single occurrence when it lands in range.
 */
export function expandRecurrence(
  event: RecurrenceSource,
  rangeStart: Date,
  rangeEnd: Date,
  timeZone: string
): RecurrenceOccurrence[] {
  const seriesStart = event.startAt instanceof Date ? event.startAt : new Date(String(event.startAt));
  const seriesEnd = event.endAt instanceof Date ? event.endAt : new Date(String(event.endAt));
  if (Number.isNaN(seriesStart.getTime()) || Number.isNaN(seriesEnd.getTime())) return [];

  const durationMs = Math.max(seriesEnd.getTime() - seriesStart.getTime(), 0);
  const parts = parseRecurrenceRule(event.recurrenceRule);

  if (!parts) {
    if (seriesEnd <= rangeStart || seriesStart >= rangeEnd) return [];
    return [{ startAt: seriesStart, endAt: seriesEnd, originalStart: seriesStart, index: 0 }];
  }

  const exceptions = new Set(
    (event.recurrenceExceptionDates ?? []).map((value) =>
      (value instanceof Date ? value : new Date(String(value))).getTime()
    )
  );
  const recurrenceEndAt = event.recurrenceEndAt
    ? event.recurrenceEndAt instanceof Date
      ? event.recurrenceEndAt
      : new Date(String(event.recurrenceEndAt))
    : null;
  const hardEnd =
    [parts.until, recurrenceEndAt]
      .filter((value): value is Date => Boolean(value) && !Number.isNaN(value!.getTime()))
      .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;

  const anchor = utcToZonedParts(seriesStart, timeZone);
  const timeText = `${String(anchor.hour).padStart(2, "0")}:${String(anchor.minute).padStart(2, "0")}`;
  const weeklyDays =
    parts.freq === "WEEKLY" && parts.byDay.length > 0 ? parts.byDay : [toDayCode(seriesStart, timeZone)];

  const occurrences: RecurrenceOccurrence[] = [];
  let emitted = 0;
  let index = 0;

  // A long-running series would otherwise burn the whole step budget walking from
  // its start to the requested window. COUNT rules must still be walked from the
  // beginning for `emitted` to be accurate, but they are inherently bounded.
  const firstStep = parts.count === null ? fastForwardStep(parts, seriesStart, rangeStart) : 0;

  for (let step = firstStep; step < firstStep + MAX_OCCURRENCES; step += 1) {
    const slots = slotsForStep(parts, anchor, weeklyDays, step, timeText, timeZone);
    if (slots.length === 0) continue;

    let allPastRange = true;
    for (const slot of slots) {
      if (slot.getTime() < seriesStart.getTime()) continue;
      if (hardEnd && slot.getTime() > hardEnd.getTime()) continue;
      if (parts.count !== null && emitted >= parts.count) break;

      emitted += 1;
      index += 1;
      if (slot.getTime() <= rangeEnd.getTime()) allPastRange = false;
      if (exceptions.has(slot.getTime())) continue;

      const occurrenceEnd = new Date(slot.getTime() + durationMs);
      if (occurrenceEnd > rangeStart && slot < rangeEnd) {
        occurrences.push({ startAt: slot, endAt: occurrenceEnd, originalStart: slot, index: index - 1 });
      }
    }

    if (parts.count !== null && emitted >= parts.count) break;
    const stepStart = slots[0];
    if (hardEnd && stepStart.getTime() > hardEnd.getTime()) break;
    if (allPastRange && stepStart.getTime() > rangeEnd.getTime()) break;
  }

  return occurrences.sort((left, right) => left.startAt.getTime() - right.startAt.getTime());
}

/** Lower bound on the step that can first reach `rangeStart`, biased one step early for safety. */
function fastForwardStep(parts: RecurrenceParts, seriesStart: Date, rangeStart: Date) {
  if (rangeStart <= seriesStart) return 0;
  const elapsedMs = rangeStart.getTime() - seriesStart.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const perStep =
    parts.freq === "DAILY"
      ? parts.interval * dayMs
      : parts.freq === "WEEKLY"
        ? parts.interval * 7 * dayMs
        : parts.freq === "MONTHLY"
          ? parts.interval * 28 * dayMs
          : parts.interval * 365 * dayMs;
  return Math.max(0, Math.floor(elapsedMs / perStep) - 1);
}

function slotsForStep(
  parts: RecurrenceParts,
  anchor: { year: number; month: number; day: number },
  weeklyDays: RecurrenceDay[],
  step: number,
  timeText: string,
  timeZone: string
): Date[] {
  const { freq, interval } = parts;

  if (freq === "DAILY") {
    return [dateAtOffset(anchor, { days: step * interval }, timeText, timeZone)];
  }

  if (freq === "WEEKLY") {
    // Walk from the start of the anchor's week so BYDAY lands on the right dates.
    const anchorDayIndex = RECURRENCE_DAYS.indexOf(toDayCodeFromParts(anchor));
    return weeklyDays
      .map((day) => RECURRENCE_DAYS.indexOf(day) - anchorDayIndex + step * interval * 7)
      .sort((left, right) => left - right)
      .map((offset) => dateAtOffset(anchor, { days: offset }, timeText, timeZone));
  }

  if (freq === "MONTHLY") {
    const monthIndex = anchor.month - 1 + step * interval;
    const year = anchor.year + Math.floor(monthIndex / 12);
    const month = ((monthIndex % 12) + 12) % 12;
    // Clamp so a series anchored on the 31st still fires in short months.
    const day = Math.min(anchor.day, daysInMonth(year, month));
    return [zonedTimeToUtc(dateText(year, month + 1, day), timeText, timeZone)];
  }

  const year = anchor.year + step * interval;
  const day = Math.min(anchor.day, daysInMonth(year, anchor.month - 1));
  return [zonedTimeToUtc(dateText(year, anchor.month, day), timeText, timeZone)];
}

function toDayCodeFromParts(anchor: { year: number; month: number; day: number }): RecurrenceDay {
  return RECURRENCE_DAYS[new Date(Date.UTC(anchor.year, anchor.month - 1, anchor.day)).getUTCDay()];
}

function dateAtOffset(
  anchor: { year: number; month: number; day: number },
  offset: { days: number },
  timeText: string,
  timeZone: string
) {
  const shifted = new Date(Date.UTC(anchor.year, anchor.month - 1, anchor.day));
  shifted.setUTCDate(shifted.getUTCDate() + offset.days);
  return zonedTimeToUtc(
    dateText(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate()),
    timeText,
    timeZone
  );
}

function dateText(year: number, month: number, day: number) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
