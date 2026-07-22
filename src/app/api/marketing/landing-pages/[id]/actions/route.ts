import { authorizationErrorResponse, requireOrganizationContext } from "@/lib/organization-context";
import { createMarketingPageNotification, marketingLandingPageInclude, marketingPageErrorResponse, requireLandingPage } from "@/lib/marketing-pages";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type Params = Promise<{ id: string }>;

export async function POST(request: NextRequest, context: { params: Params }) {
  try {
    const auth = await requireOrganizationContext();
    const { id } = await context.params;
    const existing = await requireLandingPage(auth.organizationId, id);
    const action = String((await request.json()).action ?? "").toLowerCase();
    const transition = existing.status === "Draft" && action === "publish"
      ? { status: "Published", publishedAt: new Date(), archivedAt: null }
      : existing.status === "Published" && action === "archive"
        ? { status: "Archived", archivedAt: new Date() }
        : existing.status === "Archived" && action === "restore"
          ? { status: "Draft", archivedAt: null }
          : null;
    if (!transition) return NextResponse.json({ error: `Cannot ${action || "perform that action"} while the landing page is ${existing.status}.` }, { status: 409 });
    const result = await prisma.$transaction(async (tx) => {
      const page = await tx.marketingLandingPage.update({ where: { id }, data: transition, include: marketingLandingPageInclude });
      const notification = await createMarketingPageNotification(tx, { organizationId: auth.organizationId, userId: auth.userId, title: `Landing page ${page.status.toLowerCase()}`, body: `${page.name} is now ${page.status}.` });
      return { page, notifications: [notification] };
    });
    return NextResponse.json(JSON.parse(JSON.stringify(result)));
  } catch (error) {
    console.error(error);
    const response = authorizationErrorResponse(error);
    if (response) return response;
    const validation = marketingPageErrorResponse(error);
    if (validation) return NextResponse.json({ error: validation.error }, { status: validation.status });
    return NextResponse.json({ error: "Unable to update landing page." }, { status: 500 });
  }
}
