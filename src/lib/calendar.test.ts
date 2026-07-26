import assert from "node:assert/strict";
import test from "node:test";

import {
  addCalendarMonths,
  allDayItemsForDay,
  getMonthDays,
  layoutDayItems,
  minutesFromMidnight,
  nextTimeSlot,
  startOfWeek,
  toDateInputValue,
  utcToZonedFormValues,
  utcToZonedParts,
  weekdayHeaderLabels,
  zonedTimeToUtc
} from "@/lib/calendar";

function item(startAt: string, endAt: string, allDay = false) {
  return { startAt, endAt, allDay };
}

test("zonedTimeToUtc resolves wall time in a fixed-offset zone", () => {
  // Asia/Dubai is UTC+4 year round.
  assert.equal(zonedTimeToUtc("2026-03-10", "14:00", "Asia/Dubai").toISOString(), "2026-03-10T10:00:00.000Z");
  assert.equal(zonedTimeToUtc("2026-12-31", "23:30", "Asia/Dubai").toISOString(), "2026-12-31T19:30:00.000Z");
});

test("zonedTimeToUtc resolves wall time on both sides of a DST transition", () => {
  // US DST began 2026-03-08. 01:30 is EST (-05:00); 03:30 is EDT (-04:00).
  assert.equal(zonedTimeToUtc("2026-03-08", "01:30", "America/New_York").toISOString(), "2026-03-08T06:30:00.000Z");
  assert.equal(zonedTimeToUtc("2026-03-08", "03:30", "America/New_York").toISOString(), "2026-03-08T07:30:00.000Z");
  // And after DST ends on 2026-11-01.
  assert.equal(zonedTimeToUtc("2026-11-02", "09:00", "America/New_York").toISOString(), "2026-11-02T14:00:00.000Z");
});

test("zonedTimeToUtc round-trips through utcToZonedFormValues", () => {
  for (const timeZone of ["Asia/Dubai", "America/New_York", "Europe/Berlin", "Asia/Kolkata", "UTC"]) {
    for (const [date, time] of [
      ["2026-01-15", "09:15"],
      ["2026-06-30", "23:45"],
      ["2026-11-02", "00:00"]
    ]) {
      const instant = zonedTimeToUtc(date, time, timeZone);
      const back = utcToZonedFormValues(instant, timeZone);
      assert.deepEqual(back, { date, time }, `${timeZone} ${date} ${time}`);
    }
  }
});

test("zonedTimeToUtc keeps a half-hour-offset zone accurate", () => {
  // Asia/Kolkata is UTC+05:30.
  assert.equal(zonedTimeToUtc("2026-05-01", "10:00", "Asia/Kolkata").toISOString(), "2026-05-01T04:30:00.000Z");
});

test("utcToZonedParts reports midnight as hour zero", () => {
  const parts = utcToZonedParts("2026-05-01T20:00:00.000Z", "Asia/Dubai");
  assert.deepEqual(
    { year: parts.year, month: parts.month, day: parts.day, hour: parts.hour },
    { year: 2026, month: 5, day: 2, hour: 0 }
  );
});

test("minutesFromMidnight uses minute precision, not just the hour", () => {
  assert.equal(minutesFromMidnight("2026-05-01T05:15:00.000Z", "Asia/Dubai"), 9 * 60 + 15);
  assert.equal(minutesFromMidnight("2026-05-01T05:45:00.000Z", "Asia/Dubai"), 9 * 60 + 45);
});

test("nextTimeSlot adds an hour and clamps instead of wrapping past midnight", () => {
  assert.equal(nextTimeSlot("09:00"), "10:00");
  assert.equal(nextTimeSlot("09:45"), "10:45");
  assert.equal(nextTimeSlot("23:30"), "23:59");
  assert.equal(nextTimeSlot("23:59"), "23:59");
});

test("startOfWeek honours the configured first day", () => {
  const wednesday = new Date(2026, 6, 22, 12);
  assert.equal(toDateInputValue(startOfWeek(wednesday, 0)), "2026-07-19");
  assert.equal(toDateInputValue(startOfWeek(wednesday, 1)), "2026-07-20");
  assert.equal(toDateInputValue(startOfWeek(wednesday, 6)), "2026-07-18");
});

test("getMonthDays returns a 42-cell grid aligned to the week start", () => {
  const days = getMonthDays(new Date(2026, 6, 15, 12), 1);
  assert.equal(days.length, 42);
  assert.equal(days[0].getDay(), 1);
  assert.equal(toDateInputValue(days[0]), "2026-06-29");
});

test("weekdayHeaderLabels rotate with the week start", () => {
  assert.deepEqual(weekdayHeaderLabels(0)[0], "Sun");
  assert.deepEqual(weekdayHeaderLabels(1)[0], "Mon");
  assert.deepEqual(weekdayHeaderLabels(6), ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"]);
});

test("addCalendarMonths clamps instead of overflowing into the next month", () => {
  assert.equal(toDateInputValue(addCalendarMonths(new Date(2026, 0, 31, 12), 1)), "2026-02-28");
  assert.equal(toDateInputValue(addCalendarMonths(new Date(2026, 2, 31, 12), -1)), "2026-02-28");
  assert.equal(toDateInputValue(addCalendarMonths(new Date(2026, 4, 15, 12), 2)), "2026-07-15");
});

test("layoutDayItems positions items proportionally to their start and duration", () => {
  const day = new Date(2026, 4, 1, 12);
  const [positioned] = layoutDayItems(
    [item("2026-05-01T05:15:00.000Z", "2026-05-01T06:15:00.000Z")],
    day,
    "Asia/Dubai"
  );
  assert.equal(positioned.startMinutes, 9 * 60 + 15);
  assert.equal(positioned.endMinutes, 10 * 60 + 15);
  assert.ok(Math.abs(positioned.topPct - ((9 * 60 + 15) / 1440) * 100) < 1e-9);
  assert.ok(Math.abs(positioned.heightPct - (60 / 1440) * 100) < 1e-9);
});

test("layoutDayItems keeps disjoint items in a single column", () => {
  const day = new Date(2026, 4, 1, 12);
  const positioned = layoutDayItems(
    [
      item("2026-05-01T05:00:00.000Z", "2026-05-01T06:00:00.000Z"),
      item("2026-05-01T07:00:00.000Z", "2026-05-01T08:00:00.000Z")
    ],
    day,
    "Asia/Dubai"
  );
  assert.equal(positioned.length, 2);
  assert.deepEqual(
    positioned.map((entry) => entry.columnCount),
    [1, 1]
  );
  assert.deepEqual(
    positioned.map((entry) => entry.columnIndex),
    [0, 0]
  );
});

test("layoutDayItems splits two overlapping items into side-by-side lanes", () => {
  const day = new Date(2026, 4, 1, 12);
  const positioned = layoutDayItems(
    [
      item("2026-05-01T05:00:00.000Z", "2026-05-01T07:00:00.000Z"),
      item("2026-05-01T06:00:00.000Z", "2026-05-01T08:00:00.000Z")
    ],
    day,
    "Asia/Dubai"
  );
  assert.deepEqual(
    positioned.map((entry) => entry.columnIndex),
    [0, 1]
  );
  assert.deepEqual(
    positioned.map((entry) => entry.columnCount),
    [2, 2]
  );
});

test("layoutDayItems gives three mutually overlapping items three lanes", () => {
  const day = new Date(2026, 4, 1, 12);
  const positioned = layoutDayItems(
    [
      item("2026-05-01T05:00:00.000Z", "2026-05-01T09:00:00.000Z"),
      item("2026-05-01T05:30:00.000Z", "2026-05-01T08:00:00.000Z"),
      item("2026-05-01T06:00:00.000Z", "2026-05-01T07:00:00.000Z")
    ],
    day,
    "Asia/Dubai"
  );
  assert.deepEqual(
    positioned.map((entry) => entry.columnIndex),
    [0, 1, 2]
  );
  assert.deepEqual(
    positioned.map((entry) => entry.columnCount),
    [3, 3, 3]
  );
});

test("layoutDayItems reuses a lane once its occupant has ended", () => {
  const day = new Date(2026, 4, 1, 12);
  const positioned = layoutDayItems(
    [
      item("2026-05-01T05:00:00.000Z", "2026-05-01T11:00:00.000Z"),
      item("2026-05-01T05:30:00.000Z", "2026-05-01T06:30:00.000Z"),
      item("2026-05-01T07:00:00.000Z", "2026-05-01T08:00:00.000Z")
    ],
    day,
    "Asia/Dubai"
  );
  // The third item starts after the second ends, so it takes lane 1 again.
  assert.deepEqual(
    positioned.map((entry) => entry.columnIndex),
    [0, 1, 1]
  );
  assert.deepEqual(
    positioned.map((entry) => entry.columnCount),
    [2, 2, 2]
  );
});

test("layoutDayItems keeps back-to-back short items stacked in one lane", () => {
  const day = new Date(2026, 4, 1, 12);
  const positioned = layoutDayItems(
    [
      item("2026-05-01T05:00:00.000Z", "2026-05-01T05:15:00.000Z"),
      item("2026-05-01T05:15:00.000Z", "2026-05-01T05:30:00.000Z")
    ],
    day,
    "Asia/Dubai"
  );
  assert.deepEqual(
    positioned.map((entry) => entry.columnCount),
    [1, 1]
  );
  // Each still renders at the minimum readable height.
  assert.ok(positioned.every((entry) => entry.heightPct >= (20 / 1440) * 100));
});

test("layoutDayItems clips a multi-day item to the day column", () => {
  const day = new Date(2026, 4, 2, 12);
  const [positioned] = layoutDayItems(
    [item("2026-05-01T05:00:00.000Z", "2026-05-02T05:00:00.000Z")],
    day,
    "Asia/Dubai"
  );
  assert.equal(positioned.startMinutes, 0);
  assert.equal(positioned.endMinutes, 9 * 60);
});

test("layoutDayItems excludes all-day items and other days", () => {
  const day = new Date(2026, 4, 1, 12);
  const positioned = layoutDayItems(
    [
      item("2026-05-01T05:00:00.000Z", "2026-05-01T06:00:00.000Z", true),
      item("2026-05-05T05:00:00.000Z", "2026-05-05T06:00:00.000Z")
    ],
    day,
    "Asia/Dubai"
  );
  assert.equal(positioned.length, 0);
});

test("allDayItemsForDay returns all-day items on their own day and across spans", () => {
  const day = new Date(2026, 4, 2, 12);
  const found = allDayItemsForDay(
    [
      item("2026-05-01T20:00:00.000Z", "2026-05-01T21:00:00.000Z", true),
      item("2026-04-30T20:00:00.000Z", "2026-05-04T20:00:00.000Z", true),
      item("2026-05-01T20:00:00.000Z", "2026-05-01T21:00:00.000Z")
    ],
    day,
    "Asia/Dubai"
  );
  assert.equal(found.length, 2);
});
