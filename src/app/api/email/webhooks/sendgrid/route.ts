import { ingestSendGridEvents, verifySendGridWebhook } from "@/lib/email/tracking";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const publicKey = process.env.SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY?.trim();
  const signature = request.headers.get("x-twilio-email-event-webhook-signature") ?? "";
  const timestamp = request.headers.get("x-twilio-email-event-webhook-timestamp") ?? "";
  const rawBody = await request.text();
  if (publicKey && (!signature || !timestamp || !verifySendGridWebhook(rawBody, signature, timestamp, publicKey))) {
    return NextResponse.json({ error: "Invalid SendGrid event webhook signature." }, { status: 401 });
  }
  let payload: unknown;
  try { payload = JSON.parse(rawBody); } catch { return NextResponse.json({ error: "Webhook payload must be valid JSON." }, { status: 400 }); }
  if (!Array.isArray(payload)) return NextResponse.json({ error: "Webhook payload must be an event array." }, { status: 400 });
  const result = await ingestSendGridEvents(payload);
  return NextResponse.json({ ok: true, ...result });
}
