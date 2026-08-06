import "server-only";

import type { MembershipStatus, Organization, OrganizationMembership, OrganizationRole, User } from "@prisma/client";
import { deleteKeycloakUser, provisionKeycloakUser, sendKeycloakActionsEmail } from "@/lib/keycloak-admin";
import { sendOrganizationInvitation } from "@/lib/organization-invitations";
import { normalizeOrganizationLogoUrl } from "@/lib/organization-branding";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/super-admin-constants";

export class UserManagementError extends Error {
  constructor(
    message: string,
    readonly status = 400
  ) {
    super(message);
    this.name = "UserManagementError";
  }
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function aliasFor(name: string, email: string) {
  return (name.replace(/[^a-z0-9]/gi, "") || email.split("@")[0] || "User").slice(0, 8);
}

function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function deliverMembershipOnboarding(
  input: {
    organization: { id: string; name: string };
    membership: { id: string; role: OrganizationRole };
    user: { id: string; keycloakSub: string | null; email: string | null; name: string };
    initiatedByUserId: string;
    newIdentity: boolean;
  },
  dependencies: {
    sendInvitation?: typeof sendOrganizationInvitation;
    sendSetup?: typeof sendKeycloakActionsEmail;
    markSetupSent?: (userId: string, sentAt: Date) => Promise<void>;
    now?: () => Date;
    warn?: (message: string, reason: unknown) => void;
  } = {}
) {
  const invitationAttempt = (dependencies.sendInvitation ?? sendOrganizationInvitation)({
    organizationId: input.organization.id,
    organizationName: input.organization.name,
    membershipId: input.membership.id,
    recipientName: input.user.name,
    recipientEmail: input.user.email ?? "",
    role: input.membership.role,
    initiatedByUserId: input.initiatedByUserId,
    newIdentity: input.newIdentity
  });
  const setupAttempt =
    input.newIdentity && input.user.keycloakSub
      ? (dependencies.sendSetup ?? sendKeycloakActionsEmail)(
          input.user.keycloakSub,
          ["VERIFY_EMAIL", "UPDATE_PASSWORD"],
          `/organizations/activate?organizationId=${encodeURIComponent(input.organization.id)}`
        ).then(async () => {
          const sentAt = dependencies.now?.() ?? new Date();
          await (
            dependencies.markSetupSent ??
            (async (userId, timestamp) => {
              await prisma.user.update({ where: { id: userId }, data: { setupEmailSentAt: timestamp } });
            })
          )(input.user.id, sentAt);
          return sentAt;
        })
      : Promise.resolve(null);
  const [invitationResult, setupResult] = await Promise.allSettled([invitationAttempt, setupAttempt]);
  const warnings: string[] = [];
  const warn = dependencies.warn ?? console.warn;

  if (invitationResult.status === "rejected") {
    warn("Organization access granted but invitation email failed", invitationResult.reason);
    warnings.push("The organization invitation email could not be sent. An administrator can retry it.");
  }
  if (setupResult.status === "rejected") {
    warn("Keycloak identity created but setup email failed", setupResult.reason);
    warnings.push("The account setup email could not be sent. A super administrator can retry it.");
  }

  return {
    invitationEmailSent: invitationResult.status === "fulfilled",
    setupEmailSent: input.newIdentity && setupResult.status === "fulfilled",
    invitationDelivery: invitationResult.status === "fulfilled" ? invitationResult.value.invitationDelivery : null,
    warning: warnings.length ? warnings.join(" ") : null
  };
}

export async function inviteOrganizationMember(input: {
  organizationId: string;
  email: string;
  name: string;
  role: OrganizationRole;
  initiatedByUserId: string;
}) {
  const email = normalizeEmail(input.email);
  const name = normalizeName(input.name);
  if (!name) throw new UserManagementError("Full name is required.");
  if (!validEmail(email)) throw new UserManagementError("A valid email is required.");
  if (!(["ADMIN", "MEMBER"] as const).includes(input.role)) throw new UserManagementError("Invalid organization role.");

  const organization = await prisma.organization.findUnique({ where: { id: input.organizationId } });
  if (!organization || organization.status !== "ACTIVE")
    throw new UserManagementError("Organization is not active.", 404);

  const provisioned = await provisionKeycloakUser({ email, name });
  let membership: OrganizationMembership & { user: User };
  try {
    membership = await prisma.$transaction(async (tx) => {
      const bySub = await tx.user.findUnique({ where: { keycloakSub: provisioned.id } });
      const byEmail = bySub ? null : await tx.user.findUnique({ where: { email } });
      const existing = bySub ?? byEmail;
      if (existing?.status === "SUSPENDED")
        throw new UserManagementError("This identity is globally suspended. A super admin must reactivate it.", 409);

      const user = existing
        ? await tx.user.update({ where: { id: existing.id }, data: { keycloakSub: provisioned.id, email, name } })
        : await tx.user.create({
            data: { keycloakSub: provisioned.id, email, name, alias: aliasFor(name, email), status: "ACTIVE" }
          });

      const current = await tx.organizationMembership.findUnique({
        where: { organizationId_userId: { organizationId: input.organizationId, userId: user.id } }
      });
      if (current?.status === "ACTIVE")
        throw new UserManagementError("This user already belongs to the organization.", 409);
      return current
        ? tx.organizationMembership.update({
            where: { id: current.id },
            data: { role: input.role, status: "ACTIVE", invitedAt: new Date() },
            include: { user: true }
          })
        : tx.organizationMembership.create({
            data: { organizationId: input.organizationId, userId: user.id, role: input.role },
            include: { user: true }
          });
    });
  } catch (error) {
    if (provisioned.created) await deleteKeycloakUser(provisioned.id).catch(() => undefined);
    throw error;
  }

  const delivery = await deliverMembershipOnboarding({
    organization,
    membership,
    user: membership.user,
    initiatedByUserId: input.initiatedByUserId,
    newIdentity: provisioned.created
  });
  return {
    membership: {
      ...membership,
      inviteSentAt: delivery.invitationEmailSent
        ? (delivery.invitationDelivery?.acceptedAt ?? membership.inviteSentAt)
        : membership.inviteSentAt
    },
    keycloakUserCreated: provisioned.created,
    ...delivery
  };
}

export async function createOrganizationWithAdmin(input: {
  name: string;
  slug: string;
  logoUrl?: string | null;
  adminName: string;
  adminEmail: string;
  initiatedByUserId: string;
}) {
  const name = normalizeName(input.name);
  const logoUrl = normalizeOrganizationLogoUrl(input.logoUrl);
  const slug = (input.slug.trim() || name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const email = normalizeEmail(input.adminEmail);
  const adminName = normalizeName(input.adminName);
  if (!name) throw new UserManagementError("Organization name is required.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    throw new UserManagementError("Slug must contain lowercase letters, numbers, and single hyphens only.");
  if (!adminName) throw new UserManagementError("Initial administrator name is required.");
  if (!validEmail(email)) throw new UserManagementError("A valid administrator email is required.");
  if (await prisma.organization.findUnique({ where: { slug } }))
    throw new UserManagementError("That organization slug is already in use.", 409);

  const provisioned = await provisionKeycloakUser({ email, name: adminName });
  let result: { organization: Organization; user: User; membership: OrganizationMembership };
  try {
    result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({ data: { name, slug, logoUrl } });
      const bySub = await tx.user.findUnique({ where: { keycloakSub: provisioned.id } });
      const byEmail = bySub ? null : await tx.user.findUnique({ where: { email } });
      const existing = bySub ?? byEmail;
      if (existing?.status === "SUSPENDED")
        throw new UserManagementError("The initial administrator is globally suspended.", 409);
      const user = existing
        ? await tx.user.update({
            where: { id: existing.id },
            data: { keycloakSub: provisioned.id, email, name: adminName }
          })
        : await tx.user.create({
            data: { keycloakSub: provisioned.id, email, name: adminName, alias: aliasFor(adminName, email) }
          });
      const membership = await tx.organizationMembership.create({
        data: { organizationId: organization.id, userId: user.id, role: "ADMIN", status: "ACTIVE" }
      });
      return { organization, user, membership };
    });
  } catch (error) {
    if (provisioned.created) await deleteKeycloakUser(provisioned.id).catch(() => undefined);
    throw error;
  }

  const delivery = await deliverMembershipOnboarding({
    organization: result.organization,
    membership: result.membership,
    user: result.user,
    initiatedByUserId: input.initiatedByUserId,
    newIdentity: provisioned.created
  });
  return {
    ...result,
    membership: {
      ...result.membership,
      inviteSentAt: delivery.invitationEmailSent
        ? (delivery.invitationDelivery?.acceptedAt ?? result.membership.inviteSentAt)
        : result.membership.inviteSentAt
    },
    keycloakUserCreated: provisioned.created,
    ...delivery
  };
}

export async function resendOrganizationInvitation(input: {
  organizationId: string;
  membershipId: string;
  initiatedByUserId: string;
}) {
  const membership = await prisma.organizationMembership.findFirst({
    where: {
      id: input.membershipId,
      organizationId: input.organizationId,
      status: "ACTIVE",
      organization: { status: "ACTIVE" },
      user: { status: "ACTIVE" }
    },
    include: { organization: true, user: true }
  });
  if (!membership || !membership.user.email)
    throw new UserManagementError("Active organization membership not found.", 404);

  try {
    const delivery = await sendOrganizationInvitation({
      organizationId: membership.organizationId,
      organizationName: membership.organization.name,
      membershipId: membership.id,
      recipientName: membership.user.name,
      recipientEmail: membership.user.email,
      role: membership.role,
      initiatedByUserId: input.initiatedByUserId,
      newIdentity: Boolean(membership.user.setupEmailSentAt)
    });
    return {
      membership: { ...membership, inviteSentAt: delivery.result.acceptedAt },
      invitationEmailSent: true,
      invitationDelivery: delivery.invitationDelivery,
      warning: null
    };
  } catch (error) {
    console.warn("Organization invitation resend failed", error);
    throw new UserManagementError(
      "The organization invitation email could not be sent. Check email configuration and try again.",
      503
    );
  }
}

async function activeAdminCount(organizationId: string) {
  return prisma.organizationMembership.count({
    where: { organizationId, role: "ADMIN", status: "ACTIVE", user: { status: "ACTIVE" } }
  });
}

export async function updateOrganizationMembership(input: {
  organizationId: string;
  membershipId: string;
  role?: OrganizationRole;
  status?: MembershipStatus;
}) {
  const membership = await prisma.organizationMembership.findFirst({
    where: { id: input.membershipId, organizationId: input.organizationId }
  });
  if (!membership) throw new UserManagementError("Membership not found.", 404);
  const removesAdmin =
    membership.role === "ADMIN" &&
    membership.status === "ACTIVE" &&
    (input.role === "MEMBER" || input.status === "SUSPENDED");
  if (removesAdmin && (await activeAdminCount(input.organizationId)) <= 1)
    throw new UserManagementError("An organization must retain at least one active administrator.", 409);
  return prisma.organizationMembership.update({
    where: { id: membership.id },
    data: { role: input.role, status: input.status },
    include: { user: true }
  });
}

export async function removeOrganizationMembership(organizationId: string, membershipId: string) {
  const membership = await prisma.organizationMembership.findFirst({ where: { id: membershipId, organizationId } });
  if (!membership) throw new UserManagementError("Membership not found.", 404);
  if (membership.role === "ADMIN" && membership.status === "ACTIVE" && (await activeAdminCount(organizationId)) <= 1) {
    throw new UserManagementError("An organization must retain at least one active administrator.", 409);
  }
  await prisma.organizationMembership.delete({ where: { id: membership.id } });
}
