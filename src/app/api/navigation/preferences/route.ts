import { NextRequest } from "next/server";
import { executeResourceMutation } from "@/server/resources/request-adapter";

export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest) {
  return executeResourceMutation(request, "updateAppNavPreference");
}

export async function DELETE(request: NextRequest) {
  return executeResourceMutation(request, "resetAppNavPreference");
}
