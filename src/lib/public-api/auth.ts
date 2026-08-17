import "server-only";

import { AppAuthorizationError } from "@/lib/authorization-errors";
import { prisma } from "@/lib/prisma";
import { hashSecret, parseBearerToken } from "@/lib/public-api/token";

const LAST_USED_THROTTLE_MS = 60_000;

export type OrganizationApiTokenContext = {
  organizationId: string;
  organization: { id: string; name: string; slug: string; status: "ACTIVE" | "SUSPENDED" };
};

export async function requireOrganizationApiToken(request: Request): Promise<OrganizationApiTokenContext> {
  const token = parseBearerToken(request.headers.get("authorization"));
  if (!token) throw new AppAuthorizationError("Authentication required.", 401);

  const access = await prisma.organizationApiAccess.findUnique({
    where: { tokenHash: hashSecret(token) },
    include: { organization: { select: { id: true, name: true, slug: true, status: true } } }
  });
  if (!access?.organization) throw new AppAuthorizationError("Authentication required.", 401);
  if (access.organization.status !== "ACTIVE") {
    throw new AppAuthorizationError("This organization is not available.", 403);
  }

  const now = Date.now();
  if (!access.lastUsedAt || now - access.lastUsedAt.getTime() > LAST_USED_THROTTLE_MS) {
    await prisma.organizationApiAccess.update({
      where: { organizationId: access.organizationId },
      data: { lastUsedAt: new Date(now) }
    });
  }

  return { organizationId: access.organizationId, organization: access.organization };
}
