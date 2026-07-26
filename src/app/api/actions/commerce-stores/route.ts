import { NextRequest } from "next/server";
import { executeDomainAction } from "@/server/workflows/request-adapter";

export async function POST(request: NextRequest) {
  return executeDomainAction(request, "Create Store");
}
