import { AppAuthorizationError, authorizationErrorResponse, requireOrganizationContext } from "@/lib/organization-context";
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
  try {
    const context = await requireOrganizationContext();
    const payload = (await request.json()) as WorkflowPayload;
    const values = payload.values ?? {};
    const selectedIds = payload.selectedIds ?? [];
    if (payload.action === "Buy Now") return NextResponse.json({ error: "Purchase, plan, and checkout workflows are out of scope for this CRM clone." }, { status: 400 });
    const result = await runWorkflow(payload.action, payload.object, selectedIds, values, context.organizationId, context.userId, context.user.name);
    return NextResponse.json({ ok: true, ...JSON.parse(JSON.stringify(result)) });
  } catch (error) {
    console.error(error);
    const response = authorizationErrorResponse(error);
    if (response) return response;
    return NextResponse.json({ error: "Unable to complete workflow." }, { status: 500 });
  }
}

async function runWorkflow(action: string, object: string, selectedIds: string[], values: Record<string, unknown>, organizationId: string, userId: string, userName: string) {
  await assertSelectedRecords(object, selectedIds, organizationId);
  if (action === "Assign Label") {
    const label = String(values.label ?? "Important");
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
    const campaignName = String(values.campaign ?? "Starter Outreach");
    const status = String(values.status ?? "Sent");
    const campaign = await prisma.campaign.upsert({
      where: { organizationId_name: { organizationId, name: campaignName } },
      update: { status: "In Progress", ownerId: userId },
      create: { organizationId, name: campaignName, status: "In Progress", ownerId: userId }
    });
    const campaignMembers = await Promise.all(
      selectedIds.map((recordId) =>
        prisma.campaignMember.upsert({
          where: { organizationId_campaignId_objectType_recordId: { organizationId, campaignId: campaign.id, objectType: object, recordId } },
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
    const folder = await prisma.quickTextFolder.create({
      data: {
        organizationId,
        name: String(values.name ?? "Personal Quick Text"),
        ownerId: userId,
        sharing: String(values.sharing ?? "Private")
      }
    });
    return { folder };
  }

  if (action === "Create Store") {
    const store = await prisma.marketingStore.create({
      data: {
        organizationId,
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
        organizationId,
        senderName: String(values.senderName ?? userName),
        senderEmail: String(values.senderEmail ?? "crm@example.com"),
        tracking: values.tracking !== false,
        active: true,
        activatedById: userId
      }
    });
    return { activation };
  }

  if (action === "Publish") {
    await prisma.knowledgeArticle.updateMany({
      where: { organizationId, ...(selectedIds.length ? { id: { in: selectedIds } } : {}) },
      data: { publicationStatus: "Published", publishedAt: new Date(), validationStatus: "Validated" }
    });
    return {};
  }

  if (action === "Assign") {
    const assignee = await resolveOwner(organizationId, String(values.assigneeId ?? values.assignee ?? userId));
    await prisma.knowledgeArticle.updateMany({
      where: { organizationId, ...(selectedIds.length ? { id: { in: selectedIds } } : {}) },
      data: { updatedById: assignee.id }
    });
    return {};
  }

  if (action === "Archive") {
    await prisma.knowledgeArticle.updateMany({
      where: { organizationId, ...(selectedIds.length ? { id: { in: selectedIds } } : {}) },
      data: { publicationStatus: "Archived", archivedAt: new Date(), archivedById: userId }
    });
    return {};
  }

  if (action === "Delete Article") {
    await prisma.knowledgeArticle.deleteMany({
      where: { organizationId, ...(selectedIds.length ? { id: { in: selectedIds } } : {}) }
    });
    return {};
  }

  if (action === "Delete Draft") {
    await prisma.knowledgeArticle.deleteMany({
      where: {
        organizationId,
        ...(selectedIds.length ? { id: { in: selectedIds } } : {}),
        publicationStatus: "Draft"
      }
    });
    return {};
  }

  if (action === "Restore") {
    await prisma.knowledgeArticle.updateMany({
      where: { organizationId, ...(selectedIds.length ? { id: { in: selectedIds } } : { publicationStatus: "Archived" }) },
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
    await mergeCases(selectedIds, values, organizationId, userId);
    return {};
  }

  return {};
}

async function assertSelectedRecords(object: string, ids: string[], organizationId: string) {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return;
  const count =
    object === "Account" ? await prisma.account.count({ where: { organizationId, id: { in: uniqueIds } } }) :
    object === "Contact" ? await prisma.contact.count({ where: { organizationId, id: { in: uniqueIds } } }) :
    object === "Lead" ? await prisma.lead.count({ where: { organizationId, id: { in: uniqueIds } } }) :
    object === "Opportunity" ? await prisma.opportunity.count({ where: { organizationId, id: { in: uniqueIds } } }) :
    object === "Case" ? await prisma.caseRecord.count({ where: { organizationId, id: { in: uniqueIds } } }) :
    object === "Product2" ? await prisma.product.count({ where: { organizationId, id: { in: uniqueIds } } }) :
    object === "Pricebook2" ? await prisma.priceBook.count({ where: { organizationId, id: { in: uniqueIds } } }) :
    object === "Event" ? await prisma.event.count({ where: { organizationId, id: { in: uniqueIds } } }) :
    object === "QuickText" ? await prisma.quickText.count({ where: { organizationId, id: { in: uniqueIds } } }) :
    object === "Knowledge__kav" ? await prisma.knowledgeArticle.count({ where: { organizationId, id: { in: uniqueIds } } }) :
    object === "ListEmail" ? await prisma.listEmail.count({ where: { organizationId, id: { in: uniqueIds } } }) : uniqueIds.length;
  if (count !== uniqueIds.length) throw new AppAuthorizationError("One or more selected records were not found.", 404);
}

async function convertLeads(ids: string[], values: Record<string, unknown>, organizationId: string, userId: string) {
  if (ids.length === 0) return { accounts: [], contacts: [], opportunities: [], leads: [] };
  return prisma.$transaction(async (tx) => {
    const leads = await tx.lead.findMany({ where: { organizationId, id: { in: ids } } });
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
      let account = await tx.account.findFirst({ where: { organizationId, name: accountName } });
      if (!account) {
        account = await tx.account.create({
          data: {
            organizationId,
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
            createdById: userId,
            updatedById: userId
          }
        });
      }

      const contact = await tx.contact.create({
        data: {
          organizationId,
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
          createdById: userId,
          updatedById: userId
        }
      });

      const opportunity = createOpportunity
        ? await tx.opportunity.create({
            data: {
              organizationId,
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
              createdById: userId,
              updatedById: userId
            }
          })
        : null;

      const convertedLead = await tx.lead.update({
        where: { id: lead.id },
        data: {
          status,
          updatedById: userId
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

async function resolveOwner(organizationId: string, value: string) {
  const membership = await prisma.organizationMembership.findFirst({
    where: {
      organizationId,
      status: "ACTIVE",
      user: { status: "ACTIVE", OR: [{ id: value }, { name: { equals: value, mode: "insensitive" } }, { alias: { equals: value, mode: "insensitive" } }] }
    },
    include: { user: true }
  });
  if (!membership) throw new AppAuthorizationError("The selected owner is not an active organization member.", 404);
  return membership.user;
}

async function changeOwner(object: string, ids: string[], ownerId: string, organizationId: string, userId: string) {
  if (ids.length === 0) return [];
  switch (object) {
    case "Account": {
      await prisma.account.updateMany({ where: { organizationId, id: { in: ids } }, data: { ownerId, updatedById: userId } });
      return prisma.account.findMany({ where: { organizationId, id: { in: ids } } });
    }
    case "Contact": {
      await prisma.contact.updateMany({ where: { organizationId, id: { in: ids } }, data: { ownerId, updatedById: userId } });
      return prisma.contact.findMany({ where: { organizationId, id: { in: ids } }, include: { account: true } });
    }
    case "Lead": {
      await prisma.lead.updateMany({ where: { organizationId, id: { in: ids } }, data: { ownerId, updatedById: userId } });
      return prisma.lead.findMany({ where: { organizationId, id: { in: ids } } });
    }
    case "Opportunity": {
      await prisma.opportunity.updateMany({ where: { organizationId, id: { in: ids } }, data: { ownerId, updatedById: userId } });
      return prisma.opportunity.findMany({ where: { organizationId, id: { in: ids } }, include: { account: true, contact: true } });
    }
    case "Case": {
      await prisma.caseRecord.updateMany({ where: { organizationId, id: { in: ids } }, data: { ownerId, updatedById: userId } });
      return prisma.caseRecord.findMany({ where: { organizationId, id: { in: ids } }, include: { account: true, contact: true } });
    }
    case "Knowledge__kav": {
      await prisma.knowledgeArticle.updateMany({ where: { organizationId, id: { in: ids } }, data: { updatedById: ownerId } });
      return prisma.knowledgeArticle.findMany({ where: { organizationId, id: { in: ids } } });
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

async function mergeCases(ids: string[], values: Record<string, unknown>, organizationId: string, userId: string) {
  if (ids.length < 2) return;
  const cases = await prisma.caseRecord.findMany({ where: { organizationId, id: { in: ids } } });
  const primaryHint = String(values.primaryCase ?? "");
  const primary = cases.find((item) => item.id === primaryHint || item.caseNumber === primaryHint) ?? cases[0];
  const mergedIds = cases.filter((item) => item.id !== primary.id).map((item) => item.id);

  await prisma.caseRecord.update({
    where: { id: primary.id },
    data: {
      subject: primary.subject ? `${primary.subject} (merged)` : "Merged Case",
      description: [primary.description, `Merged cases: ${mergedIds.join(", ")}`].filter(Boolean).join("\n"),
      updatedById: userId
    }
  });

  await prisma.caseRecord.updateMany({
    where: { organizationId, id: { in: mergedIds } },
    data: {
      status: "Closed",
      closedAt: new Date(),
      subject: `Merged into ${primary.caseNumber}`,
      updatedById: userId
    }
  });
}
