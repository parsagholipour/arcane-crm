import type { CrmObject } from "@/lib/crm-types";

export function objectRoute(object: CrmObject) {
  return `/lightning/o/${object}/list`;
}
