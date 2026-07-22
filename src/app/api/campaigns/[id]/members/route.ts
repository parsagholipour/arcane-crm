import { AppAuthorizationError, authorizationErrorResponse, requireOrganizationContext } from "@/lib/organization-context";
import { CAMPAIGN_MEMBER_STATUSES, CampaignValidationError, campaignErrorResponse, createCampaignNotification, hydrateCampaign, requireCampaign } from "@/lib/campaigns";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type Params = Promise<{ id: string }>;

export async function POST(request: NextRequest, context: { params: Params }) {
  try {
    const authContext = await requireOrganizationContext(); const { id } = await context.params; const campaign = await requireCampaign(authContext.organizationId, id);
    if (campaign.status === "Archived") return NextResponse.json({ error: "Archived campaigns cannot receive members." }, { status: 409 });
    const payload = await request.json();
    const objectType = String(payload.objectType ?? "");
    const recordIds: string[] = Array.from(new Set<string>(Array.isArray(payload.recordIds) ? payload.recordIds.map((value: unknown) => String(value)).filter(Boolean) : []));
    const status = String(payload.status ?? "Sent");
    if (!["Lead", "Contact"].includes(objectType)) throw new CampaignValidationError("Campaign members must be Leads or Contacts.");
    if (!recordIds.length) throw new CampaignValidationError("Select at least one campaign member.");
    if (!(CAMPAIGN_MEMBER_STATUSES as readonly string[]).includes(status)) throw new CampaignValidationError("Choose a valid member status.");
    const count = objectType === "Lead" ? await prisma.lead.count({ where: { organizationId: authContext.organizationId, id: { in: recordIds } } }) : await prisma.contact.count({ where: { organizationId: authContext.organizationId, id: { in: recordIds } } });
    if (count !== recordIds.length) throw new AppAuthorizationError("One or more selected campaign members were not found.", 404);
    await prisma.$transaction(recordIds.map((recordId) => prisma.campaignMember.upsert({
      where: { organizationId_campaignId_objectType_recordId: { organizationId: authContext.organizationId, campaignId: id, objectType, recordId } },
      update: { status, responded: ["Responded", "Attended", "Converted"].includes(status), firstRespondedAt: ["Responded", "Attended", "Converted"].includes(status) ? new Date() : undefined },
      create: { organizationId: authContext.organizationId, campaignId: id, objectType, recordId, status, responded: ["Responded", "Attended", "Converted"].includes(status), firstRespondedAt: ["Responded", "Attended", "Converted"].includes(status) ? new Date() : null }
    })));
    const refreshed = await requireCampaign(authContext.organizationId, id); const notification = await createCampaignNotification(authContext.organizationId, authContext.userId, "Campaign members added", `${recordIds.length} ${objectType.toLowerCase()} record${recordIds.length === 1 ? "" : "s"} added to ${refreshed.name}.`, id);
    return NextResponse.json({ campaign: JSON.parse(JSON.stringify(await hydrateCampaign(authContext.organizationId, refreshed))), notifications: [notification] });
  } catch (error) { const response = authorizationErrorResponse(error); if (response) return response; const validation = campaignErrorResponse(error); if (validation) return NextResponse.json({ error: validation.error }, { status: validation.status }); return NextResponse.json({ error: "Unable to add campaign members." }, { status: 500 }); }
}
