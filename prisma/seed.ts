import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const now = new Date("2026-07-08T08:00:00.000Z");

  const user = await prisma.user.upsert({
    where: { id: "usr-parsa" },
    update: {
      name: "Parsa Gholipourjamnani",
      alias: "PGhol"
    },
    create: {
      id: "usr-parsa",
      name: "Parsa Gholipourjamnani",
      alias: "PGhol"
    }
  });

  const account = await prisma.account.upsert({
    where: { id: "acc-robert" },
    update: {
      name: "Robert",
      type: "Customer",
      ownerId: user.id,
      createdById: user.id,
      updatedById: user.id
    },
    create: {
      id: "acc-robert",
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
      name: "Personal Quick Text",
      ownerId: user.id,
      sharing: "Private"
    },
    create: {
      id: "qtf-personal",
      name: "Personal Quick Text",
      ownerId: user.id,
      sharing: "Private"
    }
  });

  await prisma.userPreference.upsert({
    where: { userId: user.id },
    update: {
      displayDensity: "Comfy",
      guidanceEnabled: true,
      consoleTabsEnabled: true,
      timezone: "Asia/Dubai",
      locale: "en-US"
    },
    create: {
      userId: user.id,
      displayDensity: "Comfy",
      guidanceEnabled: true,
      consoleTabsEnabled: true,
      timezone: "Asia/Dubai",
      locale: "en-US"
    }
  });

  await prisma.notification.upsert({
    where: { id: "not-trial-start" },
    update: {
      title: "1 new notifications",
      body: "Your Starter trial has 30 days left. Use code STARTER70 to save 70%.",
      href: "/lightning/app/your-account",
      category: "Trial",
      read: false,
      userId: user.id
    },
    create: {
      id: "not-trial-start",
      title: "1 new notifications",
      body: "Your Starter trial has 30 days left. Use code STARTER70 to save 70%.",
      href: "/lightning/app/your-account",
      category: "Trial",
      read: false,
      userId: user.id
    }
  });

  const guidance = [
    {
      id: "lead",
      title: "Add a lead",
      body: "Create a lead, qualify it, then convert it into sales records.",
      href: "/lightning/o/Lead/list?filterName=AllOpenLeads",
      target: "Lead"
    },
    {
      id: "marketing",
      title: "Turn on marketing features",
      body: "Activate marketing, then send your first list email.",
      href: "/lightning/app/marketing",
      target: "Marketing"
    },
    {
      id: "deal",
      title: "Create your first deal",
      body: "Create an opportunity and update the stage as work progresses.",
      href: "/lightning/o/Opportunity/list",
      target: "Opportunity"
    }
  ];

  for (const item of guidance) {
    await prisma.guidanceItem.upsert({
      where: { id: item.id },
      update: item,
      create: item
    });
    await prisma.userGuidanceState.upsert({
      where: { userId_itemId: { userId: user.id, itemId: item.id } },
      update: { status: "ACTIVE", snoozedUntil: null },
      create: { userId: user.id, itemId: item.id, status: "ACTIVE" }
    });
  }

  await prisma.agentforceMessage.upsert({
    where: { id: "agent-welcome" },
    update: {
      role: "assistant",
      text: "I can summarize CRM records, draft follow-up email copy, or suggest next actions from the current workspace.",
      userId: user.id
    },
    create: {
      id: "agent-welcome",
      role: "assistant",
      text: "I can summarize CRM records, draft follow-up email copy, or suggest next actions from the current workspace.",
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
