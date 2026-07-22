import { authorizationErrorResponse, requireOrganizationContext } from "@/lib/organization-context";
import { contentDisposition, isPreviewableContentType } from "@/lib/files";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type Params = Promise<{ id: string }>;
type StoredFile = { id: string; name: string; size: number | null; contentType: string | null; checksum: string | null; content: Uint8Array | null; attachment: boolean };

export const dynamic = "force-dynamic";

async function findStoredFile(organizationId: string, id: string, requestedKind: string | null): Promise<StoredFile | null> {
  if (requestedKind !== "attachment") {
    const file = await prisma.fileRecord.findFirst({
      where: { id, organizationId },
      select: { id: true, name: true, size: true, contentType: true, checksum: true, content: true }
    });
    if (file) return { ...file, attachment: false };
  }
  if (requestedKind !== "file") {
    const attachment = await prisma.attachmentRecord.findFirst({
      where: { id, organizationId },
      select: { id: true, name: true, size: true, contentType: true, checksum: true, content: true }
    });
    if (attachment) return { ...attachment, attachment: true };
  }
  return null;
}

export async function GET(request: NextRequest, context: { params: Params }) {
  try {
    const authContext = await requireOrganizationContext();
    const { id } = await context.params;
    const stored = await findStoredFile(authContext.organizationId, id, request.nextUrl.searchParams.get("kind"));
    if (!stored) return NextResponse.json({ error: "File not found." }, { status: 404 });
    if (!stored.content) return NextResponse.json({ error: "File content is unavailable for this legacy metadata-only record." }, { status: 410 });

    const requestedInline = request.nextUrl.searchParams.get("disposition") === "inline";
    const inline = requestedInline && isPreviewableContentType(stored.contentType);
    const headers = new Headers({
      "Content-Type": stored.contentType || "application/octet-stream",
      "Content-Length": String(stored.content.byteLength),
      "Content-Disposition": contentDisposition(stored.name, inline),
      "Cache-Control": "private, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff"
    });
    if (stored.checksum) headers.set("ETag", `"sha256-${stored.checksum}"`);
    if (inline) headers.set("Content-Security-Policy", "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'");
    const responseBytes = new Uint8Array(stored.content.byteLength);
    responseBytes.set(stored.content);
    return new NextResponse(responseBytes.buffer, { status: 200, headers });
  } catch (error) {
    console.error(error);
    const response = authorizationErrorResponse(error);
    if (response) return response;
    return NextResponse.json({ error: "Unable to read file." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Params }) {
  try {
    const authContext = await requireOrganizationContext();
    const { id } = await context.params;
    const stored = await findStoredFile(authContext.organizationId, id, request.nextUrl.searchParams.get("kind"));
    if (!stored) return NextResponse.json({ error: "File not found." }, { status: 404 });
    if (stored.attachment) await prisma.attachmentRecord.deleteMany({ where: { id, organizationId: authContext.organizationId } });
    else await prisma.fileRecord.deleteMany({ where: { id, organizationId: authContext.organizationId } });
    return NextResponse.json({ ok: true, id, attachment: stored.attachment });
  } catch (error) {
    console.error(error);
    const response = authorizationErrorResponse(error);
    if (response) return response;
    return NextResponse.json({ error: "Unable to delete file." }, { status: 500 });
  }
}
