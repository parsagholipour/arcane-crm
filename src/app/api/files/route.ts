import { createHash } from "node:crypto";
import { authorizationErrorResponse, assertRelatedOrganizationRecord, requireOrganizationContext } from "@/lib/organization-context";
import { FileValidationError, validateFileMetadata } from "@/lib/files";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const context = await requireOrganizationContext();
    if (!request.headers.get("content-type")?.toLowerCase().includes("multipart/form-data")) {
      return NextResponse.json({ error: "File uploads must use multipart form data." }, { status: 415 });
    }

    const payload = await request.formData();
    const uploaded = payload.get("file");
    if (!(uploaded instanceof File)) throw new FileValidationError("Choose a file to upload.");
    const attachment = String(payload.get("attachment") ?? "false") === "true";
    const relatedObjectType = String(payload.get("relatedObjectType") ?? "").trim() || null;
    const relatedRecordId = String(payload.get("relatedRecordId") ?? "").trim() || null;
    await assertRelatedOrganizationRecord(context.organizationId, relatedObjectType, relatedRecordId);

    const metadata = validateFileMetadata(uploaded.name, uploaded.size, uploaded.type);
    const bytes = new Uint8Array(await uploaded.arrayBuffer());
    if (bytes.byteLength !== uploaded.size) throw new FileValidationError("The uploaded file was incomplete.");
    const checksum = createHash("sha256").update(bytes).digest("hex");
    const data = {
      organizationId: context.organizationId,
      name: metadata.name,
      size: bytes.byteLength,
      contentType: metadata.contentType,
      checksum,
      content: bytes,
      relatedObjectType,
      relatedRecordId,
      uploadedById: context.userId
    };

    const record = attachment
      ? await prisma.attachmentRecord.create({ data, omit: { content: true } })
      : await prisma.fileRecord.create({ data, omit: { content: true } });

    return NextResponse.json({ record: JSON.parse(JSON.stringify(record)), attachment }, { status: 201 });
  } catch (error) {
    console.error(error);
    const response = authorizationErrorResponse(error);
    if (response) return response;
    if (error instanceof FileValidationError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Unable to upload file." }, { status: 500 });
  }
}
