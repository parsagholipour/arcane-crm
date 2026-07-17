"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { revokeAllAppSessions } from "@/lib/app-sessions";
import {
  deleteKeycloakSession,
  listKeycloakSessions,
  sendKeycloakActionsEmail,
  setKeycloakUserEnabled,
  updateKeycloakIdentity
} from "@/lib/keycloak-admin";
import { prisma } from "@/lib/prisma";
import { assertSuperAdmin } from "@/lib/super-admin";
import { normalizeEmail } from "@/lib/super-admin-constants";
import {
  createOrganizationWithAdmin,
  inviteOrganizationMember,
  removeOrganizationMembership,
  updateOrganizationMembership,
  UserManagementError
} from "@/lib/user-management";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function destination(message: string, error = false) {
  revalidatePath("/super-admin");
  redirect(`/super-admin?${error ? "error" : "message"}=${encodeURIComponent(message)}`);
}

function actionError(error: unknown) {
  if (error && typeof error === "object" && "digest" in error && String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")) throw error;
  console.error("[super-admin] action failed", error);
  return error instanceof UserManagementError || error instanceof Error ? error.message : "The operation could not be completed.";
}

export async function createOrganizationAction(formData: FormData) {
  await assertSuperAdmin();
  try {
    const result = await createOrganizationWithAdmin({
      name: value(formData, "name"),
      slug: value(formData, "slug"),
      adminName: value(formData, "adminName"),
      adminEmail: value(formData, "adminEmail")
    });
    destination(result.warning ?? "Organization and initial administrator created.");
  } catch (error) {
    destination(actionError(error), true);
  }
}

export async function updateOrganizationAction(organizationId: string, formData: FormData) {
  await assertSuperAdmin();
  try {
    const name = value(formData, "name");
    const slug = value(formData, "slug").toLowerCase();
    const status = value(formData, "status") === "SUSPENDED" ? "SUSPENDED" : "ACTIVE";
    if (!name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new UserManagementError("A valid name and slug are required.");
    await prisma.organization.update({ where: { id: organizationId }, data: { name, slug, status } });
    destination("Organization updated.");
  } catch (error) {
    destination(actionError(error), true);
  }
}

export async function addOrganizationMemberAction(formData: FormData) {
  await assertSuperAdmin();
  try {
    const result = await inviteOrganizationMember({
      organizationId: value(formData, "organizationId"),
      name: value(formData, "name"),
      email: value(formData, "email"),
      role: value(formData, "role") === "ADMIN" ? "ADMIN" : "MEMBER"
    });
    destination(result.warning ?? (result.keycloakUserCreated ? "User invited." : "Existing Keycloak user added to the organization."));
  } catch (error) {
    destination(actionError(error), true);
  }
}

export async function updateMembershipAction(membershipId: string, formData: FormData) {
  await assertSuperAdmin();
  try {
    await updateOrganizationMembership({
      organizationId: value(formData, "organizationId"),
      membershipId,
      role: value(formData, "role") === "ADMIN" ? "ADMIN" : "MEMBER",
      status: value(formData, "status") === "SUSPENDED" ? "SUSPENDED" : "ACTIVE"
    });
    destination("Membership updated.");
  } catch (error) {
    destination(actionError(error), true);
  }
}

export async function removeMembershipAction(membershipId: string, formData: FormData) {
  await assertSuperAdmin();
  try {
    await removeOrganizationMembership(value(formData, "organizationId"), membershipId);
    destination("Membership removed.");
  } catch (error) {
    destination(actionError(error), true);
  }
}

export async function updateGlobalUserAction(userId: string, formData: FormData) {
  await assertSuperAdmin();
  try {
    const email = normalizeEmail(value(formData, "email"));
    const name = value(formData, "name");
    if (!email || !name) throw new UserManagementError("Name and email are required.");
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.keycloakSub) throw new UserManagementError("This legacy identity is not linked to Keycloak.", 409);
    const duplicate = await prisma.user.findFirst({ where: { email, id: { not: user.id } } });
    if (duplicate) throw new UserManagementError("That email is already assigned to another user.", 409);
    await updateKeycloakIdentity(user.keycloakSub, { email, name });
    await prisma.user.update({ where: { id: user.id }, data: { email, name } });
    destination("Global identity updated.");
  } catch (error) {
    destination(actionError(error), true);
  }
}

export async function setGlobalUserStatusAction(userId: string, formData: FormData) {
  await assertSuperAdmin();
  try {
    const enabled = value(formData, "status") === "ACTIVE";
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.keycloakSub) throw new UserManagementError("This legacy identity is not linked to Keycloak.", 409);
    await setKeycloakUserEnabled(user.keycloakSub, enabled);
    try {
      await prisma.user.update({ where: { id: user.id }, data: { status: enabled ? "ACTIVE" : "SUSPENDED" } });
    } catch (error) {
      await setKeycloakUserEnabled(user.keycloakSub, !enabled).catch(() => undefined);
      throw error;
    }
    if (!enabled) {
      await revokeAllAppSessions(user.id);
      const sessions = await listKeycloakSessions(user.keycloakSub).catch(() => []);
      await Promise.all(sessions.map((session) => deleteKeycloakSession(session.id).catch(() => undefined)));
    }
    destination(enabled ? "User reactivated." : "User suspended and sessions revoked.");
  } catch (error) {
    destination(actionError(error), true);
  }
}

export async function sendUserActionsAction(userId: string, formData: FormData) {
  await assertSuperAdmin();
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.keycloakSub) throw new UserManagementError("This legacy identity is not linked to Keycloak.", 409);
    const setup = value(formData, "kind") === "setup";
    await sendKeycloakActionsEmail(user.keycloakSub, setup ? ["VERIFY_EMAIL", "UPDATE_PASSWORD"] : ["UPDATE_PASSWORD"]);
    destination(setup ? "Setup email sent." : "Password reset email sent.");
  } catch (error) {
    destination(actionError(error), true);
  }
}

export async function revokeUserSessionsAction(userId: string) {
  await assertSuperAdmin();
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UserManagementError("User not found.", 404);
    await revokeAllAppSessions(user.id);
    const sessions = user.keycloakSub ? await listKeycloakSessions(user.keycloakSub).catch(() => []) : [];
    await Promise.all(sessions.map((session) => deleteKeycloakSession(session.id).catch(() => undefined)));
    destination("All user sessions revoked.");
  } catch (error) {
    destination(actionError(error), true);
  }
}
