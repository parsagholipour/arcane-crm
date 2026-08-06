import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { readOrganizationLogo } from "@/lib/minio";
import { authorizationErrorResponse, requireAuthenticatedUser } from "@/lib/organization-context";
import { prisma } from "@/lib/prisma";
import { isSuperAdminEmail } from "@/lib/super-admin-constants";

type Params = Promise<{ organizationId: string }>;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Params }) {
  try {
    const user = await requireAuthenticatedUser();
    const { organizationId } = await context.params;
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { logoObjectKey: true }
    });
    if (!organization?.logoObjectKey) return NextResponse.json({ error: "Logo not found." }, { status: 404 });

    if (!isSuperAdminEmail(user.email)) {
      const membership = await prisma.organizationMembership.findFirst({
        where: { organizationId, userId: user.id, status: "ACTIVE", organization: { status: "ACTIVE" } },
        select: { id: true }
      });
      if (!membership) return NextResponse.json({ error: "Logo not found." }, { status: 404 });
    }

    const object = await readOrganizationLogo(organization.logoObjectKey);
    const body = Readable.toWeb(object.stream) as ReadableStream<Uint8Array>;
    return new NextResponse(body, {
      headers: {
        "Cache-Control": "private, max-age=86400, immutable",
        "Content-Length": String(object.size),
        "Content-Type": object.contentType,
        ETag: `"${object.etag}"`,
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    console.error("[minio] organization logo read failed", error);
    return authorizationErrorResponse(error) ?? NextResponse.json({ error: "Unable to read logo." }, { status: 500 });
  }
}
