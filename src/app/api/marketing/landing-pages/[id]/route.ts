import { authorizationErrorResponse, requireOrganizationContext } from "@/lib/organization-context";
import { landingPageFields, landingPageSlug, landingPageText, marketingLandingPageInclude, marketingPageErrorResponse, optionalLandingPageText, requireLandingPage, validateLandingPageReferences } from "@/lib/marketing-pages";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type Params = Promise<{ id: string }>;
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: { params: Params }) {
  try {
    const auth = await requireOrganizationContext();
    const { id } = await context.params;
    return NextResponse.json({ page: JSON.parse(JSON.stringify(await requireLandingPage(auth.organizationId, id))) });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    const validation = marketingPageErrorResponse(error);
    if (validation) return NextResponse.json({ error: validation.error }, { status: validation.status });
    return NextResponse.json({ error: "Unable to load landing page." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: { params: Params }) {
  try {
    const auth = await requireOrganizationContext();
    const { id } = await context.params;
    const existing = await requireLandingPage(auth.organizationId, id);
    if (existing.status !== "Draft") return NextResponse.json({ error: "Only Draft landing pages can be edited. Restore an archived page to Draft first." }, { status: 409 });
    const payload = await request.json();
    if (payload.status !== undefined) return NextResponse.json({ error: "Use a lifecycle action to change landing-page status." }, { status: 400 });
    const name = payload.name === undefined ? existing.name : landingPageText(payload.name, "Page Name", "name");
    const slug = payload.slug === undefined ? existing.slug : landingPageSlug(payload.slug);
    if (!slug) return NextResponse.json({ error: "URL Slug is required.", field: "slug" }, { status: 400 });
    const headline = payload.headline === undefined ? existing.headline : landingPageText(payload.headline, "Headline", "headline");
    const description = payload.description === undefined ? existing.description : optionalLandingPageText(payload.description, "description", 2000);
    const submitLabel = payload.submitLabel === undefined ? existing.submitLabel : landingPageText(payload.submitLabel, "Submit Label", "submitLabel", 60);
    const successMessage = payload.successMessage === undefined ? existing.successMessage : landingPageText(payload.successMessage, "Success Message", "successMessage", 500);
    const fields = payload.fields === undefined ? existing.fields : landingPageFields(payload.fields);
    const campaignId = payload.campaignId === undefined ? existing.campaignId : String(payload.campaignId ?? "").trim() || null;
    const ownerId = payload.ownerId === undefined ? existing.ownerId : String(payload.ownerId).trim();
    await validateLandingPageReferences(auth.organizationId, ownerId, campaignId);
    const page = await prisma.marketingLandingPage.update({ where: { id }, data: { name, slug, headline, description, submitLabel, successMessage, fields, campaignId, ownerId }, include: marketingLandingPageInclude });
    return NextResponse.json({ page: JSON.parse(JSON.stringify(page)) });
  } catch (error) {
    console.error(error);
    const response = authorizationErrorResponse(error);
    if (response) return response;
    const validation = marketingPageErrorResponse(error);
    if (validation) return NextResponse.json({ error: validation.error, field: validation.field }, { status: validation.status });
    return NextResponse.json({ error: "Unable to update landing page." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: { params: Params }) {
  try {
    const auth = await requireOrganizationContext();
    const { id } = await context.params;
    const existing = await requireLandingPage(auth.organizationId, id);
    if (existing.status !== "Draft" || existing._count.submissions > 0) return NextResponse.json({ error: "Only Draft landing pages without submissions can be deleted." }, { status: 409 });
    await prisma.marketingLandingPage.deleteMany({ where: { id, organizationId: auth.organizationId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    const validation = marketingPageErrorResponse(error);
    if (validation) return NextResponse.json({ error: validation.error }, { status: validation.status });
    return NextResponse.json({ error: "Unable to delete landing page." }, { status: 500 });
  }
}
