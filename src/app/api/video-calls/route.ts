import { emailErrorResponse } from "@/lib/email/http";
import { emailDeliveryConfigured, isValidEmail } from "@/lib/email/service";
import { attachTrackedDeliveries, sendTrackedEmail } from "@/lib/email/tracking";
import { authorizationErrorResponse, requireOrganizationContext } from "@/lib/organization-context";
import {
  buildVideoParticipants,
  createVideoCallNotification,
  requireVideoProvider,
  validateVideoDates,
  validateVideoReferences,
  validateWebUrl,
  videoCallErrorResponse,
  videoCallInclude
} from "@/lib/video-calls";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const context = await requireOrganizationContext();
    const status = request.nextUrl.searchParams.get("status");
    const calls = await prisma.videoCall.findMany({
      where: { organizationId: context.organizationId, ...(status ? { status } : {}) },
      include: videoCallInclude,
      orderBy: { scheduledStartAt: "desc" }
    });
    return NextResponse.json({
      videoCalls: JSON.parse(JSON.stringify(calls)),
      capabilities: { emailInvitations: emailDeliveryConfigured() }
    });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    return NextResponse.json({ error: "Unable to load video calls." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireOrganizationContext();
    const payload = await request.json();
    const name = String(payload.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "Video call name is required." }, { status: 400 });
    const provider = requireVideoProvider(payload.provider);
    const meetingUrl = validateWebUrl(payload.meetingUrl, "Meeting URL");
    const recordingUrl = validateWebUrl(payload.recordingUrl, "Recording URL");
    const dates = validateVideoDates(payload.scheduledStartAt, payload.scheduledEndAt);
    const organizerId = await validateVideoReferences(context.organizationId, context.userId, payload);
    const participantInput = Array.isArray(payload.participants) ? payload.participants : [];
    const participants = await buildVideoParticipants(context.organizationId, participantInput);
    let invitation = null;
    if (payload.notifyParticipants === true) {
      if (!emailDeliveryConfigured())
        return NextResponse.json(
          { error: "Email invitations are unavailable until SendGrid is configured." },
          { status: 503 }
        );
      const recipients = participants
        .filter((participant) => isValidEmail(participant.email))
        .map((participant) => ({ email: participant.email!, name: participant.name }));
      if (!recipients.length)
        return NextResponse.json(
          { error: "Add at least one participant with a valid email address before sending invitations." },
          { status: 400 }
        );
      invitation = await sendTrackedEmail(
        {
          fromName: context.organization.name,
          to: recipients,
          subject: `Video call: ${name}`,
          text: [
            `You are invited to ${name}.`,
            `Starts: ${dates.scheduledStartAt.toISOString()}`,
            `Ends: ${dates.scheduledEndAt.toISOString()}`,
            meetingUrl ? `Join: ${meetingUrl}` : "The meeting link will be added by the organizer."
          ].join("\n")
        },
        { organizationId: context.organizationId, userId: context.userId, sourceType: "VideoCall" }
      );
    }
    const videoCall = await prisma.videoCall.create({
      data: {
        organizationId: context.organizationId,
        name,
        description: String(payload.description ?? "").trim() || null,
        status: "Scheduled",
        provider,
        meetingUrl,
        ...dates,
        accountId: String(payload.accountId ?? "").trim() || null,
        contactId: String(payload.contactId ?? "").trim() || null,
        opportunityId: String(payload.opportunityId ?? "").trim() || null,
        organizerId,
        createdById: context.userId,
        recordingUrl,
        notes: String(payload.notes ?? "").trim() || null,
        participants: { create: participants }
      },
      include: videoCallInclude
    });
    await attachTrackedDeliveries(invitation?.deliveryIds, {
      organizationId: context.organizationId,
      userId: context.userId,
      sourceType: "VideoCall",
      sourceId: videoCall.id
    });
    const notification = await createVideoCallNotification(
      context.organizationId,
      context.userId,
      "Video call scheduled",
      `${name} is scheduled for ${dates.scheduledStartAt.toLocaleString()}.`,
      videoCall.id
    );
    return NextResponse.json(
      { videoCall: JSON.parse(JSON.stringify(videoCall)), invitation, notifications: [notification] },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);
    const response = authorizationErrorResponse(error);
    if (response) return response;
    const emailResponse = emailErrorResponse(error);
    if (emailResponse) return emailResponse;
    const validation = videoCallErrorResponse(error);
    if (validation) return NextResponse.json({ error: validation.error }, { status: validation.status });
    return NextResponse.json({ error: "Unable to create video call." }, { status: 500 });
  }
}
