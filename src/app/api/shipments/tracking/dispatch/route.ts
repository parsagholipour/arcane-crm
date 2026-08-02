import { configuredShipmentTrackingCronSecret, validBearerSecret } from "@/lib/cron-auth";
import { pollDueShipments } from "@/lib/shipment-tracking";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const secret = configuredShipmentTrackingCronSecret();
  if (!secret) return NextResponse.json({ error: "Shipment tracking scheduling is not configured." }, { status: 503 });
  if (!validBearerSecret(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const summary = await pollDueShipments();
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    console.error("[shipments] scheduled tracking poll failed", error);
    return NextResponse.json({ error: "Unable to refresh shipment tracking." }, { status: 500 });
  }
}
