import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_EVENT_REMINDER_MINUTES,
  EVENT_REMINDER_OPTIONS,
  formatReminderOffset
} from "@/lib/calendar-reminder-values";

test("calendar reminder presets default to one day and retain None", () => {
  assert.equal(DEFAULT_EVENT_REMINDER_MINUTES, 1440);
  assert.equal(EVENT_REMINDER_OPTIONS[0].label, "None");
  assert.ok(EVENT_REMINDER_OPTIONS.some((option) => option.value === "1440" && option.label === "1 day before"));
});

test("calendar reminder offsets have readable labels", () => {
  assert.equal(formatReminderOffset(0), "At start time");
  assert.equal(formatReminderOffset(15), "15 minutes before");
  assert.equal(formatReminderOffset(60), "1 hour before");
  assert.equal(formatReminderOffset(1440), "1 day before");
  assert.equal(formatReminderOffset(2880), "2 days before");
  assert.equal(formatReminderOffset(10080), "1 week before");
  assert.equal(formatReminderOffset(-1), "");
});
