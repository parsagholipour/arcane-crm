import { authorizationErrorResponse, requireOrganizationContext } from "@/lib/organization-context";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const context = await requireOrganizationContext();
    const sourceType = request.nextUrl.searchParams.get("sourceType")?.trim();
    const sourceId = request.nextUrl.searchParams.get("sourceId")?.trim();
    const deliveries = await prisma.emailDelivery.findMany({
      where: { organizationId: context.organizationId, ...(sourceType ? { sourceType } : {}), ...(sourceId ? { sourceId } : {}) },
      include: { events: { orderBy: { occurredAt: "desc" }, take: 100 } },
      orderBy: { acceptedAt: "desc" },
      take: 500
    });
    return NextResponse.json({ deliveries: JSON.parse(JSON.stringify(deliveries)) });
  } catch (error) {
    return authorizationErrorResponse(error) ?? NextResponse.json({ error: "Unable to load email deliveries." }, { status: 500 });
  }
}
