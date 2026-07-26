import { notFound } from "next/navigation";
import { KnowledgeFeedbackForm } from "@/components/knowledge/KnowledgeFeedbackForm";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
type Params = Promise<{ organization: string; slug: string }>;
function plainText(value: string | null) {
  return (value ?? "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

export default async function PublicKnowledgePage({ params }: { params: Params }) {
  const { organization, slug } = await params;
  const tenant = await prisma.organization.findUnique({
    where: { slug: organization },
    select: { id: true, name: true }
  });
  const row = tenant
    ? await prisma.knowledgeArticle.findFirst({
        where: { organizationId: tenant.id, urlName: slug, publicationStatus: "Published", visibleToCustomer: true }
      })
    : null;
  const article = row && tenant ? { ...row, organization: tenant } : null;
  if (!article) notFound();
  await prisma.knowledgeArticle.update({
    where: { id: article.id },
    data: { totalViewCount: { increment: 1 }, lastViewedAt: new Date() }
  });
  return (
    <main className="min-h-screen bg-[#f3f3f3] px-4 py-10 text-[#181818]">
      <article className="mx-auto max-w-3xl rounded-xl border border-[#e4e7ec] bg-white p-6 shadow-sm md:p-10">
        <header className="border-b border-[#d8dde6] pb-6">
          <div className="text-sm font-semibold text-brand-600">{article.organization.name} Help Center</div>
          <h1 className="mt-2 text-3xl font-semibold text-shell">{article.title}</h1>
          {article.summary && <p className="mt-3 text-lg text-[#514f4d]">{article.summary}</p>}
          <div className="mt-4 text-xs text-[#706e6b]">
            Article {article.articleNumber || article.id} · Updated {article.updatedAt.toLocaleDateString("en-US")}
          </div>
        </header>
        <div className="whitespace-pre-wrap py-8 text-[15px] leading-7 text-[#2e2e2e]">
          {plainText(article.bodyRichText)}
        </div>
        <KnowledgeFeedbackForm organization={organization} slug={slug} />
      </article>
    </main>
  );
}
