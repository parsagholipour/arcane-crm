import { authorizationErrorResponse, requireOrganizationContext } from "@/lib/organization-context";
import { emailDeliveryConfigured } from "@/lib/email/service";
import { buildMessagingParticipants, messagingErrorResponse, messagingSessionInclude, requireMessagingChannel, requireMessagingSession, validateMessagingReferences } from "@/lib/messaging";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type Params = Promise<{ id: string }>;
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: { params: Params }) {
  try {
    const authContext = await requireOrganizationContext();
    const { id } = await context.params;
    const session = await requireMessagingSession(authContext.organizationId, id);
    return NextResponse.json({ session: JSON.parse(JSON.stringify(session)), capabilities: { emailDelivery: emailDeliveryConfigured() } });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    return NextResponse.json({ error: "Unable to load messaging session." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: { params: Params }) {
  try {
    const authContext = await requireOrganizationContext();
    const { id } = await context.params;
    const existing = await requireMessagingSession(authContext.organizationId, id);
    if (existing.status === "Closed") return NextResponse.json({ error: "Closed messaging sessions must be reopened before editing." }, { status: 409 });
    const payload = await request.json();
    if (payload.status !== undefined) return NextResponse.json({ error: "Use a lifecycle action to change messaging status." }, { status: 400 });
    const name = payload.name === undefined ? existing.name : String(payload.name).trim();
    if (!name) return NextResponse.json({ error: "Messaging session name is required." }, { status: 400 });
    const ownerId = await validateMessagingReferences(authContext.organizationId, authContext.userId, { ...payload, ownerId: payload.ownerId ?? existing.ownerId });
    const participants = payload.participants === undefined ? null : await buildMessagingParticipants(authContext.organizationId, payload.participants);
    const session = await prisma.$transaction(async (tx) => {
      if (participants) {
        await tx.messagingSessionParticipant.deleteMany({ where: { sessionId: id, organizationId: authContext.organizationId } });
      }
      return tx.messagingSession.update({
        where: { id },
        data: {
          name,
          subject: payload.subject === undefined ? undefined : String(payload.subject ?? "").trim() || null,
          channel: payload.channel === undefined ? undefined : requireMessagingChannel(payload.channel),
          ownerId,
          accountId: payload.accountId === undefined ? undefined : String(payload.accountId ?? "").trim() || null,
          contactId: payload.contactId === undefined ? undefined : String(payload.contactId ?? "").trim() || null,
          externalId: payload.externalId === undefined ? undefined : String(payload.externalId ?? "").trim() || null,
          ...(participants ? { participants: { create: participants } } : {})
        },
        include: messagingSessionInclude
      });
    });
    return NextResponse.json({ session: JSON.parse(JSON.stringify(session)) });
  } catch (error) {
    console.error(error);
    const response = authorizationErrorResponse(error);
    if (response) return response;
    const validation = messagingErrorResponse(error);
    if (validation) return NextResponse.json({ error: validation.error }, { status: validation.status });
    return NextResponse.json({ error: "Unable to update messaging session." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: { params: Params }) {
  try {
    const authContext = await requireOrganizationContext();
    const { id } = await context.params;
    const existing = await requireMessagingSession(authContext.organizationId, id);
    if (existing.status !== "Open" || existing.messages.length > 0) {
      return NextResponse.json({ error: "Only empty Open messaging sessions can be deleted. Close sessions with conversation history instead." }, { status: 409 });
    }
    await prisma.messagingSession.deleteMany({ where: { id, organizationId: authContext.organizationId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    return NextResponse.json({ error: "Unable to delete messaging session." }, { status: 500 });
  }
}
