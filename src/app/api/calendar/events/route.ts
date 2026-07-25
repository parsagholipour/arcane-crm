import { authorizationErrorResponse, requireOrganizationContext } from "@/lib/organization-context";
import { calendarErrorResponse, loadCalendarItems, parseWindow } from "@/lib/calendar-events";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const context = await requireOrganizationContext();
    const params = request.nextUrl.searchParams;
    const { start, end } = parseWindow(params.get("start"), params.get("end"));

    const preference = await prisma.userPreference.findUnique({
      where: { organizationId_userId: { organizationId: context.organizationId, userId: context.userId } },
      select: { timezone: true }
    });

    const items = await loadCalendarItems(context.organizationId, context.userId, {
      start,
      end,
      timeZone: preference?.timezone || "UTC",
      includeTasks: params.get("includeTasks") !== "false",
      includeVideoCalls: params.get("includeVideoCalls") !== "false"
    });

    return NextResponse.json({ items, window: { start: start.toISOString(), end: end.toISOString() } });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    const validation = calendarErrorResponse(error);
    if (validation) return NextResponse.json({ error: validation.error, field: validation.field }, { status: validation.status });
    console.error("[calendar] unable to load events", error);
    return NextResponse.json({ error: "Unable to load calendar events." }, { status: 500 });
  }
}
