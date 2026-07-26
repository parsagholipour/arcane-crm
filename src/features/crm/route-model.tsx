import { type CrmObject } from "@/lib/crm-types";
import { defaultRouteForObject } from "@/features/crm/record-model";
import { normalizeSearchText } from "@/features/crm/text-model";

export function listSearchHref(object: CrmObject, query: string) {
  const route = defaultRouteForObject(object);
  const separator = route.includes("?") ? "&" : "?";
  return `${route}${separator}search=${encodeURIComponent(query)}`;
}
export function listViewHref(object: CrmObject, viewName: string) {
  const route = defaultRouteForObject(object);
  const separator = route.includes("?") ? "&" : "?";
  return `${route}${separator}filterName=${encodeURIComponent(viewName.replace(/\s+/g, ""))}`;
}
export function reportHref(title: string) {
  return `/lightning/page/analytics?report=${encodeURIComponent(title)}`;
}
export function reportIdFromTitle(title: string) {
  return normalizeSearchText(title).replace(/\s+/g, "-") || "report";
}
