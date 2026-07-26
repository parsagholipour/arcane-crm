import { authorizationErrorResponse, requireOrganizationContext } from "@/lib/organization-context";
import {
  campaignDates,
  campaignErrorResponse,
  campaignInclude,
  campaignMoney,
  createCampaignNotification,
  hydrateCampaign,
  requireCampaignType,
  validateCampaignReferences
} from "@/lib/campaigns";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const context = await requireOrganizationContext();
    const status = request.nextUrl.searchParams.get("status");
    const campaigns = await prisma.campaign.findMany({
      where: { organizationId: context.organizationId, ...(status ? { status } : {}) },
      include: campaignInclude,
      orderBy: { updatedAt: "desc" }
    });
    const hydrated = await Promise.all(campaigns.map((campaign) => hydrateCampaign(context.organizationId, campaign)));
    return NextResponse.json({ campaigns: JSON.parse(JSON.stringify(hydrated)) });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    return NextResponse.json({ error: "Unable to load campaigns." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireOrganizationContext();
    const payload = await request.json();
    const name = String(payload.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "Campaign name is required." }, { status: 400 });
    if (
      await prisma.campaign.findFirst({ where: { organizationId: context.organizationId, name }, select: { id: true } })
    )
      return NextResponse.json({ error: "A campaign with this name already exists." }, { status: 409 });
    const references = await validateCampaignReferences(context.organizationId, context.userId, payload);
    const dates = campaignDates(payload.startDate, payload.endDate);
    const campaign = await prisma.campaign.create({
      data: {
        organizationId: context.organizationId,
        name,
        status: "Planned",
        type: requireCampaignType(payload.type),
        ...references,
        ...dates,
        budgetedCost: campaignMoney(payload.budgetedCost, "Budgeted cost"),
        actualCost: campaignMoney(payload.actualCost, "Actual cost"),
        expectedRevenue: campaignMoney(payload.expectedRevenue, "Expected revenue"),
        description: String(payload.description ?? "").trim() || null,
        createdById: context.userId
      },
      include: campaignInclude
    });
    const hydrated = await hydrateCampaign(context.organizationId, campaign);
    const notification = await createCampaignNotification(
      context.organizationId,
      context.userId,
      "Campaign created",
      `${name} was created as Planned.`,
      campaign.id
    );
    return NextResponse.json(
      { campaign: JSON.parse(JSON.stringify(hydrated)), notifications: [notification] },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);
    const response = authorizationErrorResponse(error);
    if (response) return response;
    const validation = campaignErrorResponse(error);
    if (validation) return NextResponse.json({ error: validation.error }, { status: validation.status });
    return NextResponse.json({ error: "Unable to create campaign." }, { status: 500 });
  }
}
