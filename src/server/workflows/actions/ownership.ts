import { AppAuthorizationError } from "@/lib/organization-context";
import { prisma } from "@/lib/prisma";
import { emitLeadUpdated } from "@/lib/public-api/emit";

export async function resolveOwner(organizationId: string, value: string) {
  const membership = await prisma.organizationMembership.findFirst({
    where: {
      organizationId,
      status: "ACTIVE",
      user: {
        status: "ACTIVE",
        OR: [
          { id: value },
          { name: { equals: value, mode: "insensitive" } },
          { alias: { equals: value, mode: "insensitive" } }
        ]
      }
    },
    include: { user: true }
  });
  if (!membership) throw new AppAuthorizationError("The selected owner is not an active organization member.", 404);
  return membership.user;
}

export async function changeOwner(
  object: string,
  ids: string[],
  ownerId: string,
  organizationId: string,
  userId: string
) {
  if (ids.length === 0) return [];
  switch (object) {
    case "Account": {
      await prisma.account.updateMany({
        where: { organizationId, id: { in: ids } },
        data: { ownerId, updatedById: userId }
      });
      return prisma.account.findMany({ where: { organizationId, id: { in: ids } } });
    }
    case "Contact": {
      await prisma.contact.updateMany({
        where: { organizationId, id: { in: ids } },
        data: { ownerId, updatedById: userId }
      });
      return prisma.contact.findMany({ where: { organizationId, id: { in: ids } }, include: { account: true } });
    }
    case "Lead": {
      await prisma.lead.updateMany({
        where: { organizationId, id: { in: ids } },
        data: { ownerId, updatedById: userId }
      });
      const records = await prisma.lead.findMany({ where: { organizationId, id: { in: ids } } });
      for (const lead of records) await emitLeadUpdated(organizationId, lead.id);
      return records;
    }
    case "Opportunity": {
      await prisma.opportunity.updateMany({
        where: { organizationId, id: { in: ids } },
        data: { ownerId, updatedById: userId }
      });
      return prisma.opportunity.findMany({
        where: { organizationId, id: { in: ids } },
        include: { account: true, contact: true }
      });
    }
    case "Case": {
      await prisma.caseRecord.updateMany({
        where: { organizationId, id: { in: ids } },
        data: { ownerId, updatedById: userId }
      });
      return prisma.caseRecord.findMany({
        where: { organizationId, id: { in: ids } },
        include: { account: true, contact: true }
      });
    }
    case "Knowledge__kav": {
      await prisma.knowledgeArticle.updateMany({
        where: { organizationId, id: { in: ids } },
        data: { updatedById: ownerId }
      });
      return prisma.knowledgeArticle.findMany({ where: { organizationId, id: { in: ids } } });
    }
    default:
      return [];
  }
}
