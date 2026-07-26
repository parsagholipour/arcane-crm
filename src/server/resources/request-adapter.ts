import "server-only";

import { NextRequest } from "next/server";
import { standardizeApiResponse } from "@/lib/api/response";
import { executeResourceMutationRequest } from "@/server/resources/mutation-service";

export async function executeResourceMutation(
  request: NextRequest,
  action: string,
  options: {
    id?: string;
    values?: Record<string, unknown>;
  } = {}
) {
  const values = options.values ?? ((await request.json().catch(() => ({}))) as Record<string, unknown>);
  const adapted = new NextRequest(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify({ action, id: options.id, values })
  });
  return standardizeApiResponse(await executeResourceMutationRequest(adapted));
}
