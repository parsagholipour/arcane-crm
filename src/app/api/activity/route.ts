import { CURRENT_USER } from "@/lib/crm-metadata";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const payload = await request.json();
  const type = String(payload.type);

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ record: { ...payload, id: `${type}-${Date.now()}`, createdAt: new Date().toISOString() } }, { status: 201 });
  }

  try {
    if (type === "email") {
      const record = await prisma.emailActivity.create({
        data: {
          to: String(payload.to ?? ""),
          from: CURRENT_USER.name,
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
        subject: String(payload.subject ?? "Task"),
        dueDate: payload.dueDate ? new Date(String(payload.dueDate)) : null,
        status: String(payload.status ?? "Not Started"),
        priority: String(payload.priority ?? "Normal"),
        ownerId: CURRENT_USER.id,
        relatedObjectType: payload.relatedObjectType,
        relatedRecordId: payload.relatedRecordId
      }
    });

    return NextResponse.json({ record: JSON.parse(JSON.stringify(record)) }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unable to create activity." }, { status: 500 });
  }
}
