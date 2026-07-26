import "server-only";

import { NextRequest } from "next/server";
import { standardizeApiResponse } from "@/lib/api/response";
import { executeDomainActionRequest } from "@/server/workflows/domain-action-service";

export async function executeDomainAction(request: NextRequest, action: string) {
  const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const adapted = new NextRequest(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify({ ...payload, action })
  });
  return standardizeApiResponse(await executeDomainActionRequest(adapted));
}
