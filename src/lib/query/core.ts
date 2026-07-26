import { QueryClient } from "@tanstack/react-query";
import type { CrmObject } from "@/lib/crm-types";

export function createCrmQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime: 30_000,
        refetchOnWindowFocus: false
      },
      mutations: {
        retry: false
      }
    }
  });
}

export const crmQueryKeys = {
  all: (organizationId: string) => ["crm", organizationId] as const,
  shell: (organizationId: string) => [...crmQueryKeys.all(organizationId), "shell"] as const,
  list: (organizationId: string, object: CrmObject, query: unknown) =>
    [...crmQueryKeys.all(organizationId), "records", object, "list", query] as const,
  record: (organizationId: string, object: CrmObject, id: string) =>
    [...crmQueryKeys.all(organizationId), "records", object, "detail", id] as const,
  feature: (organizationId: string, feature: string, query?: unknown) =>
    [...crmQueryKeys.all(organizationId), "feature", feature, query ?? null] as const
};
