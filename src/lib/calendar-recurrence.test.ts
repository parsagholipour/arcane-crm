import assert from "node:assert/strict";
import test from "node:test";

import {
  describeRecurrence,
  expandRecurrence,
  formatRecurrenceRule,
  parseRecurrenceRule
} from "@/lib/calendar-recurrence";

const TZ = "America/New_York";

function starts(occurrences: { startAt: Date }[]) {
  return occurrences.map((occurrence) => occurrence.startAt.toISOString());
}

function series(rule: string | null, startAt: string, endAt: string, extra: Record<string, unknown> = {}) {
  return { startAt: new Date(startAt), endAt: new Date(endAt), recurrenceRule: rule, ...extra };
}

test("parseRecurrenceRule reads frequency, interval, by-day, count and until", () => {
  assert.deepEqual(parseRecurrenceRule("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE"), {
    freq: "WEEKLY",
    interval: 2,
    byDay: ["MO", "WE"],
    count: null,
    until: null
  });
  assert.equal(parseRecurrenceRule("FREQ=DAILY;COUNT=5")?.count, 5);
  assert.equal(parseRecurrenceRule("RRULE:FREQ=MONTHLY")?.freq, "MONTHLY");
  assert.equal(
    parseRecurrenceRule("FREQ=DAILY;UNTIL=20260731T235959Z")?.until?.toISOString(),
    "2026-07-31T23:59:59.000Z"
  );
});

test("parseRecurrenceRule rejects unsupported or malformed rules instead of throwing", () => {
  assert.equal(parseRecurrenceRule(""), null);
  assert.equal(parseRecurrenceRule(null), null);
  assert.equal(parseRecurrenceRule("FREQ=HOURLY"), null);
  assert.equal(parseRecurrenceRule("FREQ=WEEKLY;BYDAY=XX"), null);
  assert.equal(parseRecurrenceRule("FREQ=DAILY;INTERVAL=0"), null);
  assert.equal(parseRecurrenceRule("FREQ=DAILY;INTERVAL=abc"), null);
  // COUNT and UNTIL are mutually exclusive in RFC 5545.
  assert.equal(parseRecurrenceRule("FREQ=DAILY;COUNT=3;UNTIL=20260731T000000Z"), null);
});

test("parseRecurrenceRule ignores BYDAY outside weekly recurrence", () => {
  assert.deepEqual(parseRecurrenceRule("FREQ=MONTHLY;BYDAY=MO")?.byDay, []);
});

test("formatRecurrenceRule round-trips through parseRecurrenceRule", () => {
  const rule = formatRecurrenceRule({ freq: "WEEKLY", interval: 2, byDay: ["MO", "WE"] });
  assert.equal(rule, "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE");
  assert.deepEqual(parseRecurrenceRule(rule)?.byDay, ["MO", "WE"]);
  assert.equal(formatRecurrenceRule({ freq: "DAILY", interval: 1 }), "FREQ=DAILY");
});

test("describeRecurrence produces a readable summary", () => {
  assert.equal(describeRecurrence("FREQ=DAILY"), "Every day");
  assert.equal(describeRecurrence("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE"), "Every 2 weeks on Mon, Wed");
  assert.equal(describeRecurrence("FREQ=MONTHLY;COUNT=6"), "Every month, 6 times");
  assert.equal(describeRecurrence("garbage"), "");
});

test("expandRecurrence returns the single occurrence for a non-recurring event", () => {
  const occurrences = expandRecurrence(
    series(null, "2026-07-15T13:00:00.000Z", "2026-07-15T14:00:00.000Z"),
    new Date("2026-07-01T00:00:00.000Z"),
    new Date("2026-08-01T00:00:00.000Z"),
    TZ
  );
  assert.deepEqual(starts(occurrences), ["2026-07-15T13:00:00.000Z"]);
});

test("expandRecurrence excludes a non-recurring event outside the window", () => {
  const occurrences = expandRecurrence(
    series(null, "2026-09-15T13:00:00.000Z", "2026-09-15T14:00:00.000Z"),
    new Date("2026-07-01T00:00:00.000Z"),
    new Date("2026-08-01T00:00:00.000Z"),
    TZ
  );
  assert.equal(occurrences.length, 0);
});

test("expandRecurrence walks a weekly BYDAY series across a month", () => {
  // 2026-07-01 is a Wednesday; 09:00 in New York is 13:00Z during EDT.
  const occurrences = expandRecurrence(
    series("FREQ=WEEKLY;BYDAY=MO,WE", "2026-07-01T13:00:00.000Z", "2026-07-01T14:00:00.000Z"),
    new Date("2026-07-01T00:00:00.000Z"),
    new Date("2026-07-16T00:00:00.000Z"),
    TZ
  );
  assert.deepEqual(starts(occurrences), [
    "2026-07-01T13:00:00.000Z",
    "2026-07-06T13:00:00.000Z",
    "2026-07-08T13:00:00.000Z",
    "2026-07-13T13:00:00.000Z",
    "2026-07-15T13:00:00.000Z"
  ]);
});

test("expandRecurrence honours INTERVAL", () => {
  const occurrences = expandRecurrence(
    series("FREQ=WEEKLY;INTERVAL=2", "2026-07-01T13:00:00.000Z", "2026-07-01T14:00:00.000Z"),
    new Date("2026-07-01T00:00:00.000Z"),
    new Date("2026-08-15T00:00:00.000Z"),
    TZ
  );
  assert.deepEqual(starts(occurrences), [
    "2026-07-01T13:00:00.000Z",
    "2026-07-15T13:00:00.000Z",
    "2026-07-29T13:00:00.000Z",
    "2026-08-12T13:00:00.000Z"
  ]);
});

test("expandRecurrence stops at COUNT", () => {
  const occurrences = expandRecurrence(
    series("FREQ=DAILY;COUNT=3", "2026-07-01T13:00:00.000Z", "2026-07-01T14:00:00.000Z"),
    new Date("2026-07-01T00:00:00.000Z"),
    new Date("2026-08-01T00:00:00.000Z"),
    TZ
  );
  assert.deepEqual(starts(occurrences), [
    "2026-07-01T13:00:00.000Z",
    "2026-07-02T13:00:00.000Z",
    "2026-07-03T13:00:00.000Z"
  ]);
});

test("expandRecurrence counts occurrences, not weeks, when COUNT meets BYDAY", () => {
  const occurrences = expandRecurrence(
    series("FREQ=WEEKLY;COUNT=3;BYDAY=MO,WE", "2026-07-01T13:00:00.000Z", "2026-07-01T14:00:00.000Z"),
    new Date("2026-07-01T00:00:00.000Z"),
    new Date("2026-08-01T00:00:00.000Z"),
    TZ
  );
  assert.deepEqual(starts(occurrences), [
    "2026-07-01T13:00:00.000Z",
    "2026-07-06T13:00:00.000Z",
    "2026-07-08T13:00:00.000Z"
  ]);
});

test("expandRecurrence stops at UNTIL", () => {
  const occurrences = expandRecurrence(
    series("FREQ=DAILY;UNTIL=20260703T235959Z", "2026-07-01T13:00:00.000Z", "2026-07-01T14:00:00.000Z"),
    new Date("2026-07-01T00:00:00.000Z"),
    new Date("2026-08-01T00:00:00.000Z"),
    TZ
  );
  assert.equal(occurrences.length, 3);
});

test("expandRecurrence stops at recurrenceEndAt", () => {
  const occurrences = expandRecurrence(
    series("FREQ=DAILY", "2026-07-01T13:00:00.000Z", "2026-07-01T14:00:00.000Z", {
      recurrenceEndAt: new Date("2026-07-04T00:00:00.000Z")
    }),
    new Date("2026-07-01T00:00:00.000Z"),
    new Date("2026-08-01T00:00:00.000Z"),
    TZ
  );
  assert.deepEqual(starts(occurrences), [
    "2026-07-01T13:00:00.000Z",
    "2026-07-02T13:00:00.000Z",
    "2026-07-03T13:00:00.000Z"
  ]);
});

test("expandRecurrence removes exception dates", () => {
  const occurrences = expandRecurrence(
    series("FREQ=DAILY;COUNT=4", "2026-07-01T13:00:00.000Z", "2026-07-01T14:00:00.000Z", {
      recurrenceExceptionDates: [new Date("2026-07-02T13:00:00.000Z"), new Date("2026-07-03T13:00:00.000Z")]
    }),
    new Date("2026-07-01T00:00:00.000Z"),
    new Date("2026-08-01T00:00:00.000Z"),
    TZ
  );
  assert.deepEqual(starts(occurrences), ["2026-07-01T13:00:00.000Z", "2026-07-04T13:00:00.000Z"]);
});

test("expandRecurrence clamps a monthly series anchored on the 31st", () => {
  const occurrences = expandRecurrence(
    series("FREQ=MONTHLY;COUNT=4", "2026-01-31T14:00:00.000Z", "2026-01-31T15:00:00.000Z"),
    new Date("2026-01-01T00:00:00.000Z"),
    new Date("2026-06-01T00:00:00.000Z"),
    TZ
  );
  // February clamps to the 28th; the anchor day is not lost for later months.
  assert.deepEqual(starts(occurrences), [
    "2026-01-31T14:00:00.000Z",
    "2026-02-28T14:00:00.000Z",
    "2026-03-31T13:00:00.000Z",
    "2026-04-30T13:00:00.000Z"
  ]);
});

test("expandRecurrence preserves wall-clock time across a DST transition", () => {
  // DST ends 2026-11-01 in New York: 09:00 local is 13:00Z before and 14:00Z after.
  const occurrences = expandRecurrence(
    series("FREQ=WEEKLY", "2026-10-28T13:00:00.000Z", "2026-10-28T14:00:00.000Z"),
    new Date("2026-10-01T00:00:00.000Z"),
    new Date("2026-11-20T00:00:00.000Z"),
    TZ
  );
  assert.deepEqual(starts(occurrences), [
    "2026-10-28T13:00:00.000Z",
    "2026-11-04T14:00:00.000Z",
    "2026-11-11T14:00:00.000Z",
    "2026-11-18T14:00:00.000Z"
  ]);
});

test("expandRecurrence reaches a window far after a long-running series start", () => {
  const occurrences = expandRecurrence(
    series("FREQ=DAILY", "2020-01-01T14:00:00.000Z", "2020-01-01T15:00:00.000Z"),
    new Date("2026-07-20T00:00:00.000Z"),
    new Date("2026-07-23T00:00:00.000Z"),
    TZ
  );
  assert.deepEqual(starts(occurrences), [
    "2026-07-20T13:00:00.000Z",
    "2026-07-21T13:00:00.000Z",
    "2026-07-22T13:00:00.000Z"
  ]);
});

test("expandRecurrence keeps the occurrence duration of the series", () => {
  const [occurrence] = expandRecurrence(
    series("FREQ=DAILY;COUNT=2", "2026-07-01T13:00:00.000Z", "2026-07-01T14:30:00.000Z"),
    new Date("2026-07-01T00:00:00.000Z"),
    new Date("2026-07-02T00:00:00.000Z"),
    TZ
  );
  assert.equal(occurrence.endAt.getTime() - occurrence.startAt.getTime(), 90 * 60 * 1000);
  assert.equal(occurrence.originalStart.toISOString(), "2026-07-01T13:00:00.000Z");
});

test("expandRecurrence includes an occurrence already in progress at the window start", () => {
  const occurrences = expandRecurrence(
    series("FREQ=DAILY", "2026-07-01T13:00:00.000Z", "2026-07-01T15:00:00.000Z"),
    new Date("2026-07-02T14:00:00.000Z"),
    new Date("2026-07-02T14:30:00.000Z"),
    TZ
  );
  assert.deepEqual(starts(occurrences), ["2026-07-02T13:00:00.000Z"]);
});
