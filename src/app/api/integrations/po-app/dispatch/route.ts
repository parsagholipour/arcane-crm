import { configuredPoAppSyncCronSecret, validBearerSecret } from "@/lib/cron-auth";
import { runDuePoAppSyncs } from "@/lib/po-app-sync";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const secret = configuredPoAppSyncCronSecret();
  if (!secret) return NextResponse.json({ error: "PO App sync scheduling is not configured." }, { status: 503 });
  if (!validBearerSecret(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const summary = await runDuePoAppSyncs();
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    console.error("[po-app] scheduled catalogue sync failed", error);
    return NextResponse.json({ error: "Unable to sync the PO App catalogue." }, { status: 500 });
  }
}
