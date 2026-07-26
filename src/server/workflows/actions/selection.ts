import { AppAuthorizationError } from "@/lib/organization-context";
import { prisma } from "@/lib/prisma";

export async function assertSelectedRecords(object: string, ids: string[], organizationId: string) {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return;
  const count =
    object === "Account"
      ? await prisma.account.count({ where: { organizationId, id: { in: uniqueIds } } })
      : object === "Contact"
        ? await prisma.contact.count({ where: { organizationId, id: { in: uniqueIds } } })
        : object === "Lead"
          ? await prisma.lead.count({ where: { organizationId, id: { in: uniqueIds } } })
          : object === "Opportunity"
            ? await prisma.opportunity.count({ where: { organizationId, id: { in: uniqueIds } } })
            : object === "Case"
              ? await prisma.caseRecord.count({ where: { organizationId, id: { in: uniqueIds } } })
              : object === "Product2"
                ? await prisma.product.count({ where: { organizationId, id: { in: uniqueIds } } })
                : object === "Pricebook2"
                  ? await prisma.priceBook.count({ where: { organizationId, id: { in: uniqueIds } } })
                  : object === "Event"
                    ? await prisma.event.count({ where: { organizationId, id: { in: uniqueIds } } })
                    : object === "QuickText"
                      ? await prisma.quickText.count({ where: { organizationId, id: { in: uniqueIds } } })
                      : object === "Knowledge__kav"
                        ? await prisma.knowledgeArticle.count({ where: { organizationId, id: { in: uniqueIds } } })
                        : object === "ListEmail"
                          ? await prisma.listEmail.count({ where: { organizationId, id: { in: uniqueIds } } })
                          : uniqueIds.length;
  if (count !== uniqueIds.length) throw new AppAuthorizationError("One or more selected records were not found.", 404);
}
