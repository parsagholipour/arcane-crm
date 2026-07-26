import "server-only";

import { AppAuthorizationError, assertOrganizationUser } from "@/lib/organization-context";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const CAMPAIGN_STATUSES = ["Planned", "In Progress", "Completed", "Archived"] as const;
export const CAMPAIGN_TYPES = ["Email", "Event", "Webinar", "Advertising", "Direct Mail", "Referral", "Other"] as const;
export const CAMPAIGN_MEMBER_STATUSES = [
  "Sent",
  "Responded",
  "Registered",
  "Attended",
  "Converted",
  "Opted Out"
] as const;

export const campaignInclude = {
  parentCampaign: { select: { id: true, name: true } },
  childCampaigns: { select: { id: true, name: true, status: true } },
  members: { orderBy: { updatedAt: "desc" } }
} satisfies Prisma.CampaignInclude;

export class CampaignValidationError extends Error {
  constructor(
    message: string,
    readonly status = 400
  ) {
    super(message);
    this.name = "CampaignValidationError";
  }
}

export function campaignErrorResponse(error: unknown) {
  if (!(error instanceof CampaignValidationError)) return null;
  return { error: error.message, status: error.status };
}

export function requireCampaignType(value: unknown) {
  const type = String(value ?? "Email");
  if (!(CAMPAIGN_TYPES as readonly string[]).includes(type))
    throw new CampaignValidationError("Choose a valid campaign type.");
  return type;
}

export function campaignDates(startValue: unknown, endValue: unknown) {
  const startDate = startValue ? new Date(String(startValue)) : null;
  const endDate = endValue ? new Date(String(endValue)) : null;
  if (startDate && !Number.isFinite(startDate.getTime()))
    throw new CampaignValidationError("Choose a valid campaign start date.");
  if (endDate && !Number.isFinite(endDate.getTime()))
    throw new CampaignValidationError("Choose a valid campaign end date.");
  if (startDate && endDate && endDate < startDate)
    throw new CampaignValidationError("Campaign end date cannot precede its start date.");
  return { startDate, endDate };
}

export function campaignMoney(value: unknown, label: string) {
  if (value === null || value === undefined || value === "") return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) throw new CampaignValidationError(`${label} cannot be negative.`);
  return amount.toFixed(2);
}

export async function validateCampaignReferences(
  organizationId: string,
  userId: string,
  values: Record<string, unknown>,
  currentId?: string
) {
  const ownerId = String(values.ownerId ?? userId);
  await assertOrganizationUser(organizationId, ownerId);
  const parentCampaignId = String(values.parentCampaignId ?? "").trim() || null;
  if (parentCampaignId) {
    if (parentCampaignId === currentId) throw new CampaignValidationError("A campaign cannot be its own parent.");
    const parent = await prisma.campaign.findFirst({
      where: { id: parentCampaignId, organizationId },
      select: { id: true, parentCampaignId: true }
    });
    if (!parent) throw new AppAuthorizationError("Parent campaign not found.", 404);
    if (parent.parentCampaignId === currentId)
      throw new CampaignValidationError("Campaign hierarchy cannot contain a cycle.");
  }
  return { ownerId, parentCampaignId };
}

export async function requireCampaign(organizationId: string, id: string) {
  const campaign = await prisma.campaign.findFirst({ where: { id, organizationId }, include: campaignInclude });
  if (!campaign) throw new AppAuthorizationError("Campaign not found.", 404);
  return campaign;
}

export async function hydrateCampaign<
  T extends { members: Array<{ objectType: string; recordId: string; status: string; responded: boolean }> }
>(organizationId: string, campaign: T) {
  const leadIds = campaign.members.filter((member) => member.objectType === "Lead").map((member) => member.recordId);
  const contactIds = campaign.members
    .filter((member) => member.objectType === "Contact")
    .map((member) => member.recordId);
  const [leads, contacts] = await Promise.all([
    prisma.lead.findMany({
      where: { organizationId, id: { in: leadIds } },
      select: { id: true, firstName: true, lastName: true, company: true, email: true }
    }),
    prisma.contact.findMany({
      where: { organizationId, id: { in: contactIds } },
      select: { id: true, firstName: true, lastName: true, email: true, account: { select: { name: true } } }
    })
  ]);
  const records = new Map<string, Record<string, unknown>>();
  leads.forEach((lead) =>
    records.set(`Lead:${lead.id}`, {
      name: [lead.firstName, lead.lastName].filter(Boolean).join(" "),
      email: lead.email,
      context: lead.company
    })
  );
  contacts.forEach((contact) =>
    records.set(`Contact:${contact.id}`, {
      name: [contact.firstName, contact.lastName].filter(Boolean).join(" "),
      email: contact.email,
      context: contact.account.name
    })
  );
  const members = campaign.members.map((member) => ({
    ...member,
    ...(records.get(`${member.objectType}:${member.recordId}`) ?? {
      name: "Deleted record",
      email: null,
      context: null
    })
  }));
  const respondedCount = members.filter((member) => member.responded).length;
  return {
    ...campaign,
    members,
    metrics: {
      memberCount: members.length,
      respondedCount,
      responseRate: members.length ? Math.round((respondedCount / members.length) * 1000) / 10 : 0,
      convertedCount: members.filter((member) => member.status === "Converted").length
    }
  };
}

export async function createCampaignNotification(
  organizationId: string,
  userId: string,
  title: string,
  body: string,
  id: string
) {
  return prisma.notification.create({
    data: { organizationId, userId, title, body, href: `/lightning/r/Campaign/${id}/view`, category: "Marketing" }
  });
}
