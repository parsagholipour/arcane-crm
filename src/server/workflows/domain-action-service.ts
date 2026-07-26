import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizationErrorResponse, requireOrganizationContext } from "@/lib/organization-context";
import { prisma } from "@/lib/prisma";
import { commerceErrorResponse, createCommerceStore } from "@/lib/commerce";
import { LeadConversionValidationError } from "@/lib/lead-conversion";
import { mergeCases } from "@/server/workflows/actions/case-merge";
import { DomainActionValidationError } from "@/server/workflows/actions/errors";
import { convertLeads } from "@/server/workflows/actions/lead-conversion";
import { changeOwner, resolveOwner } from "@/server/workflows/actions/ownership";
import { assertSelectedRecords } from "@/server/workflows/actions/selection";

const domainActionNames = [
  "Assign Label",
  "Add to Campaign",
  "Change Owner",
  "Add to Category",
  "Convert Lead",
  "New Folder",
  "Create Store",
  "Activate Marketing",
  "Publish",
  "Assign",
  "Archive",
  "Delete Article",
  "Delete Draft",
  "Restore",
  "Merge Cases"
] as const;

const domainActionPayloadSchema = z.object({
  action: z.enum(domainActionNames),
  object: z.string().min(1),
  selectedIds: z.array(z.string().min(1)).default([]),
  values: z.record(z.string(), z.unknown()).default({})
});

export async function executeDomainActionRequest(request: NextRequest) {
  try {
    const context = await requireOrganizationContext();
    const parsed = domainActionPayloadSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_ACTION",
            message: "Invalid domain action.",
            fieldErrors: parsed.error.flatten().fieldErrors
          }
        },
        { status: 400 }
      );
    }
    const payload = parsed.data;
    const values = payload.values ?? {};
    const selectedIds = payload.selectedIds ?? [];
    const result = await runDomainAction(
      payload.action,
      payload.object,
      selectedIds,
      values,
      context.organizationId,
      context.userId
    );
    return NextResponse.json({ ok: true, ...JSON.parse(JSON.stringify(result)) });
  } catch (error) {
    console.error(error);
    const response = authorizationErrorResponse(error);
    if (response) return response;
    const commerce = commerceErrorResponse(error);
    if (commerce)
      return NextResponse.json({ error: commerce.error, field: commerce.field }, { status: commerce.status });
    if (error instanceof DomainActionValidationError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof LeadConversionValidationError) {
      return NextResponse.json({ error: error.message, field: error.field }, { status: error.status });
    }
    return NextResponse.json({ error: "Unable to complete workflow." }, { status: 500 });
  }
}

async function runDomainAction(
  action: string,
  object: string,
  selectedIds: string[],
  values: Record<string, unknown>,
  organizationId: string,
  userId: string
) {
  await assertSelectedRecords(object, selectedIds, organizationId);
  if (
    [
      "Assign Label",
      "Add to Campaign",
      "Change Owner",
      "Add to Category",
      "Convert Lead",
      "Publish",
      "Assign",
      "Archive",
      "Delete Article",
      "Delete Draft",
      "Restore",
      "Merge Cases"
    ].includes(action) &&
    selectedIds.length === 0
  ) {
    throw new DomainActionValidationError("Select at least one record before running this action.");
  }
  if (action === "Assign Label") {
    const label = String(values.label ?? "").trim();
    if (!label) throw new DomainActionValidationError("Label is required.");
    const color = String(values.color ?? "blue");
    const labels = await Promise.all(
      selectedIds.map((recordId) =>
        prisma.recordLabel.upsert({
          where: { organizationId_objectType_recordId_label: { organizationId, objectType: object, recordId, label } },
          update: { color },
          create: { organizationId, objectType: object, recordId, label, color, createdById: userId }
        })
      )
    );
    return { labels };
  }

  if (action === "Add to Campaign") {
    if (!["Contact", "Lead"].includes(object))
      throw new DomainActionValidationError("Only Contacts and Leads can be added to a campaign.");
    const campaignName = String(values.campaign ?? "").trim();
    if (!campaignName) throw new DomainActionValidationError("Campaign name is required.");
    const status = String(values.status ?? "Sent");
    const campaign = await prisma.campaign.upsert({
      where: { organizationId_name: { organizationId, name: campaignName } },
      update: { status: "In Progress", ownerId: userId },
      create: {
        organizationId,
        name: campaignName,
        status: "In Progress",
        ownerId: userId,
        createdById: userId,
        activatedAt: new Date()
      }
    });
    const campaignMembers = await Promise.all(
      selectedIds.map((recordId) =>
        prisma.campaignMember.upsert({
          where: {
            organizationId_campaignId_objectType_recordId: {
              organizationId,
              campaignId: campaign.id,
              objectType: object,
              recordId
            }
          },
          update: { status },
          create: { organizationId, campaignId: campaign.id, objectType: object, recordId, status }
        })
      )
    );
    return { campaign, campaignMembers };
  }

  if (action === "Change Owner") {
    const owner = await resolveOwner(organizationId, String(values.ownerId ?? values.ownerName ?? userId));
    const records = await changeOwner(object, selectedIds, owner.id, organizationId, userId);
    return { ownerName: owner.name, ownerId: owner.id, records };
  }

  if (action === "Add to Category" && object === "Product2") {
    const category = String(values.category ?? "Products").trim() || "Products";
    const records = await prisma.product.updateManyAndReturn({
      where: { organizationId, ...(selectedIds.length ? { id: { in: selectedIds } } : {}) },
      data: { category }
    });
    return { category, records };
  }

  if (action === "Convert Lead") {
    return convertLeads(selectedIds, values, organizationId, userId);
  }

  if (action === "New Folder") {
    const name = String(values.name ?? "").trim();
    if (!name) throw new DomainActionValidationError("Folder name is required.");
    const folder = await prisma.quickTextFolder.create({
      data: {
        organizationId,
        name,
        ownerId: userId,
        sharing: String(values.sharing ?? "Private")
      }
    });
    return { folder };
  }

  if (action === "Create Store") {
    return createCommerceStore(organizationId, userId, values);
  }

  if (action === "Activate Marketing") {
    const senderName = String(values.senderName ?? "").trim();
    const senderEmail = String(values.senderEmail ?? "").trim();
    if (!senderName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail))
      throw new DomainActionValidationError("A sender name and valid sender email are required.");
    const activationId = String(values.id ?? "").trim();
    const existing = activationId
      ? await prisma.marketingActivation.findFirst({ where: { id: activationId, organizationId } })
      : null;
    if (activationId && !existing) throw new DomainActionValidationError("Marketing activation not found.", 409);
    const activation = existing
      ? await prisma.marketingActivation.update({
          where: { id: existing.id },
          data: { senderName, senderEmail, tracking: values.tracking !== false, active: true, activatedById: userId }
        })
      : await prisma.marketingActivation.create({
          data: {
            organizationId,
            senderName,
            senderEmail,
            tracking: values.tracking !== false,
            active: true,
            activatedById: userId
          }
        });
    return { activation };
  }

  if (action === "Publish") {
    const articles = await prisma.knowledgeArticle.findMany({ where: { organizationId, id: { in: selectedIds } } });
    if (articles.some((article) => article.publicationStatus !== "Draft"))
      throw new DomainActionValidationError("Only Draft articles can be published.", 409);
    if (articles.some((article) => !article.title.trim() || !article.urlName.trim() || !article.bodyRichText?.trim()))
      throw new DomainActionValidationError("Title, URL Name, and article body are required before publishing.");
    await prisma.knowledgeArticle.updateMany({
      where: { organizationId, id: { in: selectedIds } },
      data: { publicationStatus: "Published", publishedAt: new Date(), validationStatus: "Validated" }
    });
    return {};
  }

  if (action === "Assign") {
    const assignee = await resolveOwner(organizationId, String(values.assigneeId ?? values.assignee ?? userId));
    await prisma.knowledgeArticle.updateMany({
      where: { organizationId, id: { in: selectedIds } },
      data: { updatedById: assignee.id }
    });
    return {};
  }

  if (action === "Archive") {
    const invalid = await prisma.knowledgeArticle.count({
      where: { organizationId, id: { in: selectedIds }, publicationStatus: { not: "Published" } }
    });
    if (invalid) throw new DomainActionValidationError("Only Published articles can be archived.", 409);
    await prisma.knowledgeArticle.updateMany({
      where: { organizationId, id: { in: selectedIds } },
      data: { publicationStatus: "Archived", archivedAt: new Date(), archivedById: userId }
    });
    return {};
  }

  if (action === "Delete Article") {
    await prisma.knowledgeArticle.deleteMany({
      where: { organizationId, id: { in: selectedIds } }
    });
    return {};
  }

  if (action === "Delete Draft") {
    await prisma.knowledgeArticle.deleteMany({
      where: {
        organizationId,
        id: { in: selectedIds },
        publicationStatus: "Draft"
      }
    });
    return {};
  }

  if (action === "Restore") {
    const invalid = await prisma.knowledgeArticle.count({
      where: { organizationId, id: { in: selectedIds }, publicationStatus: { not: "Archived" } }
    });
    if (invalid) throw new DomainActionValidationError("Only Archived articles can be restored.", 409);
    await prisma.knowledgeArticle.updateMany({
      where: { organizationId, id: { in: selectedIds } },
      data: {
        publicationStatus: "Draft",
        validationStatus: "Not Validated",
        archivedAt: null,
        archivedById: null,
        updatedById: userId
      }
    });
    return {};
  }

  if (action === "Merge Cases") {
    return mergeCases(selectedIds, values, organizationId, userId);
  }

  throw new DomainActionValidationError(`Unsupported workflow action: ${action || "(empty)"}.`);
}
