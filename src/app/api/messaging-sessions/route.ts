import { authorizationErrorResponse, requireOrganizationContext } from "@/lib/organization-context";
import {
  buildMessagingParticipants,
  createMessagingNotification,
  messagingErrorResponse,
  messagingSessionInclude,
  requireMessagingChannel,
  validateMessagingReferences
} from "@/lib/messaging";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const context = await requireOrganizationContext();
    const status = request.nextUrl.searchParams.get("status");
    const query = request.nextUrl.searchParams.get("q")?.trim();
    const sessions = await prisma.messagingSession.findMany({
      where: {
        organizationId: context.organizationId,
        ...(status ? { status } : {}),
        ...(query
          ? {
              OR: [
                { name: { contains: query, mode: "insensitive" } },
                { subject: { contains: query, mode: "insensitive" } }
              ]
            }
          : {})
      },
      include: messagingSessionInclude,
      orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }]
    });
    return NextResponse.json({ sessions: JSON.parse(JSON.stringify(sessions)) });
  } catch (error) {
    console.error(error);
    const response = authorizationErrorResponse(error);
    if (response) return response;
    return NextResponse.json({ error: "Unable to load messaging sessions." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireOrganizationContext();
    const payload = await request.json();
    const name = String(payload.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "Messaging session name is required." }, { status: 400 });
    const channel = requireMessagingChannel(payload.channel);
    const ownerId = await validateMessagingReferences(context.organizationId, context.userId, payload);
    const participantInput =
      Array.isArray(payload.participants) && payload.participants.length
        ? payload.participants
        : payload.contactId
          ? [{ contactId: payload.contactId, role: "Customer" }]
          : [];
    const participants = await buildMessagingParticipants(context.organizationId, participantInput);
    const session = await prisma.messagingSession.create({
      data: {
        organizationId: context.organizationId,
        name,
        subject: String(payload.subject ?? "").trim() || null,
        channel,
        status: "Open",
        ownerId,
        accountId: String(payload.accountId ?? "").trim() || null,
        contactId: String(payload.contactId ?? "").trim() || null,
        externalId: String(payload.externalId ?? "").trim() || null,
        createdById: context.userId,
        participants: { create: participants }
      },
      include: messagingSessionInclude
    });
    const notification = await createMessagingNotification(
      context.organizationId,
      context.userId,
      "Messaging session created",
      `${name} is ready for conversation tracking.`,
      session.id
    );
    return NextResponse.json(
      { session: JSON.parse(JSON.stringify(session)), notifications: [notification] },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);
    const response = authorizationErrorResponse(error);
    if (response) return response;
    const validation = messagingErrorResponse(error);
    if (validation) return NextResponse.json({ error: validation.error }, { status: validation.status });
    return NextResponse.json({ error: "Unable to create messaging session." }, { status: 500 });
  }
}
