import assert from "node:assert/strict";
import test from "node:test";
import { calendarReminderIsDue, calendarReminderRetryDelayMinutes } from "@/lib/calendar-reminders";
import { validBearerSecret } from "@/lib/cron-auth";

test("calendar reminders become due at the exact offset and remain useful until the event starts", () => {
  const startAt = new Date("2026-08-20T10:00:00.000Z");
  assert.equal(calendarReminderIsDue(startAt, 1440, new Date("2026-08-19T09:59:59.999Z")), false);
  assert.equal(calendarReminderIsDue(startAt, 1440, new Date("2026-08-19T10:00:00.000Z")), true);
  assert.equal(calendarReminderIsDue(startAt, 1440, new Date("2026-08-20T09:59:59.999Z")), true);
  assert.equal(calendarReminderIsDue(startAt, 1440, startAt), false);
  assert.equal(calendarReminderIsDue(startAt, 1440, new Date("2026-08-20T10:00:00.001Z")), false);
});

test("calendar reminder retries back off to an hourly cap", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 10].map(calendarReminderRetryDelayMinutes), [5, 10, 20, 40, 60, 60]);
});

test("calendar reminder cron authorization requires an exact bearer secret", () => {
  assert.equal(validBearerSecret("Bearer correct-secret", "correct-secret"), true);
  assert.equal(validBearerSecret("Bearer wrong-secret", "correct-secret"), false);
  assert.equal(validBearerSecret("Basic correct-secret", "correct-secret"), false);
  assert.equal(validBearerSecret(null, "correct-secret"), false);
  assert.equal(validBearerSecret("Bearer correct-secret", ""), false);
});
