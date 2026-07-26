"use client";

import type { ScopedCrmData } from "@/lib/crm-types";
import { CrmAppView } from "@/features/crm/app-view";
import { useCrmController } from "@/features/crm/crm-controller";

export function CrmApp({ initialData }: { initialData: ScopedCrmData }) {
  return <CrmAppView controller={useCrmController(initialData)} />;
}
