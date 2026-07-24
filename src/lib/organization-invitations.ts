import "server-only";

import type { OrganizationRole } from "@prisma/client";
import { organizationInvitationTemplate } from "@/lib/email/templates";
import { sendTrackedEmail, type TrackedEmailResult } from "@/lib/email/tracking";
import { prisma } from "@/lib/prisma";
import { resolvePublicAppUrl } from "@/lib/public-app-url";

export const ORGANIZATION_INVITATION_SOURCE = "OrganizationInvitation";

type InvitationSender = typeof sendTrackedEmail;

export type OrganizationInvitationDelivery = {
  status: "Accepted";
  acceptedAt: Date;
  provider: string;
  providerMessageId: string | null;
  lastReason: null;
};

export async function sendOrganizationInvitation(input: {
  organizationId: string;
  organizationName: string;
  membershipId: string;
  recipientName: string;
  recipientEmail: string;
  role: OrganizationRole;
  initiatedByUserId: string;
  newIdentity: boolean;
}, dependencies: {
  send?: InvitationSender;
  markSent?: (membershipId: string, sentAt: Date) => Promise<void>;
  appUrl?: string;
} = {}) {
  const appUrl = resolvePublicAppUrl(dependencies.appUrl);
  const activationUrl = `${appUrl}/organizations/activate?organizationId=${encodeURIComponent(input.organizationId)}`;
  const message = organizationInvitationTemplate({
    recipientName: input.recipientName,
    organizationName: input.organizationName,
    role: input.role,
    activationUrl,
    newIdentity: input.newIdentity
  });
  const result: TrackedEmailResult = await (dependencies.send ?? sendTrackedEmail)({
    fromName: input.organizationName,
    to: [{ email: input.recipientEmail, name: input.recipientName }],
    subject: message.subject,
    text: message.text,
    html: message.html
  }, {
    organizationId: input.organizationId,
    userId: input.initiatedByUserId,
    sourceType: ORGANIZATION_INVITATION_SOURCE,
    sourceId: input.membershipId
  });
  await (dependencies.markSent ?? (async (membershipId, sentAt) => {
    await prisma.organizationMembership.update({ where: { id: membershipId }, data: { inviteSentAt: sentAt } });
  }))(input.membershipId, result.acceptedAt);
  return {
    result,
    invitationDelivery: {
      status: "Accepted",
      acceptedAt: result.acceptedAt,
      provider: result.provider,
      providerMessageId: result.messageId ?? null,
      lastReason: null
    } satisfies OrganizationInvitationDelivery
  };
}
