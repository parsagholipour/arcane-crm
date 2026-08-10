import { APP_NAV, OBJECT_DEFINITIONS } from "@/lib/crm-metadata";
import { recordTitle } from "@/lib/crm-data";
import { type AppKey, type AppNavItem, type ScopedCrmData, type CrmObject, type RecordData } from "@/lib/crm-types";
import { type ScreenDescriptor as ScreenState } from "@/lib/api/contracts";
import { BUILT_IN_GUIDANCE_ITEMS } from "@/lib/guidance";
import { isCrmObject, pathnameWithSearch } from "@/features/routing/lightning-route";
import { isRecordData } from "@/features/crm/data-model";
import { type ConsoleTab } from "@/features/crm/shared-types";
import { notificationCategories } from "@/features/crm/utilities-model";

export function screenToTab(
  screen: ScreenState,
  pathname: string,
  searchParams: { get(name: string): string | null; toString(): string },
  record?: RecordData | null
): ConsoleTab {
  const href = pathnameWithSearch(pathname, searchParams);
  if (screen.kind === "record") {
    const title = (record ? recordTitle(screen.object, record) : "").trim() || OBJECT_DEFINITIONS[screen.object].label;
    return { href, label: `${title} | ${screen.object}` };
  }
  if (screen.kind === "list")
    return {
      href,
      label: `${resolveRequestedListView(screen.object, searchParams.get("filterName")) || OBJECT_DEFINITIONS[screen.object].defaultList} | ${OBJECT_DEFINITIONS[screen.object].plural}`
    };
  if (screen.kind === "calendar") return { href, label: "Calendar" };
  if (screen.kind === "quickText") return { href, label: "Quick Text" };
  if (screen.kind === "marketing") return { href, label: "Marketing" };
  if (screen.kind === "commerce") return { href, label: "Commerce" };
  if (screen.kind === "account") return { href, label: "Your Account" };
  if (screen.kind === "analytics") return { href, label: "Analytics" };
  return { href, label: "Home" };
}
export function resolveRequestedListView(object: CrmObject, requested: string | null, customViews: RecordData[] = []) {
  if (!requested) return "";
  const definition = OBJECT_DEFINITIONS[object];
  const normalized = requested
    .replace(/^__/, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
  if (normalized === "recent") {
    return (
      [definition.defaultList, ...definition.listViews].find((view) => view.includes("Recently Viewed")) ??
      definition.defaultList
    );
  }
  const standardView =
    [definition.defaultList, ...definition.listViews].find(
      (view) => view.replace(/[^a-z0-9]/gi, "").toLowerCase() === normalized
    ) ?? "";
  if (standardView) return standardView;
  const customView = customViews.find(
    (view) =>
      String(view.object) === object &&
      String(view.viewName)
        .replace(/[^a-z0-9]/gi, "")
        .toLowerCase() === normalized
  );
  return customView ? String(customView.viewName) : "";
}
export function navItemsForApp(app: AppKey, data: ScopedCrmData): AppNavItem[] {
  const preference = data.appNavPreferences.find((item) => item.app === app);
  const items = Array.isArray(preference?.items)
    ? preference.items.map(toNavItem).filter((item): item is AppNavItem => Boolean(item))
    : [];
  return items.length > 0 ? items : APP_NAV[app];
}
export function toNavItem(value: unknown): AppNavItem | null {
  if (!isRecordData(value) || !value.label || !value.href) return null;
  const object = typeof value.object === "string" && isCrmObject(value.object) ? value.object : undefined;
  return {
    label: String(value.label),
    href: String(value.href),
    ...(object ? { object } : {})
  };
}
export function cleanNavItem(item: AppNavItem): RecordData {
  return {
    label: item.label,
    href: item.href,
    ...(item.object ? { object: item.object } : {})
  };
}
export function buildNotificationPreferences(preferences: RecordData[] = []) {
  return notificationCategories.reduce<Record<string, boolean>>((accumulator, category) => {
    const preference = preferences.find((item) => String(item.category) === category);
    accumulator[category] = preference?.enabled !== false;
    return accumulator;
  }, {});
}
export function fallbackGuidanceItems(): RecordData[] {
  return BUILT_IN_GUIDANCE_ITEMS.map((item) => ({ ...item }));
}
export function buildGuidanceItems(data: ScopedCrmData): RecordData[] {
  const stateByItem = new Map(data.guidanceStates.map((state) => [String(state.itemId), state]));
  const items = data.guidanceItems.length > 0 ? data.guidanceItems : fallbackGuidanceItems();
  return items.map((item) => {
    const state = stateByItem.get(String(item.id));
    return {
      ...item,
      state: String(state?.status ?? "ACTIVE"),
      snoozedUntil: state?.snoozedUntil ? String(state.snoozedUntil) : null
    };
  });
}
export function guidanceItemForObject(object: CrmObject, data: ScopedCrmData) {
  const fallbackIdByObject: Partial<Record<CrmObject, string>> = {
    Lead: "lead",
    Opportunity: "deal"
  };
  const items = buildGuidanceItems(data);
  return (
    items.find((item) => String(item.target ?? "") === object) ??
    items.find((item) => String(item.id) === fallbackIdByObject[object])
  );
}
export function guidanceSnoozedUntil(item: RecordData) {
  const timestamp = item.snoozedUntil ? new Date(String(item.snoozedUntil)).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}
export function isContextualGuidanceVisible(item: RecordData) {
  const state = String(item.state ?? "ACTIVE");
  if (state === "DISMISSED" || state === "DONE") return false;
  if (state === "SNOOZED") return guidanceSnoozedUntil(item) <= Date.now();
  return true;
}
export function guidanceStateLabel(item: RecordData) {
  const state = String(item.state ?? "ACTIVE");
  if (state === "SNOOZED" && guidanceSnoozedUntil(item) <= Date.now()) return "Active";
  return state.toLowerCase().replace(/^./, (value) => value.toUpperCase());
}
export function guidanceStateBadgeClass(state: string) {
  switch (state) {
    case "DONE":
      return "bg-[#e4f6e6] text-[#194f25]";
    case "SNOOZED":
      return "bg-[#fff7d6] text-[#5f4b00]";
    case "DISMISSED":
      return "bg-[#f3f3f3] text-[#706e6b]";
    default:
      return "bg-brand-50 text-brand-700";
  }
}
