import { configuredLeadWebhookCronSecret, validBearerSecret } from "@/lib/cron-auth";
import { dispatchDueLeadWebhooks } from "@/lib/public-api/webhook-delivery";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const secret = configuredLeadWebhookCronSecret();
  if (!secret) return NextResponse.json({ error: "Lead webhook scheduling is not configured." }, { status: 503 });
  if (!validBearerSecret(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const summary = await dispatchDueLeadWebhooks();
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    console.error("[lead-webhook] scheduled dispatch failed", error);
    return NextResponse.json({ error: "Unable to dispatch lead webhooks." }, { status: 500 });
  }
}
