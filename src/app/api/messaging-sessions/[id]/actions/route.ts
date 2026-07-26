import { authorizationErrorResponse, requireOrganizationContext } from "@/lib/organization-context";
import { createMessagingNotification, requireMessagingSession } from "@/lib/messaging";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type Params = Promise<{ id: string }>;

const transitions: Record<string, Record<string, string>> = {
  Open: { wait: "Waiting", close: "Closed" },
  Waiting: { resume: "Open", close: "Closed" },
  Closed: { reopen: "Open" }
};

export async function POST(request: NextRequest, context: { params: Params }) {
  try {
    const authContext = await requireOrganizationContext();
    const { id } = await context.params;
    const existing = await requireMessagingSession(authContext.organizationId, id);
    const action = String((await request.json()).action ?? "").toLowerCase();
    const nextStatus = transitions[existing.status]?.[action];
    if (!nextStatus)
      return NextResponse.json(
        { error: `Cannot ${action || "perform that action"} while the session is ${existing.status}.` },
        { status: 409 }
      );
    const session = await prisma.messagingSession.update({
      where: { id },
      data: { status: nextStatus, endedAt: nextStatus === "Closed" ? new Date() : null },
      include: {
        account: true,
        contact: true,
        participants: { include: { contact: true } },
        messages: { orderBy: { sentAt: "asc" } }
      }
    });
    const notification = await createMessagingNotification(
      authContext.organizationId,
      authContext.userId,
      `Messaging session ${nextStatus.toLowerCase()}`,
      `${session.name} is now ${nextStatus}.`,
      id
    );
    return NextResponse.json({ session: JSON.parse(JSON.stringify(session)), notifications: [notification] });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    return NextResponse.json({ error: "Unable to update messaging status." }, { status: 500 });
  }
}
