import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import type { FullConfig } from "@playwright/test";
import { encode } from "next-auth/jwt";

export const e2eIds = {
  user: "playwright-crm-user",
  primaryOrganization: "playwright-crm-primary",
  secondaryOrganization: "playwright-crm-secondary",
  primaryAccount: "playwright-primary-account",
  secondaryAccount: "playwright-secondary-account"
} as const;

export default async function globalSetup(config: FullConfig) {
  const prisma = new PrismaClient();
  const keycloakSub = "playwright-crm-keycloak";
  try {
    await prisma.user.upsert({
      where: { id: e2eIds.user },
      update: {
        keycloakSub,
        email: "playwright-crm@example.com",
        name: "Playwright CRM User",
        alias: "E2E",
        status: "ACTIVE"
      },
      create: {
        id: e2eIds.user,
        keycloakSub,
        email: "playwright-crm@example.com",
        name: "Playwright CRM User",
        alias: "E2E",
        status: "ACTIVE"
      }
    });
    for (const [id, name, slug] of [
      [e2eIds.primaryOrganization, "Playwright Primary", "playwright-crm-primary"],
      [e2eIds.secondaryOrganization, "Playwright Secondary", "playwright-crm-secondary"]
    ] as const) {
      await prisma.organization.upsert({
        where: { id },
        update: { name, slug, status: "ACTIVE" },
        create: { id, name, slug, status: "ACTIVE" }
      });
      await prisma.organizationMembership.upsert({
        where: { organizationId_userId: { organizationId: id, userId: e2eIds.user } },
        update: { role: "ADMIN", status: "ACTIVE" },
        create: { organizationId: id, userId: e2eIds.user, role: "ADMIN", status: "ACTIVE" }
      });
    }
    await prisma.account.upsert({
      where: { id: e2eIds.primaryAccount },
      update: { name: "Primary Tenant Account" },
      create: {
        id: e2eIds.primaryAccount,
        organizationId: e2eIds.primaryOrganization,
        name: "Primary Tenant Account",
        ownerId: e2eIds.user,
        createdById: e2eIds.user,
        updatedById: e2eIds.user
      }
    });
    await prisma.account.upsert({
      where: { id: e2eIds.secondaryAccount },
      update: { name: "Secondary Tenant Account" },
      create: {
        id: e2eIds.secondaryAccount,
        organizationId: e2eIds.secondaryOrganization,
        name: "Secondary Tenant Account",
        ownerId: e2eIds.user,
        createdById: e2eIds.user,
        updatedById: e2eIds.user
      }
    });

    const authSecret = process.env.AUTH_SECRET ?? "playwright-local-auth-secret";
    const token = await encode({
      secret: authSecret,
      salt: "authjs.session-token",
      token: {
        sub: keycloakSub,
        appUserId: e2eIds.user,
        userStatus: "ACTIVE",
        appSessionId: randomUUID(),
        email: "playwright-crm@example.com",
        name: "Playwright CRM User"
      }
    });
    const configuredBaseUrl = String(config.projects[0]?.use?.baseURL ?? "http://127.0.0.1:3001");
    const url = new URL(configuredBaseUrl);
    await mkdir(".playwright", { recursive: true });
    await writeFile(
      ".playwright/auth.json",
      JSON.stringify({
        cookies: [
          {
            name: "authjs.session-token",
            value: token,
            domain: url.hostname,
            path: "/",
            expires: -1,
            httpOnly: true,
            secure: url.protocol === "https:",
            sameSite: "Lax"
          },
          {
            name: "crm_active_organization",
            value: e2eIds.primaryOrganization,
            domain: url.hostname,
            path: "/",
            expires: -1,
            httpOnly: true,
            secure: url.protocol === "https:",
            sameSite: "Lax"
          }
        ],
        origins: []
      })
    );
  } finally {
    await prisma.$disconnect();
  }
}
