import { authorizationErrorResponse, requireOrganizationContext } from "@/lib/organization-context";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type Params = Promise<{ id: string }>;
export async function GET(_request: NextRequest, { params }: { params: Params }) {
  try { const context = await requireOrganizationContext(); const { id } = await params; const article = await prisma.knowledgeArticle.findFirst({ where: { id, organizationId: context.organizationId }, include: { feedback: { orderBy: { updatedAt: "desc" }, take: 100 }, _count: { select: { feedback: true } } } }); if (!article) return NextResponse.json({ error: "Knowledge article not found." }, { status: 404 }); return NextResponse.json({ article: JSON.parse(JSON.stringify(article)), metrics: { helpful: article.feedback.filter((item) => item.helpful).length, notHelpful: article.feedback.filter((item) => !item.helpful).length, total: article._count.feedback } }); }
  catch (error) { return authorizationErrorResponse(error) ?? NextResponse.json({ error: "Unable to load Knowledge article." }, { status: 500 }); }
}
