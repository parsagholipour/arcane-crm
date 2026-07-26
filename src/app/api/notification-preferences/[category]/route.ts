import { NextRequest } from "next/server";
import { executeResourceMutation } from "@/server/resources/request-adapter";

type Params = Promise<{ category: string }>;

export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest, context: { params: Params }) {
  const { category } = await context.params;
  const values = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  return executeResourceMutation(request, "updateNotificationPreference", {
    values: { ...values, category: decodeURIComponent(category) }
  });
}
