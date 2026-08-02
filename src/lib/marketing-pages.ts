import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const MARKETING_FORM_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "company",
  "phone",
  "title",
  "message"
] as const;
export const REQUIRED_MARKETING_FORM_FIELDS = ["email"] as const;

export const marketingLandingPageInclude = {
  campaign: true,
  submissions: { include: { lead: true }, orderBy: { submittedAt: "desc" as const }, take: 20 },
  _count: { select: { submissions: true } }
} satisfies Prisma.MarketingLandingPageInclude;

export class MarketingPageError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 = 400,
    readonly field?: string
  ) {
    super(message);
    this.name = "MarketingPageError";
  }
}

export function marketingPageErrorResponse(error: unknown) {
  if (error instanceof MarketingPageError) return { error: error.message, status: error.status, field: error.field };
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
    return { error: "A landing page with that name or URL slug already exists.", status: 409 as const };
  return null;
}

export function landingPageSlug(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function landingPageFields(value: unknown) {
  const requested = Array.isArray(value) ? value.map(String) : [];
  const allowed = requested.filter((field): field is (typeof MARKETING_FORM_FIELDS)[number] =>
    (MARKETING_FORM_FIELDS as readonly string[]).includes(field)
  );
  const fields = [...new Set([...REQUIRED_MARKETING_FORM_FIELDS, ...allowed])];
  return MARKETING_FORM_FIELDS.filter((field) => fields.includes(field));
}

export async function requireLandingPage(organizationId: string, id: string) {
  const page = await prisma.marketingLandingPage.findFirst({
    where: { id, organizationId },
    include: marketingLandingPageInclude
  });
  if (!page) throw new MarketingPageError("Landing page not found.", 404);
  return page;
}

export async function validateLandingPageReferences(
  organizationId: string,
  ownerId: string,
  campaignId: string | null
) {
  const member = await prisma.organizationMembership.findFirst({
    where: { organizationId, userId: ownerId, status: "ACTIVE", user: { status: "ACTIVE" } },
    select: { userId: true }
  });
  if (!member) throw new MarketingPageError("Owner not found in this organization.", 404, "ownerId");
  if (campaignId) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
      select: { id: true }
    });
    if (!campaign) throw new MarketingPageError("Campaign not found.", 404, "campaignId");
  }
}

export function landingPageText(value: unknown, label: string, field: string, maximum = 200) {
  const text = String(value ?? "").trim();
  if (!text) throw new MarketingPageError(`${label} is required.`, 400, field);
  if (text.length > maximum) throw new MarketingPageError(`${label} cannot exceed ${maximum} characters.`, 400, field);
  return text;
}

export function optionalLandingPageText(value: unknown, field: string, maximum: number) {
  const text = String(value ?? "").trim();
  if (text.length > maximum) throw new MarketingPageError(`${field} cannot exceed ${maximum} characters.`, 400, field);
  return text || null;
}

type NotificationClient = Pick<Prisma.TransactionClient, "notification"> | typeof prisma;

export async function createMarketingPageNotification(
  client: NotificationClient,
  values: { organizationId: string; userId: string; title: string; body: string; href?: string }
) {
  return client.notification.create({
    data: {
      organizationId: values.organizationId,
      userId: values.userId,
      title: values.title,
      body: values.body,
      href: values.href ?? "/lightning/app/marketing",
      category: "Marketing"
    }
  });
}
