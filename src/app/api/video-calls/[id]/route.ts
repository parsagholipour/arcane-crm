import { authorizationErrorResponse, requireOrganizationContext } from "@/lib/organization-context";
import {
  buildVideoParticipants,
  requireVideoCall,
  requireVideoProvider,
  validateVideoDates,
  validateVideoReferences,
  validateWebUrl,
  videoCallErrorResponse,
  videoCallInclude
} from "@/lib/video-calls";
import { emailDeliveryConfigured } from "@/lib/email/service";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type Params = Promise<{ id: string }>;
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: { params: Params }) {
  try {
    const authContext = await requireOrganizationContext();
    const { id } = await context.params;
    const videoCall = await requireVideoCall(authContext.organizationId, id);
    return NextResponse.json({
      videoCall: JSON.parse(JSON.stringify(videoCall)),
      capabilities: { emailInvitations: emailDeliveryConfigured() }
    });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    return NextResponse.json({ error: "Unable to load video call." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: { params: Params }) {
  try {
    const authContext = await requireOrganizationContext();
    const { id } = await context.params;
    const existing = await requireVideoCall(authContext.organizationId, id);
    const payload = await request.json();
    if (payload.status !== undefined)
      return NextResponse.json({ error: "Use a lifecycle action to change video-call status." }, { status: 400 });
    if (["Cancelled", "Completed"].includes(existing.status)) {
      const allowed = new Set(["notes", "recordingUrl"]);
      if (Object.keys(payload).some((key) => !allowed.has(key)))
        return NextResponse.json(
          { error: `${existing.status} video calls only allow notes and recording updates.` },
          { status: 409 }
        );
    }
    const name = payload.name === undefined ? existing.name : String(payload.name).trim();
    if (!name) return NextResponse.json({ error: "Video call name is required." }, { status: 400 });
    const dates =
      payload.scheduledStartAt !== undefined || payload.scheduledEndAt !== undefined
        ? validateVideoDates(
            payload.scheduledStartAt ?? existing.scheduledStartAt,
            payload.scheduledEndAt ?? existing.scheduledEndAt
          )
        : null;
    const organizerId = await validateVideoReferences(authContext.organizationId, authContext.userId, {
      ...payload,
      organizerId: payload.organizerId ?? existing.organizerId
    });
    const participants =
      payload.participants === undefined
        ? null
        : await buildVideoParticipants(authContext.organizationId, payload.participants);
    const videoCall = await prisma.$transaction(async (tx) => {
      if (participants)
        await tx.videoCallParticipant.deleteMany({
          where: { videoCallId: id, organizationId: authContext.organizationId }
        });
      return tx.videoCall.update({
        where: { id },
        data: {
          name,
          description: payload.description === undefined ? undefined : String(payload.description ?? "").trim() || null,
          provider: payload.provider === undefined ? undefined : requireVideoProvider(payload.provider),
          meetingUrl: payload.meetingUrl === undefined ? undefined : validateWebUrl(payload.meetingUrl, "Meeting URL"),
          ...(dates ?? {}),
          accountId: payload.accountId === undefined ? undefined : String(payload.accountId ?? "").trim() || null,
          contactId: payload.contactId === undefined ? undefined : String(payload.contactId ?? "").trim() || null,
          opportunityId:
            payload.opportunityId === undefined ? undefined : String(payload.opportunityId ?? "").trim() || null,
          organizerId,
          recordingUrl:
            payload.recordingUrl === undefined ? undefined : validateWebUrl(payload.recordingUrl, "Recording URL"),
          notes: payload.notes === undefined ? undefined : String(payload.notes ?? "").trim() || null,
          ...(participants ? { participants: { create: participants } } : {})
        },
        include: videoCallInclude
      });
    });
    return NextResponse.json({ videoCall: JSON.parse(JSON.stringify(videoCall)) });
  } catch (error) {
    console.error(error);
    const response = authorizationErrorResponse(error);
    if (response) return response;
    const validation = videoCallErrorResponse(error);
    if (validation) return NextResponse.json({ error: validation.error }, { status: validation.status });
    return NextResponse.json({ error: "Unable to update video call." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: { params: Params }) {
  try {
    const authContext = await requireOrganizationContext();
    const { id } = await context.params;
    const existing = await requireVideoCall(authContext.organizationId, id);
    if (existing.status !== "Scheduled" || existing.startedAt)
      return NextResponse.json({ error: "Only video calls that have not started can be deleted." }, { status: 409 });
    await prisma.videoCall.deleteMany({ where: { id, organizationId: authContext.organizationId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    return NextResponse.json({ error: "Unable to delete video call." }, { status: 500 });
  }
}
