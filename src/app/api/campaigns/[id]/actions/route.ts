import { authorizationErrorResponse, requireOrganizationContext } from "@/lib/organization-context";
import { campaignInclude, createCampaignNotification, hydrateCampaign, requireCampaign } from "@/lib/campaigns";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type Params = Promise<{ id: string }>;
const transitions: Record<string, Record<string, string>> = {
  Planned: { activate: "In Progress", archive: "Archived" },
  "In Progress": { complete: "Completed", archive: "Archived" },
  Completed: { archive: "Archived", reopen: "In Progress" },
  Archived: { restore: "Planned" }
};

export async function POST(request: NextRequest, context: { params: Params }) {
  try {
    const authContext = await requireOrganizationContext();
    const { id } = await context.params;
    const existing = await requireCampaign(authContext.organizationId, id);
    const action = String((await request.json()).action ?? "").toLowerCase();
    const status = transitions[existing.status]?.[action];
    if (!status)
      return NextResponse.json(
        { error: `Cannot ${action || "perform that action"} while the campaign is ${existing.status}.` },
        { status: 409 }
      );
    const now = new Date();
    const campaign = await prisma.campaign.update({
      where: { id },
      data: {
        status,
        activatedAt: status === "In Progress" ? (existing.activatedAt ?? now) : undefined,
        completedAt: status === "Completed" ? now : status === "In Progress" ? null : undefined,
        archivedAt: status === "Archived" ? now : status === "Planned" ? null : undefined
      },
      include: campaignInclude
    });
    const notification = await createCampaignNotification(
      authContext.organizationId,
      authContext.userId,
      `Campaign ${status.toLowerCase()}`,
      `${campaign.name} is now ${status}.`,
      id
    );
    return NextResponse.json({
      campaign: JSON.parse(JSON.stringify(await hydrateCampaign(authContext.organizationId, campaign))),
      notifications: [notification]
    });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    return NextResponse.json({ error: "Unable to update campaign status." }, { status: 500 });
  }
}
