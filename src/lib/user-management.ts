import "server-only";

import type { MembershipStatus, OrganizationRole } from "@prisma/client";
import { deleteKeycloakUser, provisionKeycloakUser, sendKeycloakActionsEmail } from "@/lib/keycloak-admin";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/super-admin-constants";

export class UserManagementError extends Error {
  constructor(message: string, readonly status = 400) {
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

export async function inviteOrganizationMember(input: {
  organizationId: string;
  email: string;
  name: string;
  role: OrganizationRole;
}) {
  const email = normalizeEmail(input.email);
  const name = normalizeName(input.name);
  if (!name) throw new UserManagementError("Full name is required.");
  if (!validEmail(email)) throw new UserManagementError("A valid email is required.");
  if (!(["ADMIN", "MEMBER"] as const).includes(input.role)) throw new UserManagementError("Invalid organization role.");

  const organization = await prisma.organization.findUnique({ where: { id: input.organizationId } });
  if (!organization || organization.status !== "ACTIVE") throw new UserManagementError("Organization is not active.", 404);

  const provisioned = await provisionKeycloakUser({ email, name });
  try {
    const membership = await prisma.$transaction(async (tx) => {
      const bySub = await tx.user.findUnique({ where: { keycloakSub: provisioned.id } });
      const byEmail = bySub ? null : await tx.user.findUnique({ where: { email } });
      const existing = bySub ?? byEmail;
      if (existing?.status === "SUSPENDED") throw new UserManagementError("This identity is globally suspended. A super admin must reactivate it.", 409);

      const user = existing
        ? await tx.user.update({ where: { id: existing.id }, data: { keycloakSub: provisioned.id, email, name } })
        : await tx.user.create({ data: { keycloakSub: provisioned.id, email, name, alias: aliasFor(name, email), status: "ACTIVE" } });

      const current = await tx.organizationMembership.findUnique({
        where: { organizationId_userId: { organizationId: input.organizationId, userId: user.id } }
      });
      if (current?.status === "ACTIVE") throw new UserManagementError("This user already belongs to the organization.", 409);
      return current
        ? tx.organizationMembership.update({ where: { id: current.id }, data: { role: input.role, status: "ACTIVE", invitedAt: new Date() }, include: { user: true } })
        : tx.organizationMembership.create({ data: { organizationId: input.organizationId, userId: user.id, role: input.role }, include: { user: true } });
    });

    let warning: string | null = null;
    if (provisioned.created) {
      try {
        await sendKeycloakActionsEmail(provisioned.id, ["VERIFY_EMAIL", "UPDATE_PASSWORD"]);
        await prisma.organizationMembership.update({ where: { id: membership.id }, data: { inviteSentAt: new Date() } });
      } catch (error) {
        console.warn("Keycloak user created but setup email failed", error);
        warning = "The user was created, but Keycloak could not deliver the setup email. A super admin can retry it.";
      }
    }
    return { membership, keycloakUserCreated: provisioned.created, warning };
  } catch (error) {
    if (provisioned.created) await deleteKeycloakUser(provisioned.id).catch(() => undefined);
    throw error;
  }
}

export async function createOrganizationWithAdmin(input: { name: string; slug: string; adminName: string; adminEmail: string }) {
  const name = normalizeName(input.name);
  const slug = input.slug.trim().toLowerCase();
  const email = normalizeEmail(input.adminEmail);
  const adminName = normalizeName(input.adminName);
  if (!name) throw new UserManagementError("Organization name is required.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new UserManagementError("Slug must contain lowercase letters, numbers, and single hyphens only.");
  if (!adminName) throw new UserManagementError("Initial administrator name is required.");
  if (!validEmail(email)) throw new UserManagementError("A valid administrator email is required.");
  if (await prisma.organization.findUnique({ where: { slug } })) throw new UserManagementError("That organization slug is already in use.", 409);

  const provisioned = await provisionKeycloakUser({ email, name: adminName });
  try {
    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({ data: { name, slug } });
      const bySub = await tx.user.findUnique({ where: { keycloakSub: provisioned.id } });
      const byEmail = bySub ? null : await tx.user.findUnique({ where: { email } });
      const existing = bySub ?? byEmail;
      if (existing?.status === "SUSPENDED") throw new UserManagementError("The initial administrator is globally suspended.", 409);
      const user = existing
        ? await tx.user.update({ where: { id: existing.id }, data: { keycloakSub: provisioned.id, email, name: adminName } })
        : await tx.user.create({ data: { keycloakSub: provisioned.id, email, name: adminName, alias: aliasFor(adminName, email) } });
      const membership = await tx.organizationMembership.create({
        data: { organizationId: organization.id, userId: user.id, role: "ADMIN", status: "ACTIVE" }
      });
      return { organization, user, membership };
    });

    let warning: string | null = null;
    if (provisioned.created) {
      try {
        await sendKeycloakActionsEmail(provisioned.id, ["VERIFY_EMAIL", "UPDATE_PASSWORD"]);
        await prisma.organizationMembership.update({ where: { id: result.membership.id }, data: { inviteSentAt: new Date() } });
      } catch (error) {
        console.warn("Organization created but setup email failed", error);
        warning = "Organization created, but Keycloak could not deliver the administrator setup email.";
      }
    }
    return { ...result, warning };
  } catch (error) {
    if (provisioned.created) await deleteKeycloakUser(provisioned.id).catch(() => undefined);
    throw error;
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
  const membership = await prisma.organizationMembership.findFirst({ where: { id: input.membershipId, organizationId: input.organizationId } });
  if (!membership) throw new UserManagementError("Membership not found.", 404);
  const removesAdmin = membership.role === "ADMIN" && membership.status === "ACTIVE" && (input.role === "MEMBER" || input.status === "SUSPENDED");
  if (removesAdmin && (await activeAdminCount(input.organizationId)) <= 1) throw new UserManagementError("An organization must retain at least one active administrator.", 409);
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
