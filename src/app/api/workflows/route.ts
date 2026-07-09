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

  if (payload.action === "Buy Now") {
    return NextResponse.json({ error: "Purchase, plan, and checkout workflows are out of scope for this CRM clone." }, { status: 400 });
  }

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

  if (action === "Convert Lead") {
    return convertLeads(selectedIds, values);
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

async function convertLeads(ids: string[], values: Record<string, unknown>) {
  if (ids.length === 0) return { accounts: [], contacts: [], opportunities: [], leads: [] };
  return prisma.$transaction(async (tx) => {
    const leads = await tx.lead.findMany({ where: { id: { in: ids } } });
    const accounts = [];
    const contacts = [];
    const opportunities = [];
    const convertedLeads = [];
    const status = String(values.convertedStatus ?? "Qualified");
    const closeDate = values.closeDate ? new Date(String(values.closeDate)) : daysFromNow(30);
    const stage = String(values.stage ?? "Qualify");
    const forecastCategory = String(values.forecastCategory ?? "Pipeline");
    const createOpportunity = values.createOpportunity !== false;
    const singleAccountName = leads.length === 1 ? String(values.accountName ?? "").trim() : "";

    for (const lead of leads) {
      const accountName = singleAccountName || lead.company || [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Converted Lead Account";
      let account = await tx.account.findFirst({ where: { name: accountName } });
      if (!account) {
        account = await tx.account.create({
          data: {
            name: accountName,
            website: lead.website,
            type: "Prospect",
            ownerId: lead.ownerId,
            phone: lead.phone,
            billingCountry: lead.country,
            billingStreet: lead.street,
            billingPostalCode: lead.postalCode,
            billingCity: lead.city,
            billingState: lead.state,
            createdById: CURRENT_USER.id,
            updatedById: CURRENT_USER.id
          }
        });
      }

      const contact = await tx.contact.create({
        data: {
          salutation: lead.salutation,
          firstName: lead.firstName,
          lastName: lead.lastName,
          accountId: account.id,
          title: lead.title,
          description: lead.description,
          ownerId: lead.ownerId,
          phone: lead.phone,
          email: lead.email,
          mailingCountry: lead.country,
          mailingStreet: lead.street,
          mailingPostalCode: lead.postalCode,
          mailingCity: lead.city,
          mailingState: lead.state,
          createdById: CURRENT_USER.id,
          updatedById: CURRENT_USER.id
        }
      });

      const opportunity = createOpportunity
        ? await tx.opportunity.create({
            data: {
              name: leads.length === 1 ? String(values.opportunityName ?? `${accountName} Opportunity`) : `${accountName} Opportunity`,
              accountId: account.id,
              contactId: contact.id,
              closeDate,
              amount: null,
              description: lead.description,
              ownerId: lead.ownerId,
              stage,
              probability: stage === "Qualify" ? 10 : null,
              forecastCategory,
              nextStep: "Follow up after lead conversion",
              createdById: CURRENT_USER.id,
              updatedById: CURRENT_USER.id
            }
          })
        : null;

      const convertedLead = await tx.lead.update({
        where: { id: lead.id },
        data: {
          status,
          updatedById: CURRENT_USER.id
        }
      });

      accounts.push(account);
      contacts.push(contact);
      if (opportunity) opportunities.push(opportunity);
      convertedLeads.push({
        ...convertedLead,
        convertedAccountId: account.id,
        convertedContactId: contact.id,
        convertedOpportunityId: opportunity?.id ?? null
      });
    }

    return { accounts, contacts, opportunities, leads: convertedLeads };
  });
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

function daysFromNow(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
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
