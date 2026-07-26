import type { ReadonlyURLSearchParams } from "next/navigation";
import type { AppKey, CrmObject } from "@/lib/crm-types";
import type { RecordScreenObject, ScreenDescriptor } from "@/lib/api/contracts";

export type SearchParamsLike = Pick<ReadonlyURLSearchParams, "get" | "toString">;

const crmObjects: readonly CrmObject[] = [
  "Account",
  "Contact",
  "Lead",
  "Opportunity",
  "Product2",
  "Pricebook2",
  "Event",
  "Case",
  "QuickText",
  "MessagingSession",
  "Knowledge__kav",
  "ListEmail",
  "Campaign",
  "Invoice",
  "VideoCall"
];

export function isCrmObject(value?: string): value is CrmObject {
  return crmObjects.includes(value as CrmObject);
}

export function isRecordScreenObject(value?: string): value is RecordScreenObject {
  return isCrmObject(value) && value !== "Event" && value !== "QuickText";
}

export function inferActiveApp(pathname: string, searchParams: Pick<SearchParamsLike, "get">): AppKey {
  if (
    pathname.includes("/Lead") ||
    pathname.includes("/Opportunity") ||
    pathname.includes("/Product2") ||
    pathname.includes("/Pricebook2") ||
    pathname.includes("/Event") ||
    pathname.includes("/Invoice") ||
    pathname.includes("/VideoCall")
  ) {
    return "sales";
  }
  if (
    pathname.includes("/Case") ||
    pathname.includes("/QuickText") ||
    pathname.includes("/MessagingSession") ||
    pathname.includes("/Knowledge__kav")
  ) {
    return "service";
  }
  if (pathname.includes("/ListEmail") || pathname.includes("/Campaign")) return "marketing";
  if (pathname.includes("/Account")) return "accounts";
  if (pathname.includes("/Contact")) return "contacts";
  if (searchParams.get("app") === "service") return "service";
  return "home";
}

export function parseLightningRoute(pathname: string, searchParams: Pick<SearchParamsLike, "get">): ScreenDescriptor {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[1] === "page" && segments[2] === "analytics") {
    return { kind: "analytics", activeApp: inferActiveApp(pathname, searchParams) };
  }
  if (segments[1] === "app") {
    const app = (segments[2] as AppKey) ?? "home";
    if (app === "contacts") return { kind: "list", activeApp: "contacts", object: "Contact" };
    if (app === "accounts") return { kind: "list", activeApp: "accounts", object: "Account" };
    if (app === "sales") return { kind: "list", activeApp: "sales", object: "Lead" };
    if (app === "service") return { kind: "list", activeApp: "service", object: "Case" };
    if (app === "marketing") return { kind: "marketing", activeApp: "marketing" };
    if (app === "commerce") return { kind: "commerce", activeApp: "commerce" };
    if (app === "your-account") return { kind: "account", activeApp: "your-account" };
  }
  if (segments[1] === "o" && isCrmObject(segments[2])) {
    if (segments[2] === "Event") return { kind: "calendar", activeApp: "sales" };
    if (segments[2] === "QuickText") return { kind: "quickText", activeApp: "service" };
    return {
      kind: "list",
      activeApp: inferActiveApp(pathname, searchParams),
      object: segments[2]
    };
  }
  if (segments[1] === "r" && isRecordScreenObject(segments[2]) && segments[3]) {
    return {
      kind: "record",
      activeApp:
        segments[2] === "Account"
          ? "accounts"
          : segments[2] === "Contact"
            ? "contacts"
            : segments[2] === "MessagingSession" || segments[2] === "Case" || segments[2] === "Knowledge__kav"
              ? "service"
              : segments[2] === "Campaign" || segments[2] === "ListEmail"
                ? "marketing"
                : "sales",
      object: segments[2],
      id: segments[3]
    };
  }
  return { kind: "home", activeApp: "home" };
}

export function pathnameWithSearch(pathname: string, searchParams: Pick<SearchParamsLike, "toString">) {
  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}
