import { Prisma } from "@prisma/client";
import { createMarketingPageNotification, marketingLandingPageInclude } from "@/lib/marketing-pages";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type Params = Promise<{ organization: string; slug: string }>;

export async function POST(request: NextRequest, context: { params: Params }) {
  try {
    const { organization, slug } = await context.params;
    const payload = await request.json();
    if (String(payload.website ?? "").trim()) return NextResponse.json({ ok: true });
    const organizationRecord = await prisma.organization.findUnique({ where: { slug: organization }, select: { id: true } });
    if (!organizationRecord) return NextResponse.json({ error: "Form not found." }, { status: 404 });
    const page = await prisma.marketingLandingPage.findFirst({ where: { organizationId: organizationRecord.id, slug, status: "Published" }, include: marketingLandingPageInclude });
    if (!page) return NextResponse.json({ error: "Form not found." }, { status: 404 });

    const allowed = new Set(page.fields);
    const text = (field: string, maximum: number) => String(payload[field] ?? "").trim().slice(0, maximum);
    const lastName = allowed.has("lastName") ? text("lastName", 120) : "";
    const email = text("email", 320).toLowerCase();
    const company = allowed.has("company") ? text("company", 200) : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return NextResponse.json({ error: "A valid Email is required." }, { status: 400 });
    const firstName = allowed.has("firstName") ? text("firstName", 120) : "";
    const phone = allowed.has("phone") ? text("phone", 80) : "";
    const title = allowed.has("title") ? text("title", 160) : "";
    const message = allowed.has("message") ? text("message", 4000) : "";
    const data = Object.fromEntries(page.fields.map((field) => [field, text(field, field === "message" ? 4000 : 320)])) as Prisma.InputJsonObject;
    const duplicateWindow = new Date(Date.now() - 60_000);
    const recentDuplicate = await prisma.marketingFormSubmission.findFirst({
      where: { organizationId: page.organizationId, landingPageId: page.id, submittedAt: { gte: duplicateWindow }, data: { path: ["email"], equals: email } },
      select: { id: true }
    });
    if (recentDuplicate) return NextResponse.json({ error: "Please wait before submitting this form again." }, { status: 429 });

    const result = await prisma.$transaction(async (tx) => {
      const lead = await tx.lead.create({
        data: { organizationId: page.organizationId, status: "New", firstName: firstName || null, lastName: lastName || null, company: company || null, title: title || null, description: message || null, ownerId: page.ownerId, phone: phone || null, email, leadSource: "Web", createdById: page.createdById, updatedById: page.createdById }
      });
      const submission = await tx.marketingFormSubmission.create({ data: { organizationId: page.organizationId, landingPageId: page.id, leadId: lead.id, data } });
      if (page.campaignId) {
        await tx.campaignMember.upsert({
          where: { organizationId_campaignId_objectType_recordId: { organizationId: page.organizationId, campaignId: page.campaignId, objectType: "Lead", recordId: lead.id } },
          update: { status: "Responded", responded: true, firstRespondedAt: new Date() },
          create: { organizationId: page.organizationId, campaignId: page.campaignId, objectType: "Lead", recordId: lead.id, status: "Responded", responded: true, firstRespondedAt: new Date() }
        });
      }
      const submitter = [firstName, lastName].filter(Boolean).join(" ") || email;
      const notification = await createMarketingPageNotification(tx, { organizationId: page.organizationId, userId: page.ownerId, title: "New marketing form submission", body: `${submitter} submitted ${page.name}.`, href: `/lightning/r/Lead/${lead.id}/view` });
      return { submission, lead, notification };
    });
    return NextResponse.json({ ok: true, successMessage: page.successMessage, submissionId: result.submission.id }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unable to submit this form." }, { status: 500 });
  }
}
