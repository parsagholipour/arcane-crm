import { authorizationErrorResponse, requireOrganizationContext } from "@/lib/organization-context";
import { createMarketingPageNotification, landingPageFields, landingPageSlug, landingPageText, marketingLandingPageInclude, marketingPageErrorResponse, optionalLandingPageText, validateLandingPageReferences } from "@/lib/marketing-pages";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const context = await requireOrganizationContext();
    const landingPages = await prisma.marketingLandingPage.findMany({ where: { organizationId: context.organizationId }, include: marketingLandingPageInclude, orderBy: { updatedAt: "desc" } });
    return NextResponse.json({ landingPages: JSON.parse(JSON.stringify(landingPages)) });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    return NextResponse.json({ error: "Unable to load landing pages." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireOrganizationContext();
    const payload = await request.json();
    const name = landingPageText(payload.name, "Page Name", "name");
    const slug = landingPageSlug(payload.slug || name);
    if (!slug) return NextResponse.json({ error: "URL Slug is required.", field: "slug" }, { status: 400 });
    const headline = landingPageText(payload.headline, "Headline", "headline");
    const description = optionalLandingPageText(payload.description, "description", 2000);
    const submitLabel = landingPageText(payload.submitLabel || "Submit", "Submit Label", "submitLabel", 60);
    const successMessage = landingPageText(payload.successMessage || "Thanks. Your information was received.", "Success Message", "successMessage", 500);
    const fields = landingPageFields(payload.fields);
    const campaignId = String(payload.campaignId ?? "").trim() || null;
    const ownerId = String(payload.ownerId ?? context.userId).trim();
    await validateLandingPageReferences(context.organizationId, ownerId, campaignId);
    const result = await prisma.$transaction(async (tx) => {
      const page = await tx.marketingLandingPage.create({
        data: { organizationId: context.organizationId, name, slug, headline, description, submitLabel, successMessage, fields, campaignId, ownerId, createdById: context.userId },
        include: marketingLandingPageInclude
      });
      const notification = await createMarketingPageNotification(tx, { organizationId: context.organizationId, userId: context.userId, title: "Landing page created", body: `${page.name} was created as a Draft.` });
      return { page, notifications: [notification] };
    });
    return NextResponse.json(JSON.parse(JSON.stringify(result)), { status: 201 });
  } catch (error) {
    console.error(error);
    const response = authorizationErrorResponse(error);
    if (response) return response;
    const validation = marketingPageErrorResponse(error);
    if (validation) return NextResponse.json({ error: validation.error, field: validation.field }, { status: validation.status });
    return NextResponse.json({ error: "Unable to create landing page." }, { status: 500 });
  }
}
