import { assertRelatedOrganizationRecord, authorizationErrorResponse, requireOrganizationContext } from "@/lib/organization-context";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const context = await requireOrganizationContext();
    const payload = await request.json();
    const attachment = Boolean(payload.attachment);
    await assertRelatedOrganizationRecord(context.organizationId, payload.relatedObjectType, payload.relatedRecordId);
    const data = {
      organizationId: context.organizationId,
      name: String(payload.name ?? "Uploaded File"),
      size: payload.size ? Number(payload.size) : null,
      relatedObjectType: payload.relatedObjectType,
      relatedRecordId: payload.relatedRecordId,
      uploadedById: context.userId
    };

    const record = attachment
      ? await prisma.attachmentRecord.create({ data })
      : await prisma.fileRecord.create({ data });

    return NextResponse.json({ record: JSON.parse(JSON.stringify(record)) }, { status: 201 });
  } catch (error) {
    console.error(error);
    const response = authorizationErrorResponse(error);
    if (response) return response;
    return NextResponse.json({ error: "Unable to upload file." }, { status: 500 });
  }
}
