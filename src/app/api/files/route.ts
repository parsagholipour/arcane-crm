import { CURRENT_USER } from "@/lib/crm-metadata";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const payload = await request.json();
  const attachment = Boolean(payload.attachment);

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ record: { ...payload, id: `file-${Date.now()}`, uploadedAt: new Date().toISOString() } }, { status: 201 });
  }

  try {
    const data = {
      name: String(payload.name ?? "Uploaded File"),
      size: payload.size ? Number(payload.size) : null,
      relatedObjectType: payload.relatedObjectType,
      relatedRecordId: payload.relatedRecordId,
      uploadedById: CURRENT_USER.id
    };

    const record = attachment
      ? await prisma.attachmentRecord.create({ data })
      : await prisma.fileRecord.create({ data });

    return NextResponse.json({ record: JSON.parse(JSON.stringify(record)) }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unable to upload file." }, { status: 500 });
  }
}
