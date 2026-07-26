import { authorizationErrorResponse, requireOrganizationContext } from "@/lib/organization-context";
import { parseRecurrenceRule } from "@/lib/calendar-recurrence";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function escapeIcs(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function utcStamp(value: Date) {
  return value
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function dateStamp(value: Date) {
  return value.toISOString().slice(0, 10).replace(/-/g, "");
}

/** RFC 5545 caps content lines at 75 octets; continuations begin with a single space. */
function foldLine(line: string) {
  if (line.length <= 75) return line;
  const parts = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    parts.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  if (rest.length > 0) parts.push(` ${rest}`);
  return parts.join("\r\n");
}

export async function GET() {
  try {
    const context = await requireOrganizationContext();
    const events = await prisma.event.findMany({
      where: { organizationId: context.organizationId, OR: [{ private: false }, { assignedToId: context.userId }] },
      orderBy: { startAt: "asc" }
    });

    // Resolve attendee ids to addresses so ATTENDEE lines carry something usable.
    const attendeeIds = [...new Set(events.flatMap((event) => event.attendeeIds))];
    const [users, contacts] = await Promise.all([
      attendeeIds.length
        ? prisma.user.findMany({ where: { id: { in: attendeeIds } }, select: { id: true, name: true, email: true } })
        : Promise.resolve([]),
      attendeeIds.length
        ? prisma.contact.findMany({
            where: { organizationId: context.organizationId, id: { in: attendeeIds } },
            select: { id: true, firstName: true, lastName: true, email: true }
          })
        : Promise.resolve([])
    ]);
    const attendeesById = new Map<string, { name: string; email: string | null }>();
    for (const user of users)
      attendeesById.set(user.id, { name: user.name || user.email || user.id, email: user.email });
    for (const contact of contacts)
      attendeesById.set(contact.id, {
        name: [contact.firstName, contact.lastName].filter(Boolean).join(" ") || contact.id,
        email: contact.email
      });

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Reloriq//Calendar//EN",
      "CALSCALE:GREGORIAN",
      `X-WR-CALNAME:${escapeIcs(context.organization.name)} · Reloriq`
    ];

    for (const event of events) {
      lines.push(
        "BEGIN:VEVENT",
        `UID:${escapeIcs(`${event.id}@${context.organization.slug}`)}`,
        `DTSTAMP:${utcStamp(event.updatedAt)}`
      );
      if (event.allDay) {
        lines.push(`DTSTART;VALUE=DATE:${dateStamp(event.startAt)}`, `DTEND;VALUE=DATE:${dateStamp(event.endAt)}`);
      } else {
        lines.push(`DTSTART:${utcStamp(event.startAt)}`, `DTEND:${utcStamp(event.endAt)}`);
      }

      const recurrence = parseRecurrenceRule(event.recurrenceRule);
      if (recurrence) {
        const rule = String(event.recurrenceRule).replace(/^RRULE:/i, "");
        // recurrenceEndAt is a CRM-side stop date; express it as UNTIL when the rule has no terminator of its own.
        const needsUntil = !recurrence.count && !recurrence.until && event.recurrenceEndAt;
        lines.push(`RRULE:${needsUntil ? `${rule};UNTIL=${utcStamp(event.recurrenceEndAt!)}` : rule}`);
        if (event.recurrenceExceptionDates.length > 0)
          lines.push(`EXDATE:${event.recurrenceExceptionDates.map(utcStamp).join(",")}`);
      }
      if (event.recurrenceParentId && event.recurrenceOriginalStart)
        lines.push(`RECURRENCE-ID:${utcStamp(event.recurrenceOriginalStart)}`);

      lines.push(`SUMMARY:${escapeIcs(event.subject)}`);
      if (event.description) lines.push(`DESCRIPTION:${escapeIcs(event.description)}`);
      if (event.location) lines.push(`LOCATION:${escapeIcs(event.location)}`);

      for (const attendeeId of event.attendeeIds) {
        const attendee = attendeesById.get(attendeeId);
        if (!attendee?.email) continue;
        lines.push(`ATTENDEE;CN=${escapeIcs(attendee.name)}:mailto:${escapeIcs(attendee.email)}`);
      }

      lines.push(
        `TRANSP:${event.showTimeAs === "Free" ? "TRANSPARENT" : "OPAQUE"}`,
        `CLASS:${event.private ? "PRIVATE" : "PUBLIC"}`
      );

      if (event.reminderMinutes !== null && event.reminderMinutes >= 0) {
        lines.push(
          "BEGIN:VALARM",
          "ACTION:DISPLAY",
          `DESCRIPTION:${escapeIcs(event.subject)}`,
          `TRIGGER:-PT${event.reminderMinutes}M`,
          "END:VALARM"
        );
      }

      lines.push("END:VEVENT");
    }

    lines.push("END:VCALENDAR");
    return new NextResponse(`${lines.map(foldLine).join("\r\n")}\r\n`, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${context.organization.slug}-calendar.ics"`,
        "Cache-Control": "private, no-store"
      }
    });
  } catch (error) {
    return (
      authorizationErrorResponse(error) ?? NextResponse.json({ error: "Unable to export calendar." }, { status: 500 })
    );
  }
}
