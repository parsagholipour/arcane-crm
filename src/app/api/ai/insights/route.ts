import { z } from "zod";
import { DeepSeekError } from "@/lib/ai/deepseek";
import { AiRefreshCooldownError, getActivityInsights, getHomeInsights } from "@/lib/ai/insights";
import { authorizationErrorResponse, requireOrganizationContext } from "@/lib/organization-context";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const requestSchema = z.discriminatedUnion("surface", [
  z.object({ surface: z.literal("home"), force: z.boolean().optional().default(false) }),
  z.object({
    surface: z.literal("activity"),
    object: z.enum(["Account", "Contact"]),
    recordId: z.string().trim().min(1),
    force: z.boolean().optional().default(false)
  })
]);

export async function POST(request: NextRequest) {
  try {
    const context = await requireOrganizationContext();
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid insight request.", code: "invalid_request", retryable: false }, { status: 400 });
    const response = parsed.data.surface === "home"
      ? await getHomeInsights(context.organizationId, context.userId, parsed.data.force)
      : await getActivityInsights({
          organizationId: context.organizationId,
          userId: context.userId,
          object: parsed.data.object,
          recordId: parsed.data.recordId,
          force: parsed.data.force
        });
    return NextResponse.json(response);
  } catch (error) {
    const authResponse = authorizationErrorResponse(error);
    if (authResponse) return authResponse;
    if (error instanceof DeepSeekError || error instanceof AiRefreshCooldownError || isTypedInsightError(error)) {
      return NextResponse.json({ error: error.message, code: error.code, retryable: error.retryable }, { status: error.status });
    }
    console.error("AI insight request failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "AI insights are temporarily unavailable.", code: "internal_error", retryable: true }, { status: 500 });
  }
}

function isTypedInsightError(error: unknown): error is Error & { status: number; code: string; retryable: boolean } {
  return error instanceof Error && typeof (error as { status?: unknown }).status === "number" && typeof (error as { code?: unknown }).code === "string";
}
