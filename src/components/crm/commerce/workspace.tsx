"use client";

import { useCommerceWorkspace, type CommerceWorkspaceProps } from "@/components/crm/commerce/workspace-controller";
import { CommerceWorkspaceView } from "@/components/crm/commerce/workspace-view";

export function CommerceWorkspace(props: CommerceWorkspaceProps) {
  const model = useCommerceWorkspace(props);
  return <CommerceWorkspaceView model={model} />;
}
