import "server-only";

import type { Prisma } from "@prisma/client";
import { AppAuthorizationError } from "@/lib/authorization-errors";
import { prisma } from "@/lib/prisma";

export async function activateOrganizationForUser(
  userId: string,
  organizationId: string,
  missingStatus: 403 | 404 = 403,
  dependencies: {
    findMembership?: () => Promise<Prisma.OrganizationMembershipGetPayload<{ include: { organization: true } }> | null>;
    touchMembership?: (membershipId: string, accessedAt: Date) => Promise<void>;
    now?: () => Date;
  } = {}
) {
  const membership = await (dependencies.findMembership?.() ?? prisma.organizationMembership.findFirst({
    where: {
      organizationId,
      userId,
      status: "ACTIVE",
      user: { status: "ACTIVE" },
      organization: { status: "ACTIVE" }
    },
    include: { organization: true }
  }));
  if (!membership) throw new AppAuthorizationError("Active organization membership not found.", missingStatus);
  const accessedAt = dependencies.now?.() ?? new Date();
  await (dependencies.touchMembership ?? (async (membershipId, timestamp) => {
    await prisma.organizationMembership.update({ where: { id: membershipId }, data: { lastAccessedAt: timestamp } });
  }))(membership.id, accessedAt);
  return membership;
}
