import "server-only";

import { Prisma } from "@prisma/client";
import { expandRecurrence } from "@/lib/calendar-recurrence";
import { MAX_EVENT_REMINDER_MINUTES } from "@/lib/calendar-reminder-values";
import { EmailError } from "@/lib/email/errors";
import { emailDeliveryConfigured, isValidEmail } from "@/lib/email/service";
import { calendarReminderTemplate } from "@/lib/email/templates";
import { sendTrackedEmail } from "@/lib/email/tracking";
import type { EmailAdapter } from "@/lib/email/types";
import { prisma } from "@/lib/prisma";
import { resolvePublicAppUrl } from "@/lib/public-app-url";

const CALENDAR_CATEGORY = "Calendar";
const EMAIL_DELIVERY_CATEGORY = "Email Delivery";
const DEFAULT_BATCH_LIMIT = 100;
const MAX_CANDIDATE_EVENTS = 2000;
const PROCESSING_LEASE_MINUTES = 10;

type ReminderDispatchDependencies = {
  adapter?: EmailAdapter;
  senderEmail?: string;
  publicAppUrl?: string;
};

export type CalendarReminderDispatchSummary = {
  processed: number;
  accepted: number;
  retried: number;
  skipped: number;
  failed: number;
};

type DueReminder = {
  event: Awaited<ReturnType<typeof loadCandidateEvents>>[number];
  occurrenceAt: Date;
  occurrenceEndAt: Date;
  triggerAt: Date;
  owner: {
    id: string;
    name: string;
    email: string | null;
  };
  organizationName: string;
  timeZone: string;
  locale: string;
};

function pairKey(organizationId: string, userId: string) {
  return `${organizationId}:${userId}`;
}

function minutesToText(minutes: number) {
  if (minutes <= 0) return "now";
  if (minutes < 60) return `in ${minutes} minute${minutes === 1 ? "" : "s"}`;
  if (minutes < 1440) {
    const hours = Math.round(minutes / 60);
    return `in ${hours} hour${hours === 1 ? "" : "s"}`;
  }
  const days = Math.round(minutes / 1440);
  return `in ${days} day${days === 1 ? "" : "s"}`;
}

export function calendarReminderRetryDelayMinutes(attemptCount: number) {
  if (attemptCount <= 1) return 5;
  if (attemptCount === 2) return 10;
  if (attemptCount === 3) return 20;
  if (attemptCount === 4) return 40;
  return 60;
}

export function calendarReminderIsDue(startAt: Date, reminderMinutes: number, now: Date) {
  const triggerAt = new Date(startAt.getTime() - reminderMinutes * 60 * 1000);
  return triggerAt <= now && startAt > now;
}

function localizedDateTime(value: Date, timeZone: string, locale: string, allDay: boolean) {
  const options: Intl.DateTimeFormatOptions = allDay
    ? { dateStyle: "full", timeZone }
    : { dateStyle: "full", timeStyle: "short", timeZone };
  try {
    return new Intl.DateTimeFormat(locale || "en-US", options).format(value);
  } catch {
    return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(value);
  }
}

function eventHref(eventId: string, occurrenceAt: Date) {
  return `/lightning/o/Event/home?eventId=${encodeURIComponent(eventId)}&occurrence=${encodeURIComponent(occurrenceAt.toISOString())}`;
}

function safeFailureReason(error: unknown) {
  if (error instanceof EmailError) {
    if (error.code === "configuration") return "Calendar reminder email delivery is not configured.";
    if (error.code === "validation") return "Calendar reminder email delivery failed validation.";
    return "The email provider did not accept the calendar reminder.";
  }
  return "The calendar reminder email could not be accepted.";
}

async function loadCandidateEvents(now: Date, userId?: string, organizationId?: string) {
  const horizon = new Date(now.getTime() + MAX_EVENT_REMINDER_MINUTES * 60 * 1000);
  return prisma.event.findMany({
    where: {
      reminderMinutes: { not: null },
      ...(userId ? { assignedToId: userId } : {}),
      ...(organizationId ? { organizationId } : {}),
      AND: [{
        OR: [
          { AND: [{ recurrenceRule: null }, { startAt: { gt: now, lte: horizon } }] },
          { AND: [{ NOT: { recurrenceRule: null } }, { startAt: { lte: horizon } }] }
        ]
      }]
    },
    orderBy: { startAt: "asc" },
    take: MAX_CANDIDATE_EVENTS
  });
}

async function dueReminders(now: Date, userId?: string, organizationId?: string): Promise<DueReminder[]> {
  const events = await loadCandidateEvents(now, userId, organizationId);
  if (!events.length) return [];

  const pairs = [...new Map(events.map((event) => [pairKey(event.organizationId, event.assignedToId), {
    organizationId: event.organizationId,
    userId: event.assignedToId
  }])).values()];
  const organizationIds = [...new Set(events.map((event) => event.organizationId))];
  const [memberships, preferences, userPreferences, organizations] = await Promise.all([
    prisma.organizationMembership.findMany({
      where: {
        status: "ACTIVE",
        user: { status: "ACTIVE" },
        OR: pairs
      },
      include: { user: true }
    }),
    prisma.notificationPreference.findMany({
      where: {
        category: CALENDAR_CATEGORY,
        OR: pairs
      }
    }),
    prisma.userPreference.findMany({ where: { OR: pairs } }),
    prisma.organization.findMany({ where: { id: { in: organizationIds }, status: "ACTIVE" }, select: { id: true, name: true } })
  ]);

  const memberByPair = new Map(memberships.map((membership) => [pairKey(membership.organizationId, membership.userId), membership.user]));
  const preferenceByPair = new Map(preferences.map((preference) => [pairKey(preference.organizationId, preference.userId), preference.enabled]));
  const userPreferenceByPair = new Map(userPreferences.map((preference) => [pairKey(preference.organizationId, preference.userId), preference]));
  const organizationById = new Map(organizations.map((organization) => [organization.id, organization.name]));
  const horizon = new Date(now.getTime() + MAX_EVENT_REMINDER_MINUTES * 60 * 1000);
  const due: DueReminder[] = [];

  for (const event of events) {
    const key = pairKey(event.organizationId, event.assignedToId);
    const owner = memberByPair.get(key);
    const organizationName = organizationById.get(event.organizationId);
    if (!owner || !organizationName || preferenceByPair.get(key) === false) continue;
    const userPreference = userPreferenceByPair.get(key);
    const timeZone = userPreference?.timezone || "UTC";
    const locale = userPreference?.locale || "en-US";
    const offsetMs = (event.reminderMinutes ?? 0) * 60 * 1000;

    for (const occurrence of expandRecurrence(event, now, horizon, timeZone)) {
      const triggerAt = new Date(occurrence.startAt.getTime() - offsetMs);
      if (!calendarReminderIsDue(occurrence.startAt, event.reminderMinutes ?? 0, now)) continue;
      due.push({
        event,
        occurrenceAt: occurrence.startAt,
        occurrenceEndAt: occurrence.endAt,
        triggerAt,
        owner,
        organizationName,
        timeZone,
        locale
      });
    }
  }

  return due.sort((left, right) =>
    left.triggerAt.getTime() - right.triggerAt.getTime() ||
    left.occurrenceAt.getTime() - right.occurrenceAt.getTime()
  );
}

async function claimReminder(entry: DueReminder, now: Date) {
  const unique = {
    organizationId: entry.event.organizationId,
    userId: entry.owner.id,
    eventId: entry.event.id,
    occurrenceAt: entry.occurrenceAt
  };
  const href = eventHref(entry.event.id, entry.occurrenceAt);
  const minutesAway = Math.max(0, Math.round((entry.occurrenceAt.getTime() - now.getTime()) / 60000));

  try {
    return await prisma.$transaction(async (tx) => {
      const notification = await tx.notification.create({
        data: {
          organizationId: entry.event.organizationId,
          userId: entry.owner.id,
          title: entry.event.subject,
          body: `Starts ${minutesToText(minutesAway)}${entry.event.location ? ` · ${entry.event.location}` : ""}.`,
          href,
          category: CALENDAR_CATEGORY,
          read: false
        }
      });
      return tx.eventReminderDispatch.create({
        data: {
          ...unique,
          status: "Processing",
          attemptCount: 1,
          lastAttemptAt: now,
          notificationId: notification.id
        }
      });
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
  }

  const existing = await prisma.eventReminderDispatch.findUnique({
    where: { organizationId_userId_eventId_occurrenceAt: unique }
  });
  if (!existing) return null;
  const staleBefore = new Date(now.getTime() - PROCESSING_LEASE_MINUTES * 60 * 1000);
  const claimed = await prisma.eventReminderDispatch.updateMany({
    where: {
      id: existing.id,
      OR: [
        { status: "Retry", nextAttemptAt: { lte: now } },
        { status: "Processing", lastAttemptAt: { lte: staleBefore } }
      ]
    },
    data: {
      status: "Processing",
      attemptCount: { increment: 1 },
      lastAttemptAt: now,
      nextAttemptAt: null,
      lastError: null
    }
  });
  if (!claimed.count) return null;
  return prisma.eventReminderDispatch.findUnique({ where: { id: existing.id } });
}

async function createTerminalWarning(dispatchId: string, entry: DueReminder, reason: string) {
  const current = await prisma.eventReminderDispatch.findUnique({ where: { id: dispatchId } });
  if (!current || current.warningNotificationId) return;
  const warning = await prisma.notification.create({
    data: {
      organizationId: entry.event.organizationId,
      userId: entry.owner.id,
      title: "Calendar reminder email was not sent",
      body: `${entry.event.subject}: ${reason}`,
      href: eventHref(entry.event.id, entry.occurrenceAt),
      category: EMAIL_DELIVERY_CATEGORY,
      read: false
    }
  });
  await prisma.eventReminderDispatch.update({
    where: { id: dispatchId },
    data: { warningNotificationId: warning.id }
  });
}

async function markTerminal(
  dispatchId: string,
  entry: DueReminder,
  status: "Skipped" | "Failed",
  reason: string,
  now: Date
) {
  await prisma.eventReminderDispatch.update({
    where: { id: dispatchId },
    data: { status, lastAttemptAt: now, nextAttemptAt: null, lastError: reason }
  });
  await createTerminalWarning(dispatchId, entry, reason);
}

async function deliverClaimedReminder(
  dispatch: NonNullable<Awaited<ReturnType<typeof claimReminder>>>,
  entry: DueReminder,
  now: Date,
  dependencies: ReminderDispatchDependencies
): Promise<"accepted" | "retried" | "skipped" | "failed"> {
  if (!isValidEmail(entry.owner.email)) {
    await markTerminal(dispatch.id, entry, "Skipped", "The assigned user does not have a valid email address.", now);
    return "skipped";
  }

  try {
    if (!dependencies.adapter && !emailDeliveryConfigured()) {
      throw new EmailError("Email delivery is not configured.", 503, "configuration");
    }
    const href = eventHref(entry.event.id, entry.occurrenceAt);
    const eventUrl = new URL(href, resolvePublicAppUrl(dependencies.publicAppUrl)).toString();
    const template = calendarReminderTemplate({
      organizationName: entry.organizationName,
      eventSubject: entry.event.subject,
      startText: localizedDateTime(entry.occurrenceAt, entry.timeZone, entry.locale, entry.event.allDay),
      endText: localizedDateTime(entry.occurrenceEndAt, entry.timeZone, entry.locale, entry.event.allDay),
      allDay: entry.event.allDay,
      location: entry.event.location,
      eventUrl
    });
    const delivery = await sendTrackedEmail({
      fromName: entry.organizationName,
      to: [{ email: entry.owner.email, name: entry.owner.name }],
      ...template
    }, {
      organizationId: entry.event.organizationId,
      userId: entry.owner.id,
      sourceType: "Event",
      sourceId: entry.event.id
    }, dependencies);
    await prisma.eventReminderDispatch.update({
      where: { id: dispatch.id },
      data: {
        status: "Accepted",
        emailAcceptedAt: delivery.acceptedAt,
        nextAttemptAt: null,
        lastError: null
      }
    });
    return "accepted";
  } catch (error) {
    const reason = safeFailureReason(error);
    const retryAt = new Date(now.getTime() + calendarReminderRetryDelayMinutes(dispatch.attemptCount) * 60 * 1000);
    if (retryAt < entry.occurrenceAt) {
      await prisma.eventReminderDispatch.update({
        where: { id: dispatch.id },
        data: { status: "Retry", nextAttemptAt: retryAt, lastError: reason }
      });
      return "retried";
    }
    await markTerminal(dispatch.id, entry, "Failed", reason, now);
    return "failed";
  }
}

export async function dispatchDueCalendarReminders(options: {
  now?: Date;
  userId?: string;
  organizationId?: string;
  limit?: number;
  dependencies?: ReminderDispatchDependencies;
} = {}): Promise<CalendarReminderDispatchSummary> {
  const now = options.now ?? new Date();
  const limit = Math.max(1, Math.min(options.limit ?? DEFAULT_BATCH_LIMIT, 500));
  const dependencies = options.dependencies ?? {};
  const summary: CalendarReminderDispatchSummary = { processed: 0, accepted: 0, retried: 0, skipped: 0, failed: 0 };
  const due = await dueReminders(now, options.userId, options.organizationId);

  for (const entry of due.slice(0, limit)) {
    const dispatch = await claimReminder(entry, now);
    if (!dispatch) continue;
    summary.processed += 1;
    const result = await deliverClaimedReminder(dispatch, entry, now, dependencies);
    summary[result] += 1;
  }

  return summary;
}
