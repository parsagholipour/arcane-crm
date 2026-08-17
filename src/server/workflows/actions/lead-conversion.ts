import { prisma } from "@/lib/prisma";
import {
  accountNameForLead,
  buildAccountData,
  buildAccountMergeData,
  buildContactData,
  buildContactMergeData,
  buildOpportunityData,
  normalizeConversionValues,
  opportunityNameFor,
  splitCollidingRows
} from "@/lib/lead-conversion";
import { emitLeadConverted } from "@/lib/public-api/emit";
import { syncShipmentTracking } from "@/lib/shipment-tracking-sync";
import { DomainActionValidationError as WorkflowValidationError } from "@/server/workflows/actions/errors";

type PrismaTransaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export async function convertLeads(
  ids: string[],
  values: Record<string, unknown>,
  organizationId: string,
  userId: string
) {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return { accounts: [], contacts: [], opportunities: [], leads: [] };
  const options = normalizeConversionValues(values, uniqueIds.length);

  const result = await prisma.$transaction(
    async (tx) => {
      // Claim the leads with a guarded update rather than a read-then-write, so two
      // concurrent conversions cannot both pass the already-converted check.
      const convertedAt = new Date();
      const claimed = await tx.lead.updateMany({
        where: { organizationId, id: { in: uniqueIds }, convertedAt: null },
        data: { convertedAt, updatedById: userId }
      });
      if (claimed.count !== uniqueIds.length) {
        throw new WorkflowValidationError("A converted Lead cannot be converted again.", 409);
      }

      const leads = await tx.lead.findMany({ where: { organizationId, id: { in: uniqueIds } } });
      const accounts = [];
      const contacts = [];
      const opportunities = [];
      const convertedLeads = [];

      for (const lead of leads) {
        const accountName = accountNameForLead(lead, options.accountName);
        // Only reuse an Account when the user explicitly selected one. Auto-matching
        // by name silently dropped Create New overrides (type, address, segment, …).
        let account = options.existingAccountId
          ? await tx.account.findFirst({ where: { organizationId, id: options.existingAccountId } })
          : null;
        if (options.existingAccountId && !account)
          throw new WorkflowValidationError("The selected Account was not found.", 409);
        if (account) {
          account = await tx.account.update({
            where: { id: account.id },
            data: { ...buildAccountMergeData(account, lead, options.accountOverrides), updatedById: userId }
          });
        } else {
          account = await tx.account.create({
            data: {
              organizationId,
              ...buildAccountData(lead, accountName, options.accountOverrides),
              createdById: userId,
              updatedById: userId
            }
          });
        }

        let contact = options.existingContactId
          ? await tx.contact.findFirst({ where: { organizationId, id: options.existingContactId } })
          : null;
        if (options.existingContactId && !contact)
          throw new WorkflowValidationError("The selected Contact was not found.", 409);
        if (contact) {
          contact = await tx.contact.update({
            where: { id: contact.id },
            data: { ...buildContactMergeData(contact, lead, account.id), updatedById: userId }
          });
        } else {
          contact = await tx.contact.create({
            data: {
              organizationId,
              ...buildContactData(lead, account.id, options.contactOverrides),
              createdById: userId,
              updatedById: userId
            }
          });
        }

        let opportunity = null;
        if (options.createOpportunity) {
          if (options.existingOpportunityId) {
            opportunity = await tx.opportunity.findFirst({
              where: { organizationId, id: options.existingOpportunityId }
            });
            if (!opportunity) throw new WorkflowValidationError("The selected Opportunity was not found.", 409);
            opportunity = await tx.opportunity.update({
              where: { id: opportunity.id },
              data: { accountId: account.id, contactId: contact.id, updatedById: userId }
            });
          } else {
            opportunity = await tx.opportunity.create({
              data: {
                organizationId,
                ...buildOpportunityData(lead, account.id, contact.id, {
                  name: opportunityNameFor(accountName, options.opportunityName),
                  closeDate: options.closeDate,
                  stage: options.stage,
                  forecastCategory: options.forecastCategory,
                  amount: options.amount,
                  description: options.description,
                  ownerId: options.ownerId,
                  probability: options.probability,
                  nextStep: options.nextStep,
                  leadSource: options.leadSource,
                  courier: options.courier,
                  trackingNumber: options.trackingNumber
                }),
                createdById: userId,
                updatedById: userId
              }
            });
          }
          await syncShipmentTracking(tx, {
            organizationId,
            subjectType: "Opportunity",
            subjectId: opportunity.id,
            carrier: opportunity.courier,
            trackingNumber: opportunity.trackingNumber
          });
        }

        // The lead becomes read-only below, so its history has to follow the contact.
        await reparentLeadHistory(tx, organizationId, lead.id, contact.id);

        const convertedLead = await tx.lead.update({
          where: { id: lead.id },
          data: {
            status: options.convertedStatus,
            convertedAt,
            convertedAccountId: account.id,
            convertedContactId: contact.id,
            convertedOpportunityId: opportunity?.id ?? null,
            updatedById: userId
          }
        });

        accounts.push(account);
        contacts.push(contact);
        if (opportunity) opportunities.push(opportunity);
        convertedLeads.push(convertedLead);
      }

      return { accounts, contacts, opportunities, leads: convertedLeads };
    },
    { timeout: 30_000, maxWait: 10_000 }
  );
  for (const lead of result.leads) await emitLeadConverted(organizationId, lead.id);
  return result;
}

/**
 * Move a converted lead's activity, files, campaign memberships and labels onto the
 * contact it became. `relatedObjectType` is stored singular when written from a
 * record page and plural when chosen in the activity dialogs, so both spellings are
 * migrated to the matching contact form.
 */
async function reparentLeadHistory(tx: PrismaTransaction, organizationId: string, leadId: string, contactId: string) {
  for (const [from, to] of [
    ["Lead", "Contact"],
    ["Leads", "Contacts"]
  ] as const) {
    const related = { organizationId, relatedObjectType: from, relatedRecordId: leadId };
    const data = { relatedObjectType: to, relatedRecordId: contactId };
    await Promise.all([
      tx.task.updateMany({ where: related, data }),
      tx.emailActivity.updateMany({ where: related, data }),
      tx.callActivity.updateMany({ where: related, data }),
      tx.event.updateMany({ where: related, data }),
      tx.fileRecord.updateMany({ where: related, data }),
      tx.attachmentRecord.updateMany({ where: related, data }),
      tx.event.updateMany({
        where: { organizationId, nameObjectType: from, nameRecordId: leadId },
        data: { nameObjectType: to, nameRecordId: contactId }
      })
    ]);
  }

  await moveCampaignMembers(tx, organizationId, leadId, contactId);
  await moveRecordLabels(tx, organizationId, leadId, contactId);
}

// Both of the tables below carry a unique constraint that a bare updateMany would
// violate when the contact already holds the same campaign or label, so colliding
// rows are dropped instead of moved.
async function moveCampaignMembers(tx: PrismaTransaction, organizationId: string, leadId: string, contactId: string) {
  const leadMembers = await tx.campaignMember.findMany({
    where: { organizationId, objectType: { in: ["Lead", "Leads"] }, recordId: leadId },
    select: { id: true, campaignId: true }
  });
  if (leadMembers.length === 0) return;

  const contactMembers = await tx.campaignMember.findMany({
    where: { organizationId, objectType: { in: ["Contact", "Contacts"] }, recordId: contactId },
    select: { campaignId: true }
  });
  const { moveIds, dropIds } = splitCollidingRows(
    leadMembers,
    (member) => member.campaignId,
    contactMembers.map((member) => member.campaignId)
  );

  if (dropIds.length) await tx.campaignMember.deleteMany({ where: { id: { in: dropIds } } });
  if (moveIds.length) {
    await tx.campaignMember.updateMany({
      where: { id: { in: moveIds } },
      data: { objectType: "Contact", recordId: contactId }
    });
  }
}

async function moveRecordLabels(tx: PrismaTransaction, organizationId: string, leadId: string, contactId: string) {
  const leadLabels = await tx.recordLabel.findMany({
    where: { organizationId, objectType: { in: ["Lead", "Leads"] }, recordId: leadId },
    select: { id: true, label: true }
  });
  if (leadLabels.length === 0) return;

  const contactLabels = await tx.recordLabel.findMany({
    where: { organizationId, objectType: { in: ["Contact", "Contacts"] }, recordId: contactId },
    select: { label: true }
  });
  const { moveIds, dropIds } = splitCollidingRows(
    leadLabels,
    (row) => row.label,
    contactLabels.map((row) => row.label)
  );

  if (dropIds.length) await tx.recordLabel.deleteMany({ where: { id: { in: dropIds } } });
  if (moveIds.length) {
    await tx.recordLabel.updateMany({
      where: { id: { in: moveIds } },
      data: { objectType: "Contact", recordId: contactId }
    });
  }
}
