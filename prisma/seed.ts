import { PrismaClient } from "@prisma/client";
import { BUILT_IN_GUIDANCE_ITEMS } from "../src/lib/guidance";

const prisma = new PrismaClient();

async function main() {
  const now = new Date("2026-07-08T08:00:00.000Z");

  const organization = await prisma.organization.upsert({
    where: { id: "org-robert" },
    update: { name: "Robert", slug: "robert", status: "ACTIVE" },
    create: { id: "org-robert", name: "Robert", slug: "robert", status: "ACTIVE" }
  });

  const user = await prisma.user.upsert({
    where: { id: "usr-parsa" },
    update: {
      name: "Parsa Gholipourjamnani",
      alias: "PGhol",
      keycloakSub: null,
      email: null,
      status: "SUSPENDED"
    },
    create: {
      id: "usr-parsa",
      name: "Parsa Gholipourjamnani",
      alias: "PGhol",
      status: "SUSPENDED"
    }
  });

  const account = await prisma.account.upsert({
    where: { id: "acc-robert" },
    update: {
      organizationId: organization.id,
      name: "Robert",
      type: "Customer",
      ownerId: user.id,
      createdById: user.id,
      updatedById: user.id
    },
    create: {
      id: "acc-robert",
      organizationId: organization.id,
      name: "Robert",
      type: "Customer",
      ownerId: user.id,
      createdById: user.id,
      updatedById: user.id,
      createdAt: now,
      updatedAt: now
    }
  });

  await prisma.contact.upsert({
    where: { id: "con-rober-antonio" },
    update: {
      organizationId: organization.id,
      salutation: "Mr.",
      firstName: "Rober",
      lastName: "Antonio",
      accountId: account.id,
      ownerId: user.id,
      createdById: user.id,
      updatedById: user.id
    },
    create: {
      id: "con-rober-antonio",
      organizationId: organization.id,
      salutation: "Mr.",
      firstName: "Rober",
      lastName: "Antonio",
      accountId: account.id,
      ownerId: user.id,
      createdById: user.id,
      updatedById: user.id,
      createdAt: now,
      updatedAt: now
    }
  });

  await prisma.quickTextFolder.upsert({
    where: { id: "qtf-personal" },
    update: {
      organizationId: organization.id,
      name: "Personal Quick Text",
      ownerId: user.id,
      sharing: "Private"
    },
    create: {
      id: "qtf-personal",
      organizationId: organization.id,
      name: "Personal Quick Text",
      ownerId: user.id,
      sharing: "Private"
    }
  });

  await prisma.userPreference.upsert({
    where: { organizationId_userId: { organizationId: organization.id, userId: user.id } },
    update: {
      displayDensity: "Comfy",
      guidanceEnabled: true,
      consoleTabsEnabled: true,
      timezone: "Asia/Dubai",
      locale: "en-US"
    },
    create: {
      organizationId: organization.id,
      userId: user.id,
      displayDensity: "Comfy",
      guidanceEnabled: true,
      consoleTabsEnabled: true,
      timezone: "Asia/Dubai",
      locale: "en-US"
    }
  });

  await prisma.notification.upsert({
    where: { id: "not-welcome" },
    update: {
      organizationId: organization.id,
      title: "Welcome to your workspace",
      body: "Create records, manage activities, and explore CRM tools from the app launcher.",
      href: "/lightning/page/home",
      category: "Records",
      read: false,
      userId: user.id
    },
    create: {
      id: "not-welcome",
      organizationId: organization.id,
      title: "Welcome to your workspace",
      body: "Create records, manage activities, and explore CRM tools from the app launcher.",
      href: "/lightning/page/home",
      category: "Records",
      read: false,
      userId: user.id
    }
  });

  for (const item of BUILT_IN_GUIDANCE_ITEMS) {
    await prisma.guidanceItem.upsert({
      where: { id: item.id },
      update: item,
      create: item
    });
    await prisma.userGuidanceState.upsert({
      where: { organizationId_userId_itemId: { organizationId: organization.id, userId: user.id, itemId: item.id } },
      update: { status: "ACTIVE", snoozedUntil: null },
      create: { organizationId: organization.id, userId: user.id, itemId: item.id, status: "ACTIVE" }
    });
  }

  await prisma.agentforceMessage.upsert({
    where: { id: "agent-welcome" },
    update: {
      organizationId: organization.id,
      role: "assistant",
      text: "I can analyze CRM records, draft follow-up email copy, suggest next actions, and take you to the right workspace. I will never change data without you.",
      metadata: {
        kind: "summary",
        facts: [],
        actions: [{ id: "open_home", label: "Open Home", href: "/lightning/page/home" }]
      },
      userId: user.id
    },
    create: {
      id: "agent-welcome",
      organizationId: organization.id,
      role: "assistant",
      text: "I can analyze CRM records, draft follow-up email copy, suggest next actions, and take you to the right workspace. I will never change data without you.",
      metadata: {
        kind: "summary",
        facts: [],
        actions: [{ id: "open_home", label: "Open Home", href: "/lightning/page/home" }]
      },
      userId: user.id
    }
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
