import { Prisma } from "@prisma/client";
import { z } from "zod";
import { runAgentforce } from "@/lib/ai/agent";
import { DEEPSEEK_MODEL, DeepSeekError } from "@/lib/ai/deepseek";
import { aiChatAttemptLimiter } from "@/lib/ai/rate-limit";
import { authorizationErrorResponse, requireOrganizationContext } from "@/lib/organization-context";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  message: z.string().trim().min(1, "Message is required.").max(2000, "Messages can contain at most 2,000 characters."),
  pathname: z.string().trim().max(500).default("/lightning/page/home")
});

export async function POST(request: NextRequest) {
  try {
    const context = await requireOrganizationContext();
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid AI request.", code: "invalid_request", retryable: false }, { status: 400 });

    const recentRequestCount = await prisma.agentforceMessage.count({
      where: {
        organizationId: context.organizationId,
        userId: context.userId,
        role: "user",
        createdAt: { gte: new Date(Date.now() - 60_000) }
      }
    });
    if (!aiChatAttemptLimiter.reserve(`${context.organizationId}:${context.userId}`, recentRequestCount)) {
      return NextResponse.json({ error: "Agentforce allows 10 requests per minute. Please wait a moment.", code: "rate_limit", retryable: true }, { status: 429 });
    }

    const history = (await prisma.agentforceMessage.findMany({
      where: { organizationId: context.organizationId, userId: context.userId },
      orderBy: { createdAt: "desc" },
      take: 12
    })).reverse();
    const result = await runAgentforce({
      organizationId: context.organizationId,
      userId: context.userId,
      userName: context.user.name,
      message: parsed.data.message,
      pathname: safePathname(parsed.data.pathname),
      history
    });

    const metadata = {
      ...result.metadata,
      provider: "deepseek",
      usage: result.usage ?? null
    } as Prisma.InputJsonObject;
    const [userMessage, assistantMessage] = await prisma.$transaction([
      prisma.agentforceMessage.create({
        data: { organizationId: context.organizationId, userId: context.userId, role: "user", text: parsed.data.message }
      }),
      prisma.agentforceMessage.create({
        data: { organizationId: context.organizationId, userId: context.userId, role: "assistant", text: result.text, metadata }
      })
    ]);
    await pruneConversation(context.organizationId, context.userId);
    return NextResponse.json({ ok: true, messages: JSON.parse(JSON.stringify([userMessage, assistantMessage])), model: DEEPSEEK_MODEL });
  } catch (error) {
    const authResponse = authorizationErrorResponse(error);
    if (authResponse) return authResponse;
    if (error instanceof DeepSeekError) {
      return NextResponse.json({ error: error.message, code: error.code, retryable: error.retryable }, { status: error.status });
    }
    console.error("Agentforce request failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Agentforce couldn't answer that request.", code: "internal_error", retryable: true }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const context = await requireOrganizationContext();
    await prisma.agentforceMessage.deleteMany({ where: { organizationId: context.organizationId, userId: context.userId } });
    const welcome = await prisma.agentforceMessage.create({
      data: {
        organizationId: context.organizationId,
        userId: context.userId,
        role: "assistant",
        text: "I can analyze CRM records, draft follow-up email copy, suggest next actions, and take you to the right workspace. I will never change data without you.",
        metadata: {
          kind: "summary",
          facts: [],
          actions: [
            { id: "open_home", label: "Open Home", href: "/lightning/page/home" },
            { id: "open_analytics", label: "Open Analytics", href: "/lightning/page/analytics" }
          ]
        }
      }
    });
    return NextResponse.json({ ok: true, messages: JSON.parse(JSON.stringify([welcome])) });
  } catch (error) {
    const authResponse = authorizationErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Unable to clear Agentforce conversation", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Unable to clear the Agentforce conversation." }, { status: 500 });
  }
}

function safePathname(value: string) {
  return value.startsWith("/lightning/") ? value : "/lightning/page/home";
}

async function pruneConversation(organizationId: string, userId: string) {
  const oldMessages = await prisma.agentforceMessage.findMany({
    where: { organizationId, userId },
    select: { id: true },
    orderBy: { createdAt: "desc" },
    skip: 100
  });
  if (oldMessages.length) await prisma.agentforceMessage.deleteMany({ where: { id: { in: oldMessages.map((item) => item.id) }, organizationId, userId } });
}
