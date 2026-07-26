import { authorizationErrorResponse, requireOrganizationContext } from "@/lib/organization-context";
import {
  campaignDates,
  campaignErrorResponse,
  campaignInclude,
  campaignMoney,
  hydrateCampaign,
  requireCampaign,
  requireCampaignType,
  validateCampaignReferences
} from "@/lib/campaigns";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type Params = Promise<{ id: string }>;
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: { params: Params }) {
  try {
    const authContext = await requireOrganizationContext();
    const { id } = await context.params;
    const campaign = await requireCampaign(authContext.organizationId, id);
    return NextResponse.json({
      campaign: JSON.parse(JSON.stringify(await hydrateCampaign(authContext.organizationId, campaign)))
    });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    return NextResponse.json({ error: "Unable to load campaign." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: { params: Params }) {
  try {
    const authContext = await requireOrganizationContext();
    const { id } = await context.params;
    const existing = await requireCampaign(authContext.organizationId, id);
    if (existing.status === "Archived")
      return NextResponse.json({ error: "Archived campaigns cannot be edited." }, { status: 409 });
    const payload = await request.json();
    if (payload.status !== undefined)
      return NextResponse.json({ error: "Use a lifecycle action to change campaign status." }, { status: 400 });
    const name = payload.name === undefined ? existing.name : String(payload.name).trim();
    if (!name) return NextResponse.json({ error: "Campaign name is required." }, { status: 400 });
    const duplicate = await prisma.campaign.findFirst({
      where: { organizationId: authContext.organizationId, name, id: { not: id } },
      select: { id: true }
    });
    if (duplicate) return NextResponse.json({ error: "A campaign with this name already exists." }, { status: 409 });
    const references = await validateCampaignReferences(
      authContext.organizationId,
      authContext.userId,
      {
        ...payload,
        ownerId: payload.ownerId ?? existing.ownerId,
        parentCampaignId: payload.parentCampaignId === undefined ? existing.parentCampaignId : payload.parentCampaignId
      },
      id
    );
    const dates =
      payload.startDate !== undefined || payload.endDate !== undefined
        ? campaignDates(payload.startDate ?? existing.startDate, payload.endDate ?? existing.endDate)
        : {};
    const campaign = await prisma.campaign.update({
      where: { id },
      data: {
        name,
        type: payload.type === undefined ? undefined : requireCampaignType(payload.type),
        ...references,
        ...dates,
        budgetedCost:
          payload.budgetedCost === undefined ? undefined : campaignMoney(payload.budgetedCost, "Budgeted cost"),
        actualCost: payload.actualCost === undefined ? undefined : campaignMoney(payload.actualCost, "Actual cost"),
        expectedRevenue:
          payload.expectedRevenue === undefined
            ? undefined
            : campaignMoney(payload.expectedRevenue, "Expected revenue"),
        description: payload.description === undefined ? undefined : String(payload.description ?? "").trim() || null
      },
      include: campaignInclude
    });
    return NextResponse.json({
      campaign: JSON.parse(JSON.stringify(await hydrateCampaign(authContext.organizationId, campaign)))
    });
  } catch (error) {
    console.error(error);
    const response = authorizationErrorResponse(error);
    if (response) return response;
    const validation = campaignErrorResponse(error);
    if (validation) return NextResponse.json({ error: validation.error }, { status: validation.status });
    return NextResponse.json({ error: "Unable to update campaign." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: { params: Params }) {
  try {
    const authContext = await requireOrganizationContext();
    const { id } = await context.params;
    const campaign = await requireCampaign(authContext.organizationId, id);
    if (campaign.status !== "Planned" || campaign.members.length || campaign.childCampaigns.length)
      return NextResponse.json(
        { error: "Only empty Planned campaigns without child campaigns can be deleted." },
        { status: 409 }
      );
    await prisma.campaign.deleteMany({ where: { id, organizationId: authContext.organizationId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    return NextResponse.json({ error: "Unable to delete campaign." }, { status: 500 });
  }
}
