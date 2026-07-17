import { assertRelatedOrganizationRecord, authorizationErrorResponse, requireOrganizationContext } from "@/lib/organization-context";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const context = await requireOrganizationContext();
    const payload = await request.json();
    const type = String(payload.type);
    await assertRelatedOrganizationRecord(context.organizationId, payload.relatedObjectType, payload.relatedRecordId);
    if (type === "email") {
      const record = await prisma.emailActivity.create({
        data: {
          organizationId: context.organizationId,
          to: String(payload.to ?? ""),
          from: context.user.name,
          subject: String(payload.subject ?? "Email"),
          body: payload.body,
          relatedObjectType: payload.relatedObjectType,
          relatedRecordId: payload.relatedRecordId
        }
      });
      return NextResponse.json({ record: JSON.parse(JSON.stringify(record)) }, { status: 201 });
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

    const record = await prisma.task.create({
      data: {
        organizationId: context.organizationId,
        subject: String(payload.subject ?? "Task"),
        dueDate: payload.dueDate ? new Date(String(payload.dueDate)) : null,
        status: String(payload.status ?? "Not Started"),
        priority: String(payload.priority ?? "Normal"),
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
    return NextResponse.json({ error: "Unable to create activity." }, { status: 500 });
  }
}
