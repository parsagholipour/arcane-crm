import {
  assertRelatedOrganizationRecord,
  authorizationErrorResponse,
  requireOrganizationContext
} from "@/lib/organization-context";
import { emailErrorResponse } from "@/lib/email/http";
import { sendTrackedEmail, attachTrackedDeliveries } from "@/lib/email/tracking";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

class ActivityValidationError extends Error {}

export async function POST(request: NextRequest) {
  try {
    const context = await requireOrganizationContext();
    const payload = await request.json();
    const type = String(payload.type);
    if (!["email", "call", "task"].includes(type)) throw new ActivityValidationError("Choose a valid activity type.");
    await assertRelatedOrganizationRecord(context.organizationId, payload.relatedObjectType, payload.relatedRecordId);
    if (type === "email") {
      const emailAction = payload.emailAction === "send" ? "send" : "log";
      const subject = String(payload.subject ?? (emailAction === "send" ? "Email" : "Logged Email"));
      const body = String(payload.body ?? "");
      const recipient = String(payload.to ?? "");
      const delivery =
        emailAction === "send"
          ? await sendTrackedEmail(
              {
                fromName: context.organization.name,
                to: [{ email: recipient }],
                subject,
                text: body
              },
              { organizationId: context.organizationId, userId: context.userId, sourceType: "EmailActivity" }
            )
          : null;
      const record = await prisma.emailActivity.create({
        data: {
          organizationId: context.organizationId,
          to: recipient,
          from:
            emailAction === "send"
              ? String(process.env.SENDGRID_EMAIL ?? "")
              : String(context.user.email ?? context.user.name),
          subject,
          body,
          relatedObjectType: payload.relatedObjectType,
          relatedRecordId: payload.relatedRecordId
        }
      });
      await attachTrackedDeliveries(delivery?.deliveryIds, {
        organizationId: context.organizationId,
        userId: context.userId,
        sourceType: "EmailActivity",
        sourceId: record.id
      });
      return NextResponse.json({ record: JSON.parse(JSON.stringify(record)), emailAction, delivery }, { status: 201 });
    }

    if (type === "call") {
      const record = await prisma.callActivity.create({
        data: {
          organizationId: context.organizationId,
          subject: String(payload.subject ?? "Call"),
          comments: payload.comments,
          relatedObjectType: payload.relatedObjectType,
          relatedRecordId: payload.relatedRecordId
        }
      });
      return NextResponse.json({ record: JSON.parse(JSON.stringify(record)) }, { status: 201 });
    }

    const dueDate = payload.dueDate ? new Date(String(payload.dueDate)) : null;
    if (dueDate && !Number.isFinite(dueDate.getTime()))
      throw new ActivityValidationError("Choose a valid task due date.");
    const status = String(payload.status ?? "Not Started");
    if (!["Not Started", "In Progress", "Completed", "Deferred"].includes(status))
      throw new ActivityValidationError("Choose a valid task status.");
    const priority = String(payload.priority ?? "Normal");
    if (!["Low", "Normal", "High"].includes(priority))
      throw new ActivityValidationError("Choose a valid task priority.");
    const record = await prisma.task.create({
      data: {
        organizationId: context.organizationId,
        subject: String(payload.subject ?? "Task"),
        dueDate,
        status,
        priority,
        ownerId: context.userId,
        relatedObjectType: payload.relatedObjectType,
        relatedRecordId: payload.relatedRecordId
      }
    });

    return NextResponse.json({ record: JSON.parse(JSON.stringify(record)) }, { status: 201 });
  } catch (error) {
    console.error(error);
    const response = authorizationErrorResponse(error);
    if (response) return response;
    const deliveryResponse = emailErrorResponse(error);
    if (deliveryResponse) return deliveryResponse;
    if (error instanceof ActivityValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: "Unable to create activity." }, { status: 500 });
  }
}
