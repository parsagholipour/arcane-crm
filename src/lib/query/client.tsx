"use client";

import { HydrationBoundary, QueryClientProvider, type DehydratedState } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { createCrmQueryClient } from "@/lib/query/core";

export function CrmQueryProvider({
  children,
  dehydratedState
}: {
  children: ReactNode;
  dehydratedState?: DehydratedState;
}) {
  const [client] = useState(createCrmQueryClient);
  return (
    <QueryClientProvider client={client}>
      <HydrationBoundary state={dehydratedState}>{children}</HydrationBoundary>
    </QueryClientProvider>
  );
}
