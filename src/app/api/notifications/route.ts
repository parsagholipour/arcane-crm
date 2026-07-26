import { NextRequest } from "next/server";
import { executeResourceMutation } from "@/server/resources/request-adapter";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return executeResourceMutation(request, "createNotification");
}

export async function PATCH(request: NextRequest) {
  return executeResourceMutation(request, "markAllNotificationsRead");
}

export async function DELETE(request: NextRequest) {
  return executeResourceMutation(
    request,
    request.nextUrl.searchParams.get("scope") === "read" ? "clearReadNotifications" : "clearAllNotifications"
  );
}
