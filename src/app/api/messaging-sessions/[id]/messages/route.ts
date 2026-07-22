import { emailErrorResponse } from "@/lib/email/http";
import { emailDeliveryConfigured, isValidEmail } from "@/lib/email/service";
import { attachTrackedDeliveries, sendTrackedEmail } from "@/lib/email/tracking";
import { authorizationErrorResponse, requireOrganizationContext } from "@/lib/organization-context";
import { MessagingValidationError, createMessagingNotification, messagingErrorResponse, requireMessagingSession } from "@/lib/messaging";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type Params = Promise<{ id: string }>;

export async function POST(request: NextRequest, context: { params: Params }) {
  try {
    const authContext = await requireOrganizationContext();
    const { id } = await context.params;
    const session = await requireMessagingSession(authContext.organizationId, id);
    if (session.status === "Closed") return NextResponse.json({ error: "Closed messaging sessions cannot receive new messages." }, { status: 409 });
    const payload = await request.json();
    const body = String(payload.body ?? "").trim();
    if (!body) throw new MessagingValidationError("Message body is required.");
    const direction = String(payload.direction ?? "Inbound");
    if (!["Inbound", "Outbound", "System"].includes(direction)) throw new MessagingValidationError("Choose a valid message direction.");
    const deliver = payload.deliver === true;
    let delivery: Awaited<ReturnType<typeof sendTrackedEmail>> | null = null;
    if (deliver) {
      if (direction !== "Outbound" || session.channel !== "Email") throw new MessagingValidationError("Provider delivery is only available for outbound Email sessions.");
      if (!emailDeliveryConfigured()) throw new MessagingValidationError("Email delivery is not configured for this CRM.", 503);
      const address = String(payload.recipient ?? session.contact?.email ?? session.participants.find((participant) => isValidEmail(participant.address))?.address ?? "");
      if (!isValidEmail(address)) throw new MessagingValidationError("Choose a participant with a valid email address.");
      delivery = await sendTrackedEmail({
        fromName: authContext.organization.name,
        to: [{ email: address }],
        subject: session.subject || session.name,
        text: body
      }, { organizationId: authContext.organizationId, userId: authContext.userId, sourceType: "MessagingMessage" });
    }
    const now = payload.sentAt ? new Date(String(payload.sentAt)) : new Date();
    if (!Number.isFinite(now.getTime())) throw new MessagingValidationError("Choose a valid message date and time.");
    const message = await prisma.$transaction(async (tx) => {
      const created = await tx.messagingMessage.create({
        data: {
          organizationId: authContext.organizationId,
          sessionId: id,
          direction,
          senderName: String(payload.senderName ?? (direction === "Outbound" ? authContext.user.name : "")).trim() || null,
          senderAddress: String(payload.senderAddress ?? "").trim() || null,
          body,
          status: delivery ? "Accepted" : direction === "Inbound" ? "Received" : "Recorded",
          externalMessageId: (delivery?.messageId ?? String(payload.externalMessageId ?? "").trim()) || null,
          recordedById: authContext.userId,
          sentAt: now
        }
      });
      await tx.messagingSession.update({ where: { id }, data: { lastMessageAt: now, status: direction === "Inbound" ? "Open" : undefined } });
      return created;
    });
    await attachTrackedDeliveries(delivery?.deliveryIds, { organizationId: authContext.organizationId, userId: authContext.userId, sourceType: "MessagingMessage", sourceId: message.id });
    const notification = await createMessagingNotification(authContext.organizationId, authContext.userId, delivery ? "Message accepted for email delivery" : "Message recorded", `${session.name}: ${body.slice(0, 120)}`, id);
    return NextResponse.json({ message: JSON.parse(JSON.stringify(message)), delivery, notifications: [notification] }, { status: 201 });
  } catch (error) {
    console.error(error);
    const response = authorizationErrorResponse(error);
    if (response) return response;
    const emailResponse = emailErrorResponse(error);
    if (emailResponse) return emailResponse;
    const validation = messagingErrorResponse(error);
    if (validation) return NextResponse.json({ error: validation.error }, { status: validation.status });
    return NextResponse.json({ error: "Unable to record message." }, { status: 500 });
  }
}
