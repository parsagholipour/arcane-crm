import { authorizationErrorResponse, requireOrganizationContext } from "@/lib/organization-context";
import { createVideoCallNotification, requireVideoCall, videoCallInclude } from "@/lib/video-calls";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type Params = Promise<{ id: string }>;

export async function POST(request: NextRequest, context: { params: Params }) {
  try {
    const authContext = await requireOrganizationContext();
    const { id } = await context.params;
    const existing = await requireVideoCall(authContext.organizationId, id);
    const payload = await request.json();
    const action = String(payload.action ?? "").toLowerCase();

    if (action === "attendance") {
      const participantId = String(payload.participantId ?? "");
      const attendance = String(payload.attendance ?? "");
      if (!["Invited", "Accepted", "Declined", "Attended", "No Show"].includes(attendance))
        return NextResponse.json({ error: "Choose a valid attendance status." }, { status: 400 });
      const updated = await prisma.videoCallParticipant.updateMany({
        where: { id: participantId, videoCallId: id, organizationId: authContext.organizationId },
        data: { attendance, joinedAt: attendance === "Attended" ? new Date() : undefined }
      });
      if (!updated.count) return NextResponse.json({ error: "Participant not found." }, { status: 404 });
      const videoCall = await requireVideoCall(authContext.organizationId, id);
      return NextResponse.json({ videoCall: JSON.parse(JSON.stringify(videoCall)) });
    }

    const transition =
      existing.status === "Scheduled" && action === "start"
        ? { status: "In Progress", startedAt: new Date(), endedAt: null }
        : existing.status === "Scheduled" && action === "cancel"
          ? { status: "Cancelled", startedAt: null, endedAt: new Date() }
          : existing.status === "In Progress" && action === "complete"
            ? { status: "Completed", startedAt: existing.startedAt ?? new Date(), endedAt: new Date() }
            : null;
    if (!transition)
      return NextResponse.json(
        { error: `Cannot ${action || "perform that action"} while the video call is ${existing.status}.` },
        { status: 409 }
      );
    const videoCall = await prisma.videoCall.update({ where: { id }, data: transition, include: videoCallInclude });
    const notification = await createVideoCallNotification(
      authContext.organizationId,
      authContext.userId,
      `Video call ${videoCall.status.toLowerCase()}`,
      `${videoCall.name} is now ${videoCall.status}.`,
      id
    );
    return NextResponse.json({ videoCall: JSON.parse(JSON.stringify(videoCall)), notifications: [notification] });
  } catch (error) {
    console.error(error);
    const response = authorizationErrorResponse(error);
    if (response) return response;
    return NextResponse.json({ error: "Unable to update video call." }, { status: 500 });
  }
}
