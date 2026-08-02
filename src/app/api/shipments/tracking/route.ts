import { authorizationErrorResponse, requireOrganizationContext } from "@/lib/organization-context";
import { prisma } from "@/lib/prisma";
import { SHIPPING_CATEGORY } from "@/lib/shipment-tracking-recipients";
import { pollDueShipments } from "@/lib/shipment-tracking";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Foreground twin of the scheduled dispatch route. Lets the open CRM keep shipments fresh
 * without an external scheduler, scoped to the caller's organization.
 */
export async function POST() {
  try {
    const context = await requireOrganizationContext();
    const summary = await pollDueShipments({ organizationId: context.organizationId, limit: 25 });
    const notifications = await prisma.notification.findMany({
      where: {
        organizationId: context.organizationId,
        userId: context.userId,
        category: SHIPPING_CATEGORY,
        read: false
      },
      orderBy: { createdAt: "desc" },
      take: 25
    });
    return NextResponse.json({ ok: true, summary, notifications: JSON.parse(JSON.stringify(notifications)) });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    console.error("[shipments] tracking sweep failed", error);
    return NextResponse.json({ error: "Unable to check shipment tracking." }, { status: 500 });
  }
}
