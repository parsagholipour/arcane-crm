import { NextRequest } from "next/server";
import { executeResourceMutation } from "@/server/resources/request-adapter";

type Params = Promise<{ id: string }>;

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, context: { params: Params }) {
  const { id } = await context.params;
  return executeResourceMutation(request, "updateCustomDashboard", { id });
}

export async function DELETE(request: NextRequest, context: { params: Params }) {
  const { id } = await context.params;
  return executeResourceMutation(request, "deleteCustomDashboard", { id });
}
