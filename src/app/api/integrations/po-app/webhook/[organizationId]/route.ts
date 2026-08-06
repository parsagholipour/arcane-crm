import { poAppWebhookSecret } from "@/lib/po-app-integration";
import {
  applyPoAppWebhookEvent,
  claimPoAppDelivery,
  markPoAppDeliveryProcessed,
  parsePoAppWebhookEnvelope,
  verifyPoAppSignature
} from "@/lib/po-app-webhook";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Params = Promise<{ organizationId: string }>;

/**
 * Every rejection is a bare 401 so the endpoint never reveals whether an organization exists or
 * which check failed.
 */
function unauthorized() {
  return NextResponse.json({ error: "Invalid PO App webhook signature." }, { status: 401 });
}

export async function POST(request: NextRequest, { params }: { params: Params }) {
  const { organizationId } = await params;
  // The raw bytes are what was signed. Parsing and re-serialising changes them and the signature
  // would never match.
  const rawBody = await request.text();

  const integration = await prisma.poAppIntegration.findUnique({ where: { organizationId } });
  const secret = poAppWebhookSecret(integration);
  if (!integration || !secret) return unauthorized();
  if (!verifyPoAppSignature(rawBody, request.headers.get("x-po-signature"), secret)) return unauthorized();

  const envelope = parsePoAppWebhookEnvelope(rawBody);
  if (!envelope) return NextResponse.json({ error: "Webhook payload must be valid JSON." }, { status: 400 });
  // A correctly signed event for a different store means the endpoint was registered by the
  // wrong PO App store.
  if (integration.poStoreId && envelope.storeId && envelope.storeId !== integration.poStoreId) return unauthorized();

  const claim = await claimPoAppDelivery(organizationId, envelope);
  if (claim === "duplicate") return NextResponse.json({ ok: true, duplicate: true });

  try {
    const outcome = await applyPoAppWebhookEvent(organizationId, envelope, integration.storeId);
    await markPoAppDeliveryProcessed(envelope.id);
    return NextResponse.json({ ok: true, outcome });
  } catch (error) {
    // processedAt stays null, so PO App's retry of this delivery id runs the handler again.
    console.error("[po-app] webhook handling failed", envelope.id, error);
    return NextResponse.json({ error: "Unable to process the webhook event." }, { status: 500 });
  }
}
