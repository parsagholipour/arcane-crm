import { notFound } from "next/navigation";
import { MarketingLeadForm } from "@/components/marketing/MarketingLeadForm";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ organization: string; slug: string }>;

export default async function MarketingFormPage({ params }: { params: Params }) {
  const { organization, slug } = await params;
  const resolvedOrganization = await prisma.organization.findUnique({
    where: { slug: organization },
    select: { id: true, name: true }
  });
  if (!resolvedOrganization) notFound();
  const page = await prisma.marketingLandingPage.findFirst({
    where: { organizationId: resolvedOrganization.id, slug, status: "Published" },
    select: {
      name: true,
      slug: true,
      headline: true,
      description: true,
      submitLabel: true,
      successMessage: true,
      fields: true
    }
  });
  if (!page) notFound();
  return <MarketingLeadForm organizationSlug={organization} organizationName={resolvedOrganization.name} page={page} />;
}
