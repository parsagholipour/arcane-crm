import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type Params = Promise<{ organization: string; slug: string }>;
export async function POST(request: NextRequest, { params }: { params: Params }) {
  try {
    const { organization, slug } = await params; const tenant = await prisma.organization.findUnique({ where: { slug: organization }, select: { id: true } }); const article = tenant ? await prisma.knowledgeArticle.findFirst({ where: { organizationId: tenant.id, urlName: slug, publicationStatus: "Published", visibleToCustomer: true }, select: { id: true, organizationId: true } }) : null;
    if (!article) return NextResponse.json({ error: "Article not found." }, { status: 404 });
    const payload = await request.json(); if (typeof payload.helpful !== "boolean") return NextResponse.json({ error: "Choose whether the article was helpful." }, { status: 400 }); const comment = String(payload.comment ?? "").trim(); if (comment.length > 1000) return NextResponse.json({ error: "Feedback comment must be 1,000 characters or fewer." }, { status: 400 });
    const visitorKey = request.cookies.get("crm_knowledge_visitor")?.value || randomUUID();
    await prisma.knowledgeFeedback.upsert({ where: { organizationId_articleId_visitorKey: { organizationId: article.organizationId, articleId: article.id, visitorKey } }, update: { helpful: payload.helpful, comment: comment || null }, create: { organizationId: article.organizationId, articleId: article.id, visitorKey, helpful: payload.helpful, comment: comment || null } });
    const response = NextResponse.json({ ok: true, message: "Thank you for your feedback." }); response.cookies.set("crm_knowledge_visitor", visitorKey, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365, path: "/" }); return response;
  } catch (error) { console.error(error); return NextResponse.json({ error: "Unable to save feedback." }, { status: 500 }); }
}
