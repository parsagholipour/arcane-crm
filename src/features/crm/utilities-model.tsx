import { type RecordData } from "@/lib/crm-types";
import { isRecordData } from "@/features/crm/data-model";
import { type AgentforceMessageMetadata, type HelpArticle, type SetupShortcut } from "@/features/crm/shared-types";
import { normalizeSearchText } from "@/features/crm/text-model";

export const notificationCategories = [
  "Records",
  "Workflow",
  "Marketing",
  "Activity",
  "Files",
  "Email",
  "Calendar"
] as const;
export const displayDensityOptions = ["Comfy", "Compact"];
export const timezoneOptions = ["Asia/Dubai", "UTC", "America/New_York", "America/Los_Angeles", "Europe/London"];
export const localeOptions = ["en-US", "en-GB", "ar-AE", "fr-FR", "de-DE"];
export const helpArticleCatalog: HelpArticle[] = [
  {
    id: "help-create-records",
    title: "Create records and list views",
    summary: "Create, edit, import, pin, and personalize customer record lists.",
    category: "Records",
    href: "/lightning/o/Lead/list?filterName=AllOpenLeads",
    tags: ["records", "leads", "list views", "import"]
  },
  {
    id: "help-customize-navigation",
    title: "Customize navigation items",
    summary: "Reorder app tabs, remove unused destinations, and restore the default app navigation.",
    category: "Navigation",
    href: "/lightning/page/home",
    tags: ["navigation", "tabs", "apps"]
  },
  {
    id: "help-list-email",
    title: "Use list email layouts",
    summary: "Create list email drafts, choose layouts, schedule or send messages, and track notifications.",
    category: "Email",
    href: "/lightning/o/ListEmail/list",
    tags: ["email", "marketing", "layouts", "send"]
  },
  {
    id: "help-track-cases",
    title: "Track support with cases",
    summary: "Use case list views, merge cases, change owners, close work, and notify contacts.",
    category: "Service",
    href: "/lightning/o/Case/list?filterName=AllOpenCases",
    tags: ["cases", "support", "merge", "notifications"]
  },
  {
    id: "help-reports-dashboards",
    title: "Build reports and dashboards",
    summary: "Open live Analytics reports, build grouped previews, and assemble dashboard components.",
    category: "Analytics",
    href: "/lightning/page/analytics?report=Pipeline%20by%20Stage",
    tags: ["reports", "dashboards", "analytics", "charts"]
  },
  {
    id: "help-guidance-settings",
    title: "Manage guidance and quick settings",
    summary: "Snooze guidance, adjust density, toggle console tabs, and save locale preferences.",
    category: "Settings",
    href: "/lightning/page/home",
    tags: ["settings", "guidance", "density", "locale"]
  }
];
export const setupShortcutCatalog: SetupShortcut[] = [
  {
    id: "setup-home",
    title: "Setup Home",
    summary: "Return to the CRM home dashboard and onboarding setup cards.",
    category: "Setup",
    href: "/lightning/page/home",
    tags: ["setup", "home", "dashboard"]
  },
  {
    id: "setup-object-manager-leads",
    title: "Object Manager: Leads",
    summary: "Open lead list configuration, fields, filters, and prospecting setup.",
    category: "Object Manager",
    href: "/lightning/o/Lead/list?filterName=AllOpenLeads",
    tags: ["object", "lead", "fields", "list"]
  },
  {
    id: "setup-object-manager-cases",
    title: "Object Manager: Cases",
    summary: "Open case configuration for support lists, owners, priorities, and merge workflows.",
    category: "Object Manager",
    href: "/lightning/o/Case/list?filterName=AllOpenCases",
    tags: ["object", "case", "support", "priority"]
  },
  {
    id: "setup-analytics",
    title: "Reports & Dashboards",
    summary: "Open Analytics to inspect computed reports and dashboard builder output.",
    category: "Analytics",
    href: "/lightning/page/analytics?report=Pipeline%20by%20Stage",
    tags: ["reports", "dashboard", "analytics"]
  },
  {
    id: "setup-calendar",
    title: "Calendar Settings",
    summary: "Open the calendar workspace to review visible calendars and scheduling preferences.",
    category: "Productivity",
    href: "/lightning/o/Event/home",
    tags: ["calendar", "events", "schedule"]
  },
  {
    id: "setup-email",
    title: "List Email Setup",
    summary: "Open list email tools for layouts, recipients, drafts, schedules, and delivery status.",
    category: "Email",
    href: "/lightning/o/ListEmail/list",
    tags: ["email", "marketing", "list email"]
  },
  {
    id: "setup-guidance",
    title: "Guidance Center",
    summary: "Manage onboarding cards, snoozed guidance, and dismissed recommendations.",
    category: "Guidance",
    href: "/lightning/page/home",
    tags: ["guidance", "onboarding", "help"]
  },
  {
    id: "setup-profile",
    title: "User Profile",
    summary: "Edit profile identity, avatar, locale, timezone, and console preferences.",
    category: "User",
    href: "/lightning/app/your-account",
    tags: ["profile", "user", "locale", "timezone"]
  },
  {
    id: "setup-organization-users",
    title: "Organization Users",
    summary: "Invite users and manage roles and access for the active organization.",
    category: "User",
    href: "/lightning/setup/users",
    tags: ["users", "members", "roles", "organization", "admin"]
  }
];
export function buildHelpArticleStateMap(states: RecordData[] = []) {
  return states.reduce<Record<string, RecordData>>((accumulator, state) => {
    const articleId = String(state.articleId ?? "");
    if (articleId) accumulator[articleId] = state;
    return accumulator;
  }, {});
}
export function helpArticleMatchesQuery(article: HelpArticle, query: string) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;
  const haystack = normalizeSearchText([article.title, article.summary, article.category, ...article.tags].join(" "));
  return normalizedQuery
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token));
}
export function buildSetupShortcutStateMap(states: RecordData[] = []) {
  return states.reduce<Record<string, RecordData>>((accumulator, state) => {
    const shortcutId = String(state.shortcutId ?? "");
    if (shortcutId) accumulator[shortcutId] = state;
    return accumulator;
  }, {});
}
export function setupShortcutMatchesQuery(shortcut: SetupShortcut, query: string) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;
  const haystack = normalizeSearchText(
    [shortcut.title, shortcut.summary, shortcut.category, ...shortcut.tags].join(" ")
  );
  return normalizedQuery
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token));
}
export function agentforceMetadata(message: RecordData): AgentforceMessageMetadata {
  const metadata = message.metadata;
  if (!isRecordData(metadata)) return {};
  const actions = Array.isArray(metadata.actions)
    ? metadata.actions
        .filter(isRecordData)
        .map((action) => ({ label: String(action.label ?? ""), href: String(action.href ?? "") }))
        .filter((action) => action.label && action.href)
    : [];
  const facts = Array.isArray(metadata.facts)
    ? metadata.facts
        .filter(isRecordData)
        .map((fact) => ({ label: String(fact.label ?? ""), value: String(fact.value ?? "") }))
        .filter((fact) => fact.label)
    : [];
  const draft = isRecordData(metadata.draft)
    ? {
        subject: metadata.draft.subject ? String(metadata.draft.subject) : undefined,
        body: metadata.draft.body ? String(metadata.draft.body) : undefined,
        to: metadata.draft.to ? String(metadata.draft.to) : undefined,
        recipientIds: Array.isArray(metadata.draft.recipientIds) ? metadata.draft.recipientIds.map(String) : []
      }
    : undefined;
  return {
    kind: metadata.kind ? String(metadata.kind) : undefined,
    actions,
    facts,
    draft
  };
}
