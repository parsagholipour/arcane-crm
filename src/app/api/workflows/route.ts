import { CURRENT_USER } from "@/lib/crm-metadata";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type WorkflowPayload = {
  action: string;
  object: string;
  selectedIds?: string[];
  values?: Record<string, unknown>;
};

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as WorkflowPayload;
  const values = payload.values ?? {};
  const selectedIds = payload.selectedIds ?? [];

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: true, fallback: true, action: payload.action });
  }

  try {
    const result = await runWorkflow(payload.action, payload.object, selectedIds, values);
    return NextResponse.json({ ok: true, ...JSON.parse(JSON.stringify(result)) });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unable to complete workflow." }, { status: 500 });
  }
}

async function runWorkflow(action: string, object: string, selectedIds: string[], values: Record<string, unknown>) {
  if (action === "Assign Label") {
    const label = String(values.label ?? "Important");
    const color = String(values.color ?? "blue");
    const labels = await Promise.all(
      selectedIds.map((recordId) =>
        prisma.recordLabel.upsert({
          where: { objectType_recordId_label: { objectType: object, recordId, label } },
          update: { color },
          create: { objectType: object, recordId, label, color, createdById: CURRENT_USER.id }
        })
      )
    );
    return { labels };
  }

  if (action === "Add to Campaign") {
    const campaignName = String(values.campaign ?? "Starter Outreach");
    const status = String(values.status ?? "Sent");
    const campaign = await prisma.campaign.upsert({
      where: { name: campaignName },
      update: { status: "In Progress", ownerId: CURRENT_USER.id },
      create: { name: campaignName, status: "In Progress", ownerId: CURRENT_USER.id }
    });
    const campaignMembers = await Promise.all(
      selectedIds.map((recordId) =>
        prisma.campaignMember.upsert({
          where: { campaignId_objectType_recordId: { campaignId: campaign.id, objectType: object, recordId } },
          update: { status },
          create: { campaignId: campaign.id, objectType: object, recordId, status }
        })
      )
    );
    return { campaign, campaignMembers };
  }

  if (action === "Change Owner") {
    const ownerName = String(values.ownerName ?? CURRENT_USER.name);
    const records = await changeOwner(object, selectedIds, ownerName);
    return { ownerName, records };
  }

  if (action === "New Folder") {
    const folder = await prisma.quickTextFolder.create({
      data: {
        name: String(values.name ?? "Personal Quick Text"),
        ownerId: CURRENT_USER.id,
        sharing: String(values.sharing ?? "Private")
      }
    });
    return { folder };
  }

  if (action === "Create Store") {
    const store = await prisma.marketingStore.create({
      data: {
        name: String(values.name ?? "Starter Store"),
        currency: String(values.currency ?? "USD"),
        status: String(values.status ?? "Draft")
      }
    });
    return { store };
  }

  if (action === "Activate Marketing") {
    const activation = await prisma.marketingActivation.create({
      data: {
        senderName: String(values.senderName ?? CURRENT_USER.name),
        senderEmail: String(values.senderEmail ?? "parsa@example.com"),
        tracking: values.tracking !== false,
        active: true,
        activatedById: CURRENT_USER.id
      }
    });
    return { activation };
  }

  if (action === "Buy Now") {
    const checkout = await prisma.subscriptionCheckout.create({
      data: {
        plan: String(values.plan ?? "Starter Suite"),
        seats: Number(values.seats ?? 1),
        code: values.code ? String(values.code) : null,
        status: "Prepared",
        userId: CURRENT_USER.id
      }
    });
    return { checkout };
  }

  if (action === "Publish") {
    await prisma.knowledgeArticle.updateMany({
      where: selectedIds.length ? { id: { in: selectedIds } } : undefined,
      data: { publicationStatus: "Published", publishedAt: new Date(), validationStatus: "Validated" }
    });
    return {};
  }

  if (action === "Assign") {
    await prisma.knowledgeArticle.updateMany({
      where: selectedIds.length ? { id: { in: selectedIds } } : undefined,
      data: { updatedById: String(values.assignee ?? CURRENT_USER.id) }
    });
    return {};
  }

  if (action === "Archive") {
    await prisma.knowledgeArticle.updateMany({
      where: selectedIds.length ? { id: { in: selectedIds } } : undefined,
      data: { publicationStatus: "Archived", archivedAt: new Date(), archivedById: CURRENT_USER.id }
    });
    return {};
  }

  if (action === "Delete Article") {
    await prisma.knowledgeArticle.deleteMany({
      where: selectedIds.length ? { id: { in: selectedIds } } : undefined
    });
    return {};
  }

  if (action === "Delete Draft") {
    await prisma.knowledgeArticle.deleteMany({
      where: {
        ...(selectedIds.length ? { id: { in: selectedIds } } : {}),
        publicationStatus: "Draft"
      }
    });
    return {};
  }

  if (action === "Restore") {
    await prisma.knowledgeArticle.updateMany({
      where: selectedIds.length ? { id: { in: selectedIds } } : { publicationStatus: "Archived" },
      data: {
        publicationStatus: "Draft",
        validationStatus: "Not Validated",
        archivedAt: null,
        archivedById: null,
        updatedById: CURRENT_USER.id
      }
    });
    return {};
  }

  if (action === "Merge Cases") {
    await mergeCases(selectedIds, values);
    return {};
  }

  return {};
}

async function changeOwner(object: string, ids: string[], ownerId: string) {
  if (ids.length === 0) return [];
  switch (object) {
    case "Account": {
      await prisma.account.updateMany({ where: { id: { in: ids } }, data: { ownerId, updatedById: CURRENT_USER.id } });
      return prisma.account.findMany({ where: { id: { in: ids } } });
    }
    case "Contact": {
      await prisma.contact.updateMany({ where: { id: { in: ids } }, data: { ownerId, updatedById: CURRENT_USER.id } });
      return prisma.contact.findMany({ where: { id: { in: ids } }, include: { account: true } });
    }
    case "Lead": {
      await prisma.lead.updateMany({ where: { id: { in: ids } }, data: { ownerId, updatedById: CURRENT_USER.id } });
      return prisma.lead.findMany({ where: { id: { in: ids } } });
    }
    case "Opportunity": {
      await prisma.opportunity.updateMany({ where: { id: { in: ids } }, data: { ownerId, updatedById: CURRENT_USER.id } });
      return prisma.opportunity.findMany({ where: { id: { in: ids } }, include: { account: true, contact: true } });
    }
    case "Case": {
      await prisma.caseRecord.updateMany({ where: { id: { in: ids } }, data: { ownerId, updatedById: CURRENT_USER.id } });
      return prisma.caseRecord.findMany({ where: { id: { in: ids } }, include: { account: true, contact: true } });
    }
    case "Knowledge__kav": {
      await prisma.knowledgeArticle.updateMany({ where: { id: { in: ids } }, data: { updatedById: ownerId } });
      return prisma.knowledgeArticle.findMany({ where: { id: { in: ids } } });
    }
    default:
      return [];
  }
}

async function mergeCases(ids: string[], values: Record<string, unknown>) {
  if (ids.length < 2) return;
  const cases = await prisma.caseRecord.findMany({ where: { id: { in: ids } } });
  const primaryHint = String(values.primaryCase ?? "");
  const primary = cases.find((item) => item.id === primaryHint || item.caseNumber === primaryHint) ?? cases[0];
  const mergedIds = cases.filter((item) => item.id !== primary.id).map((item) => item.id);

  await prisma.caseRecord.update({
    where: { id: primary.id },
    data: {
      subject: primary.subject ? `${primary.subject} (merged)` : "Merged Case",
      description: [primary.description, `Merged cases: ${mergedIds.join(", ")}`].filter(Boolean).join("\n"),
      updatedById: CURRENT_USER.id
    }
  });

  await prisma.caseRecord.updateMany({
    where: { id: { in: mergedIds } },
    data: {
      status: "Closed",
      closedAt: new Date(),
      subject: `Merged into ${primary.caseNumber}`,
      updatedById: CURRENT_USER.id
    }
  });
}
