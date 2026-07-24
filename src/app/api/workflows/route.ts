import { AppAuthorizationError, authorizationErrorResponse, requireOrganizationContext } from "@/lib/organization-context";
import { prisma } from "@/lib/prisma";
import { commerceErrorResponse, createCommerceStore } from "@/lib/commerce";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type WorkflowPayload = {
  action: string;
  object: string;
  selectedIds?: string[];
  values?: Record<string, unknown>;
};

class WorkflowValidationError extends Error {
  constructor(message: string, readonly status: 400 | 409 = 400) {
    super(message);
    this.name = "WorkflowValidationError";
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireOrganizationContext();
    const payload = (await request.json()) as WorkflowPayload;
    const values = payload.values ?? {};
    const selectedIds = payload.selectedIds ?? [];
    const result = await runWorkflow(payload.action, payload.object, selectedIds, values, context.organizationId, context.userId);
    return NextResponse.json({ ok: true, ...JSON.parse(JSON.stringify(result)) });
  } catch (error) {
    console.error(error);
    const response = authorizationErrorResponse(error);
    if (response) return response;
    const commerce = commerceErrorResponse(error);
    if (commerce) return NextResponse.json({ error: commerce.error, field: commerce.field }, { status: commerce.status });
    if (error instanceof WorkflowValidationError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Unable to complete workflow." }, { status: 500 });
  }
}

async function runWorkflow(action: string, object: string, selectedIds: string[], values: Record<string, unknown>, organizationId: string, userId: string) {
  await assertSelectedRecords(object, selectedIds, organizationId);
  if (["Assign Label", "Add to Campaign", "Change Owner", "Add to Category", "Convert Lead", "Publish", "Assign", "Archive", "Delete Article", "Delete Draft", "Restore", "Merge Cases"].includes(action) && selectedIds.length === 0) {
    throw new WorkflowValidationError("Select at least one record before running this action.");
  }
  if (action === "Assign Label") {
    const label = String(values.label ?? "").trim();
    if (!label) throw new WorkflowValidationError("Label is required.");
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
    if (!["Contact", "Lead"].includes(object)) throw new WorkflowValidationError("Only Contacts and Leads can be added to a campaign.");
    const campaignName = String(values.campaign ?? "").trim();
    if (!campaignName) throw new WorkflowValidationError("Campaign name is required.");
    const status = String(values.status ?? "Sent");
    const campaign = await prisma.campaign.upsert({
      where: { organizationId_name: { organizationId, name: campaignName } },
      update: { status: "In Progress", ownerId: userId },
      create: { organizationId, name: campaignName, status: "In Progress", ownerId: userId, createdById: userId, activatedAt: new Date() }
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
    const name = String(values.name ?? "").trim();
    if (!name) throw new WorkflowValidationError("Folder name is required.");
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
    if (!senderName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail)) throw new WorkflowValidationError("A sender name and valid sender email are required.");
    const activationId = String(values.id ?? "").trim();
    const existing = activationId ? await prisma.marketingActivation.findFirst({ where: { id: activationId, organizationId } }) : null;
    if (activationId && !existing) throw new WorkflowValidationError("Marketing activation not found.", 409);
    const activation = existing
      ? await prisma.marketingActivation.update({ where: { id: existing.id }, data: { senderName, senderEmail, tracking: values.tracking !== false, active: true, activatedById: userId } })
      : await prisma.marketingActivation.create({ data: { organizationId, senderName, senderEmail, tracking: values.tracking !== false, active: true, activatedById: userId } });
    return { activation };
  }

  if (action === "Publish") {
    const articles = await prisma.knowledgeArticle.findMany({ where: { organizationId, id: { in: selectedIds } } });
    if (articles.some((article) => article.publicationStatus !== "Draft")) throw new WorkflowValidationError("Only Draft articles can be published.", 409);
    if (articles.some((article) => !article.title.trim() || !article.urlName.trim() || !article.bodyRichText?.trim())) throw new WorkflowValidationError("Title, URL Name, and article body are required before publishing.");
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
    const invalid = await prisma.knowledgeArticle.count({ where: { organizationId, id: { in: selectedIds }, publicationStatus: { not: "Published" } } });
    if (invalid) throw new WorkflowValidationError("Only Published articles can be archived.", 409);
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
    const invalid = await prisma.knowledgeArticle.count({ where: { organizationId, id: { in: selectedIds }, publicationStatus: { not: "Archived" } } });
    if (invalid) throw new WorkflowValidationError("Only Archived articles can be restored.", 409);
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

  throw new WorkflowValidationError(`Unsupported workflow action: ${action || "(empty)"}.`);
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
    if (leads.some((lead) => lead.convertedAt)) throw new WorkflowValidationError("A converted Lead cannot be converted again.", 409);
    const accounts = [];
    const contacts = [];
    const opportunities = [];
    const convertedLeads = [];
    const status = String(values.convertedStatus ?? "Qualified");
    const closeDate = values.closeDate ? new Date(String(values.closeDate)) : daysFromNow(30);
    const stage = String(values.stage ?? "Qualify");
    const forecastCategory = String(values.forecastCategory ?? "Pipeline");
    const createOpportunity = values.createOpportunity !== false;
    const singleLead = leads.length === 1;
    const singleAccountName = singleLead ? String(values.accountName ?? "").trim() : "";
    const existingAccountId = singleLead ? String(values.existingAccountId ?? "").trim() : "";
    const existingContactId = singleLead ? String(values.existingContactId ?? "").trim() : "";
    const existingOpportunityId = singleLead && createOpportunity ? String(values.existingOpportunityId ?? "").trim() : "";

    for (const lead of leads) {
      const accountName = singleAccountName || lead.company || [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Converted Lead Account";
      let account = existingAccountId
        ? await tx.account.findFirst({ where: { organizationId, id: existingAccountId } })
        : await tx.account.findFirst({ where: { organizationId, name: accountName } });
      if (existingAccountId && !account) throw new WorkflowValidationError("The selected Account was not found.", 409);
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

      let contact = existingContactId
        ? await tx.contact.findFirst({ where: { organizationId, id: existingContactId } })
        : null;
      if (existingContactId && !contact) throw new WorkflowValidationError("The selected Contact was not found.", 409);
      if (contact) {
        contact = await tx.contact.update({
          where: { id: contact.id },
          data: {
            accountId: account.id,
            title: contact.title ?? lead.title,
            phone: contact.phone ?? lead.phone,
            email: contact.email ?? lead.email,
            updatedById: userId
          }
        });
      } else {
        contact = await tx.contact.create({
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
      }

      let opportunity = null;
      if (createOpportunity) {
        if (existingOpportunityId) {
          opportunity = await tx.opportunity.findFirst({ where: { organizationId, id: existingOpportunityId } });
          if (!opportunity) throw new WorkflowValidationError("The selected Opportunity was not found.", 409);
          opportunity = await tx.opportunity.update({
            where: { id: opportunity.id },
            data: {
              accountId: account.id,
              contactId: contact.id,
              updatedById: userId
            }
          });
        } else {
          opportunity = await tx.opportunity.create({
            data: {
              organizationId,
              name: singleLead ? String(values.opportunityName ?? `${accountName} Opportunity`) : `${accountName} Opportunity`,
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
          });
        }
      }

      const convertedLead = await tx.lead.update({
        where: { id: lead.id },
        data: {
          status,
          convertedAt: new Date(),
          convertedAccountId: account.id,
          convertedContactId: contact.id,
          convertedOpportunityId: opportunity?.id ?? null,
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
  if (ids.length < 2) throw new WorkflowValidationError("Select at least two cases to merge.");
  return prisma.$transaction(async (tx) => {
    const cases = await tx.caseRecord.findMany({ where: { organizationId, id: { in: ids } } });
    if (cases.length !== new Set(ids).size) throw new WorkflowValidationError("One or more cases could not be found.", 409);
    const primaryHint = String(values.primaryCase ?? "");
    const primary = cases.find((item) => item.id === primaryHint || item.caseNumber === primaryHint) ?? cases[0];
    const mergedIds = cases.filter((item) => item.id !== primary.id).map((item) => item.id);

    await Promise.all([
      tx.task.updateMany({ where: { organizationId, relatedObjectType: "Case", relatedRecordId: { in: mergedIds } }, data: { relatedRecordId: primary.id } }),
      tx.emailActivity.updateMany({ where: { organizationId, relatedObjectType: "Case", relatedRecordId: { in: mergedIds } }, data: { relatedRecordId: primary.id } }),
      tx.callActivity.updateMany({ where: { organizationId, relatedObjectType: "Case", relatedRecordId: { in: mergedIds } }, data: { relatedRecordId: primary.id } }),
      tx.event.updateMany({ where: { organizationId, relatedObjectType: "Case", relatedRecordId: { in: mergedIds } }, data: { relatedRecordId: primary.id } }),
      tx.event.updateMany({ where: { organizationId, nameObjectType: "Case", nameRecordId: { in: mergedIds } }, data: { nameRecordId: primary.id } }),
      tx.fileRecord.updateMany({ where: { organizationId, relatedObjectType: "Case", relatedRecordId: { in: mergedIds } }, data: { relatedRecordId: primary.id } }),
      tx.attachmentRecord.updateMany({ where: { organizationId, relatedObjectType: "Case", relatedRecordId: { in: mergedIds } }, data: { relatedRecordId: primary.id } })
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
      data: { status: "Closed", closedAt: new Date(), subject: `Merged into ${primary.caseNumber}`, updatedById: userId }
    });
    return { primaryCaseId: primary.id, mergedCaseIds: mergedIds };
  });
}
