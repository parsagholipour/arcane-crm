import { authorizationErrorResponse, requireOrganizationContext } from "@/lib/organization-context";
import { dispatchDueCalendarReminders } from "@/lib/calendar-reminders";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const context = await requireOrganizationContext();
    const summary = await dispatchDueCalendarReminders({ userId: context.userId, organizationId: context.organizationId });
    const notifications = await prisma.notification.findMany({
      where: {
        organizationId: context.organizationId,
        userId: context.userId,
        category: "Calendar",
        read: false
      },
      orderBy: { createdAt: "desc" },
      take: 25
    });
    return NextResponse.json({ ok: true, summary, notifications: JSON.parse(JSON.stringify(notifications)) });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    console.error("[calendar] reminder sweep failed", error);
    return NextResponse.json({ error: "Unable to check calendar reminders." }, { status: 500 });
  }
}
