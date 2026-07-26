import { NextRequest } from "next/server";
import { executeDomainAction } from "@/server/workflows/request-adapter";

type Params = Promise<{ action: string }>;

const actionNames: Record<string, string> = {
  publish: "Publish",
  assign: "Assign",
  archive: "Archive",
  delete: "Delete Article",
  "delete-draft": "Delete Draft",
  restore: "Restore"
};

export async function POST(request: NextRequest, context: { params: Params }) {
  const { action } = await context.params;
  const actionName = actionNames[action];
  if (!actionName) return Response.json({ error: "Unknown Knowledge action." }, { status: 404 });
  return executeDomainAction(request, actionName);
}
