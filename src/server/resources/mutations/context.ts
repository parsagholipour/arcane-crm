import type { NextResponse } from "next/server";

export type ResourceMutationPayload = {
  action: string;
  id?: string;
  values?: Record<string, unknown>;
};

export type ResourceMutationContext = {
  payload: ResourceMutationPayload;
  values: Record<string, unknown>;
  organizationId: string;
  userId: string;
  personalWhere: { organizationId: string; userId: string };
};

export type ResourceMutationHandler = (context: ResourceMutationContext) => Promise<NextResponse | null>;
