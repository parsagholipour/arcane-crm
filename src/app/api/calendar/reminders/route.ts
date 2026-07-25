import { authorizationErrorResponse, requireOrganizationContext } from "@/lib/organization-context";
import { expandRecurrence } from "@/lib/calendar-recurrence";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const REMINDER_CATEGORY = "Calendar";
/** How far past its trigger a reminder may still fire, so a closed tab does not queue up stale alerts forever. */
const REMINDER_GRACE_MINUTES = 60;
const MAX_REMINDERS_PER_SWEEP = 25;

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

/**
 * Fire reminders whose trigger time has passed.
 *
 * There is no scheduler in this deployment, so the calendar calls this while it
 * is open. `EventReminderDispatch` carries a unique key per (user, event,
 * occurrence), which is what keeps concurrent sweeps from double-notifying.
 */
export async function POST() {
  try {
    const context = await requireOrganizationContext();
    const { organizationId, userId } = context;

    const preference = await prisma.notificationPreference.findUnique({
      where: { organizationId_userId_category: { organizationId, userId, category: REMINDER_CATEGORY } }
    });
    if (preference?.enabled === false) return NextResponse.json({ ok: true, skipped: true, notifications: [] });

    const now = new Date();
    const graceStart = new Date(now.getTime() - REMINDER_GRACE_MINUTES * 60 * 1000);
    // The widest trigger offset we support is four weeks, so nothing beyond that can be due yet.
    const horizon = new Date(now.getTime() + 40320 * 60 * 1000);

    const userPreference = await prisma.userPreference.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      select: { timezone: true }
    });
    const timeZone = userPreference?.timezone || "UTC";

    const events = await prisma.event.findMany({
      where: {
        organizationId,
        reminderMinutes: { not: null },
        OR: [{ private: false }, { assignedToId: userId }],
        AND: [{ OR: [{ NOT: { recurrenceRule: null } }, { startAt: { gte: graceStart, lte: horizon } }] }]
      },
      orderBy: { startAt: "asc" },
      take: 500
    });

    const due: { event: (typeof events)[number]; occurrenceAt: Date; triggerAt: Date }[] = [];
    for (const event of events) {
      const offsetMs = (event.reminderMinutes ?? 0) * 60 * 1000;
      for (const occurrence of expandRecurrence(event, graceStart, horizon, timeZone)) {
        const triggerAt = new Date(occurrence.startAt.getTime() - offsetMs);
        // Due, not yet started, and not so old that it is no longer worth showing.
        if (triggerAt > now) continue;
        if (occurrence.startAt < now) continue;
        if (triggerAt < graceStart) continue;
        due.push({ event, occurrenceAt: occurrence.startAt, triggerAt });
      }
    }

    due.sort((left, right) => left.occurrenceAt.getTime() - right.occurrenceAt.getTime());

    const created: unknown[] = [];
    for (const entry of due.slice(0, MAX_REMINDERS_PER_SWEEP)) {
      try {
        await prisma.eventReminderDispatch.create({
          data: { organizationId, userId, eventId: entry.event.id, occurrenceAt: entry.occurrenceAt }
        });
      } catch (error) {
        // A concurrent sweep already claimed this occurrence.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
        throw error;
      }

      const minutesAway = Math.max(0, Math.round((entry.occurrenceAt.getTime() - now.getTime()) / 60000));
      const notification = await prisma.notification.create({
        data: {
          organizationId,
          userId,
          title: entry.event.subject,
          body: `Starts ${minutesToText(minutesAway)}${entry.event.location ? ` · ${entry.event.location}` : ""}.`,
          href: `/lightning/o/Event/home?eventId=${entry.event.id}&occurrence=${encodeURIComponent(entry.occurrenceAt.toISOString())}`,
          category: REMINDER_CATEGORY,
          read: false
        }
      });
      created.push(notification);
    }

    return NextResponse.json({ ok: true, notifications: JSON.parse(JSON.stringify(created)) });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    console.error("[calendar] reminder sweep failed", error);
    return NextResponse.json({ error: "Unable to check calendar reminders." }, { status: 500 });
  }
}
