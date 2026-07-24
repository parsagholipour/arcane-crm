import { authorizationErrorResponse, requireOrganizationContext } from "@/lib/organization-context";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function escapeIcs(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function utcStamp(value: Date) {
  return value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function dateStamp(value: Date) {
  return value.toISOString().slice(0, 10).replace(/-/g, "");
}

export async function GET() {
  try {
    const context = await requireOrganizationContext();
    const events = await prisma.event.findMany({
      where: { organizationId: context.organizationId, OR: [{ private: false }, { assignedToId: context.userId }] },
      orderBy: { startAt: "asc" }
    });
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Reloriq//Calendar//EN", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${escapeIcs(context.organization.name)} · Reloriq`];
    for (const event of events) {
      lines.push("BEGIN:VEVENT", `UID:${escapeIcs(`${event.id}@${context.organization.slug}`)}`, `DTSTAMP:${utcStamp(event.updatedAt)}`);
      if (event.allDay) {
        lines.push(`DTSTART;VALUE=DATE:${dateStamp(event.startAt)}`, `DTEND;VALUE=DATE:${dateStamp(event.endAt)}`);
      } else {
        lines.push(`DTSTART:${utcStamp(event.startAt)}`, `DTEND:${utcStamp(event.endAt)}`);
      }
      lines.push(`SUMMARY:${escapeIcs(event.subject)}`);
      if (event.description) lines.push(`DESCRIPTION:${escapeIcs(event.description)}`);
      if (event.location) lines.push(`LOCATION:${escapeIcs(event.location)}`);
      lines.push(`CLASS:${event.private ? "PRIVATE" : "PUBLIC"}`, "END:VEVENT");
    }
    lines.push("END:VCALENDAR");
    return new NextResponse(`${lines.join("\r\n")}\r\n`, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="${context.organization.slug}-calendar.ics"`, "Cache-Control": "private, no-store" } });
  } catch (error) {
    return authorizationErrorResponse(error) ?? NextResponse.json({ error: "Unable to export calendar." }, { status: 500 });
  }
}
