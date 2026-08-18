import { NextRequest } from "next/server";
import { executeResourceMutation } from "@/server/resources/request-adapter";

export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest) {
  const values = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  return executeResourceMutation(
    request,
    typeof values.pin === "boolean" ? "pinListViewPreference" : "saveListViewPreference",
    { values }
  );
}

export async function DELETE(request: NextRequest) {
  return executeResourceMutation(request, "deleteListViewPreference");
}
