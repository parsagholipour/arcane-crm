import "server-only";

import type { ShellPayload } from "@/lib/api/contracts";
import { emailDeliveryConfigured } from "@/lib/email/service";
import { prisma } from "@/lib/prisma";
import { RECENT_HISTORY_LIMIT } from "@/lib/recent-records";
import { requireOrganizationContext } from "@/lib/organization-context";
import { isSuperAdminEmail } from "@/lib/super-admin-constants";

type OrganizationContext = Awaited<ReturnType<typeof requireOrganizationContext>>;

export async function loadShellData(suppliedContext?: OrganizationContext): Promise<ShellPayload> {
  const context = suppliedContext ?? (await requireOrganizationContext());
  const personalWhere = { organizationId: context.organizationId, userId: context.userId };

  const [
    notifications,
    notificationPreferences,
    guidanceItems,
    guidanceStates,
    userPreferences,
    setupShortcutStates,
    helpArticleStates,
    appNavPreferences,
    listViewPreferences,
    globalSearchRecents,
    agentforceMessages
  ] = await Promise.all([
    prisma.notification.findMany({ where: personalWhere, orderBy: { createdAt: "desc" } }),
    prisma.notificationPreference.findMany({ where: personalWhere }),
    prisma.guidanceItem.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.userGuidanceState.findMany({ where: personalWhere }),
    prisma.userPreference.findMany({ where: personalWhere }),
    prisma.setupShortcutState.findMany({ where: personalWhere, orderBy: { updatedAt: "desc" } }),
    prisma.helpArticleState.findMany({ where: personalWhere, orderBy: { updatedAt: "desc" } }),
    prisma.appNavPreference.findMany({ where: personalWhere }),
    prisma.listViewPreference.findMany({ where: personalWhere }),
    prisma.globalSearchRecent.findMany({
      where: personalWhere,
      orderBy: { updatedAt: "desc" },
      take: RECENT_HISTORY_LIMIT
    }),
    prisma.agentforceMessage
      .findMany({ where: personalWhere, orderBy: { createdAt: "desc" }, take: 30 })
      .then((rows) => rows.reverse())
  ]);

  return JSON.parse(
    JSON.stringify({
      user: context.user,
      organization: {
        id: context.organization.id,
        name: context.organization.name,
        slug: context.organization.slug,
        role: context.role
      },
      organizations: context.availableOrganizations,
      organizationRole: context.role,
      isSuperAdmin: isSuperAdminEmail(context.user.email),
      emailDeliveryConfigured: emailDeliveryConfigured(),
      notifications,
      notificationPreferences,
      guidanceItems,
      guidanceStates,
      userPreferences,
      setupShortcutStates,
      helpArticleStates,
      appNavPreferences,
      listViewPreferences,
      globalSearchRecents,
      agentforceMessages
    })
  ) as ShellPayload;
}
