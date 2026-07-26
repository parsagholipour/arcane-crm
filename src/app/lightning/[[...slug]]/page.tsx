import { CrmApp } from "@/components/crm/CrmApp";
import { AppAuthorizationError, requireOrganizationContext } from "@/lib/organization-context";
import { redirect } from "next/navigation";
import { dehydrate } from "@tanstack/react-query";
import { CrmQueryProvider } from "@/lib/query/client";
import { createCrmQueryClient, crmQueryKeys } from "@/lib/query/core";
import { loadShellData } from "@/server/shell/load-shell";
import { loadScopedScreenData } from "@/server/screens/load-screen-data";
import { parseLightningRoute } from "@/features/routing/lightning-route";
import { resolveRequestedListView } from "@/features/crm/shell-model";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function LightningPage({ params, searchParams }: PageProps) {
  try {
    const [{ slug = [] }, rawSearchParams, context] = await Promise.all([
      params,
      searchParams,
      requireOrganizationContext()
    ]);
    const urlSearchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(rawSearchParams)) {
      for (const item of Array.isArray(value) ? value : value ? [value] : []) {
        urlSearchParams.append(key, item);
      }
    }
    const pathname = `/lightning/${slug.join("/") || "page/home"}`;
    const descriptor = parseLightningRoute(pathname, urlSearchParams);
    const shell = await loadShellData(context);
    const screenPayload = await loadScopedScreenData({
      organizationId: context.organizationId,
      userId: context.userId,
      shell,
      descriptor,
      search: first(rawSearchParams.search),
      view:
        descriptor.kind === "list"
          ? resolveRequestedListView(descriptor.object, first(rawSearchParams.filterName), shell.listViewPreferences)
          : ""
    });
    const queryClient = createCrmQueryClient();
    queryClient.setQueryData(crmQueryKeys.shell(shell.organization.id), shell);
    queryClient.setQueryData(
      crmQueryKeys.feature(shell.organization.id, `${descriptor.kind}:${pathname}`, urlSearchParams.toString()),
      screenPayload
    );
    return (
      <CrmQueryProvider dehydratedState={dehydrate(queryClient)}>
        <CrmApp initialData={screenPayload.data} />
      </CrmQueryProvider>
    );
  } catch (error) {
    if (error instanceof AppAuthorizationError)
      redirect(error.status === 401 ? "/auth/keycloak?callbackUrl=/lightning/page/home" : "/no-organization");
    throw error;
  }
}
