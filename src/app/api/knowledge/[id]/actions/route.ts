import { authorizationErrorResponse, requireOrganizationContext } from "@/lib/organization-context";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type Params = Promise<{ id: string }>;
export async function POST(request: NextRequest, { params }: { params: Params }) {
  try {
    const context = await requireOrganizationContext(); const { id } = await params; const existing = await prisma.knowledgeArticle.findFirst({ where: { id, organizationId: context.organizationId } }); if (!existing) return NextResponse.json({ error: "Knowledge article not found." }, { status: 404 }); const action = String((await request.json()).action ?? "").toLowerCase(); const now = new Date(); let data;
    if (action === "publish" && existing.publicationStatus === "Draft") { if (!existing.title.trim() || !existing.urlName.trim() || !existing.bodyRichText?.trim()) return NextResponse.json({ error: "Title, URL Name, and article body are required before publishing." }, { status: 400 }); data = { publicationStatus: "Published", validationStatus: "Validated", publishedAt: now, archivedAt: null, archivedById: null, updatedById: context.userId }; }
    else if (action === "archive" && existing.publicationStatus === "Published") data = { publicationStatus: "Archived", archivedAt: now, archivedById: context.userId, updatedById: context.userId };
    else if (action === "restore" && existing.publicationStatus === "Archived") data = { publicationStatus: "Draft", validationStatus: "Not Validated", archivedAt: null, archivedById: null, updatedById: context.userId };
    else return NextResponse.json({ error: `Cannot ${action || "perform that action"} while the article is ${existing.publicationStatus}.` }, { status: 409 });
    const article = await prisma.knowledgeArticle.update({ where: { id }, data });
    const notification = await prisma.notification.create({ data: { organizationId: context.organizationId, userId: context.userId, title: `Knowledge ${article.publicationStatus.toLowerCase()}`, body: `${article.title} is now ${article.publicationStatus}.`, href: `/lightning/r/Knowledge__kav/${id}/view`, category: "Knowledge" } });
    return NextResponse.json({ article, notifications: [notification] });
  } catch (error) { return authorizationErrorResponse(error) ?? NextResponse.json({ error: "Unable to update Knowledge lifecycle." }, { status: 500 }); }
}
