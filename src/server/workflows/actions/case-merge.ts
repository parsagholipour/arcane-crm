import { prisma } from "@/lib/prisma";
import { DomainActionValidationError as WorkflowValidationError } from "@/server/workflows/actions/errors";

export async function mergeCases(
  ids: string[],
  values: Record<string, unknown>,
  organizationId: string,
  userId: string
) {
  if (ids.length < 2) throw new WorkflowValidationError("Select at least two cases to merge.");
  return prisma.$transaction(async (tx) => {
    const cases = await tx.caseRecord.findMany({ where: { organizationId, id: { in: ids } } });
    if (cases.length !== new Set(ids).size)
      throw new WorkflowValidationError("One or more cases could not be found.", 409);
    const primaryHint = String(values.primaryCase ?? "");
    const primary = cases.find((item) => item.id === primaryHint || item.caseNumber === primaryHint) ?? cases[0];
    const mergedIds = cases.filter((item) => item.id !== primary.id).map((item) => item.id);

    await Promise.all([
      tx.task.updateMany({
        where: { organizationId, relatedObjectType: "Case", relatedRecordId: { in: mergedIds } },
        data: { relatedRecordId: primary.id }
      }),
      tx.emailActivity.updateMany({
        where: { organizationId, relatedObjectType: "Case", relatedRecordId: { in: mergedIds } },
        data: { relatedRecordId: primary.id }
      }),
      tx.callActivity.updateMany({
        where: { organizationId, relatedObjectType: "Case", relatedRecordId: { in: mergedIds } },
        data: { relatedRecordId: primary.id }
      }),
      tx.event.updateMany({
        where: { organizationId, relatedObjectType: "Case", relatedRecordId: { in: mergedIds } },
        data: { relatedRecordId: primary.id }
      }),
      tx.event.updateMany({
        where: { organizationId, nameObjectType: "Case", nameRecordId: { in: mergedIds } },
        data: { nameRecordId: primary.id }
      }),
      tx.fileRecord.updateMany({
        where: { organizationId, relatedObjectType: "Case", relatedRecordId: { in: mergedIds } },
        data: { relatedRecordId: primary.id }
      }),
      tx.attachmentRecord.updateMany({
        where: { organizationId, relatedObjectType: "Case", relatedRecordId: { in: mergedIds } },
        data: { relatedRecordId: primary.id }
      })
    ]);

    await tx.caseRecord.update({
      where: { id: primary.id },
      data: {
        subject: primary.subject ? `${primary.subject} (merged)` : "Merged Case",
        description: [primary.description, `Merged cases: ${mergedIds.join(", ")}`].filter(Boolean).join("\n"),
        updatedById: userId
      }
    });
    await tx.caseRecord.updateMany({
      where: { organizationId, id: { in: mergedIds } },
      data: {
        status: "Closed",
        closedAt: new Date(),
        subject: `Merged into ${primary.caseNumber}`,
        updatedById: userId
      }
    });
    return { primaryCaseId: primary.id, mergedCaseIds: mergedIds };
  });
}
