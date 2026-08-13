import "server-only";

import { prisma } from "@/lib/prisma";
import type { ShipmentSubjectType } from "@/lib/shipment-tracking-sync";

export const SHIPPING_CATEGORY = "Shipping";

export type ShipmentRecipient = {
  userId: string;
  name: string;
  email: string | null;
  organizationName: string;
  /** Human label for the record the shipment hangs off, e.g. an opportunity name. */
  subjectLabel: string;
  href: string;
  notifyInApp: boolean;
};

async function opportunitySubject(organizationId: string, subjectId: string) {
  const opportunity = await prisma.opportunity.findFirst({
    where: { id: subjectId, organizationId },
    select: { id: true, name: true, ownerId: true }
  });
  if (!opportunity) return null;
  return {
    userId: opportunity.ownerId,
    subjectLabel: opportunity.name,
    href: `/lightning/r/Opportunity/${opportunity.id}/view`
  };
}

async function leadSubject(organizationId: string, subjectId: string) {
  const lead = await prisma.lead.findFirst({
    where: { id: subjectId, organizationId },
    select: { id: true, firstName: true, lastName: true, company: true, ownerId: true }
  });
  if (!lead) return null;
  const person = [lead.firstName, lead.lastName].filter(Boolean).join(" ").trim();
  return {
    userId: lead.ownerId,
    subjectLabel: `Sample for ${person || String(lead.company ?? "").trim() || "a Lead"}`,
    href: `/lightning/r/Lead/${lead.id}/view`
  };
}

async function fulfillmentSubject(organizationId: string, subjectId: string) {
  const fulfillment = await prisma.commerceFulfillment.findFirst({
    where: { id: subjectId, organizationId },
    select: { fulfillmentNumber: true, createdById: true, order: { select: { id: true, orderNumber: true } } }
  });
  if (!fulfillment) return null;
  return {
    userId: fulfillment.createdById,
    subjectLabel: `${fulfillment.order.orderNumber} · ${fulfillment.fulfillmentNumber}`,
    href: `/lightning/r/CommerceOrder/${fulfillment.order.id}/view`
  };
}

/**
 * Resolve who hears about a shipment. Mirrors the calendar reminder gating: the user must
 * still be an active member of an active organization, and may have muted the category.
 * Returns null when nobody should be told, which the poller treats as "update silently".
 */
export async function resolveShipmentRecipient(
  organizationId: string,
  subjectType: ShipmentSubjectType,
  subjectId: string
): Promise<ShipmentRecipient | null> {
  const subject =
    subjectType === "Opportunity"
      ? await opportunitySubject(organizationId, subjectId)
      : subjectType === "Lead"
        ? await leadSubject(organizationId, subjectId)
        : await fulfillmentSubject(organizationId, subjectId);
  if (!subject) return null;

  const [membership, organization, preference] = await Promise.all([
    prisma.organizationMembership.findFirst({
      where: { organizationId, userId: subject.userId, status: "ACTIVE", user: { status: "ACTIVE" } },
      include: { user: true }
    }),
    prisma.organization.findFirst({ where: { id: organizationId, status: "ACTIVE" }, select: { name: true } }),
    prisma.notificationPreference.findUnique({
      where: {
        organizationId_userId_category: { organizationId, userId: subject.userId, category: SHIPPING_CATEGORY }
      }
    })
  ]);
  if (!membership || !organization) return null;

  return {
    userId: subject.userId,
    name: membership.user.name,
    email: membership.user.email,
    organizationName: organization.name,
    subjectLabel: subject.subjectLabel,
    href: subject.href,
    notifyInApp: preference?.enabled !== false
  };
}
