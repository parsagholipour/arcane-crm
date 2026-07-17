import "server-only";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const ACTIVE_ORGANIZATION_COOKIE = "crm_active_organization";

export class AppAuthorizationError extends Error {
  constructor(message: string, readonly status: 401 | 403 | 404 = 403) {
    super(message);
    this.name = "AppAuthorizationError";
  }
}

export async function requireAuthenticatedUser() {
  const session = await auth();
  if (!session?.user?.id || session.forceSignOut) throw new AppAuthorizationError("Authentication required.", 401);
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.status !== "ACTIVE") throw new AppAuthorizationError("Authentication required.", 401);
  return user;
}

export async function requireOrganizationContext() {
  const user = await requireAuthenticatedUser();
  const memberships = await prisma.organizationMembership.findMany({
    where: { userId: user.id, status: "ACTIVE", organization: { status: "ACTIVE" } },
    include: { organization: true },
    orderBy: [{ lastAccessedAt: "desc" }, { createdAt: "asc" }]
  });
  if (memberships.length === 0) throw new AppAuthorizationError("No active organization membership.", 403);

  const cookieStore = await cookies();
  const requestedId = cookieStore.get(ACTIVE_ORGANIZATION_COOKIE)?.value;
  const membership = memberships.find((row) => row.organizationId === requestedId) ?? memberships[0];
  return {
    user,
    membership,
    organization: membership.organization,
    organizationId: membership.organizationId,
    userId: user.id,
    role: membership.role,
    availableOrganizations: memberships.map((row) => ({
      id: row.organization.id,
      name: row.organization.name,
      slug: row.organization.slug,
      role: row.role
    }))
  };
}

export async function requireOrganizationAdmin() {
  const context = await requireOrganizationContext();
  if (context.role !== "ADMIN") throw new AppAuthorizationError("Organization administrator access required.", 403);
  return context;
}

export function authorizationErrorResponse(error: unknown) {
  if (error instanceof AppAuthorizationError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return null;
}

export async function assertOrganizationUser(organizationId: string, userId: string) {
  const membership = await prisma.organizationMembership.findFirst({
    where: { organizationId, userId, status: "ACTIVE", user: { status: "ACTIVE" } }
  });
  if (!membership) throw new AppAuthorizationError("The selected owner is not an active organization member.", 404);
  return membership;
}

export async function assertOrganizationRecord(
  organizationId: string,
  model: "account" | "contact" | "lead" | "opportunity" | "caseRecord" | "product" | "priceBook",
  id: string
) {
  const delegate = prisma[model] as unknown as { findFirst(args: { where: { id: string; organizationId: string }; select: { id: true } }): Promise<{ id: string } | null> };
  const row = await delegate.findFirst({ where: { id, organizationId }, select: { id: true } });
  if (!row) throw new AppAuthorizationError("Record not found.", 404);
  return row;
}

export async function assertRelatedOrganizationRecord(organizationId: string, objectType: unknown, recordId: unknown) {
  if (!recordId) return;
  const normalized = String(objectType ?? "").toLowerCase();
  const model =
    normalized === "account" || normalized === "accounts" ? "account" :
    normalized === "contact" || normalized === "contacts" ? "contact" :
    normalized === "lead" || normalized === "leads" ? "lead" :
    normalized === "opportunity" || normalized === "opportunities" ? "opportunity" :
    normalized === "case" || normalized === "cases" ? "caseRecord" :
    normalized === "product2" || normalized === "product" || normalized === "products" ? "product" :
    normalized === "pricebook2" || normalized === "price book" || normalized === "price books" ? "priceBook" : null;
  if (model) await assertOrganizationRecord(organizationId, model, String(recordId));
}
