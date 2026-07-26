"use client";

import { Archive, BookOpen, CheckCircle2, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { type ScopedCrmData } from "@/lib/crm-types";
import { formatDateTime } from "@/lib/utils";
import {
  type RecordData,
  type Toast,
  json,
  id,
  text,
  Status,
  secondary,
  primary,
  danger,
  Metric,
  Card,
  plain,
  Detail
} from "@/components/crm/record-details/primitives";

export function KnowledgeDetailPage({
  initial,
  data,
  onEdit,
  onDelete,
  onChanged,
  onToast
}: {
  initial: RecordData;
  data: ScopedCrmData;
  onEdit: () => void;
  onDelete: () => void;
  onChanged: (record: RecordData, notifications?: RecordData[]) => void;
  onToast: (toast: Toast) => void;
}) {
  const [article, setArticle] = useState(initial);
  const [metrics, setMetrics] = useState<RecordData>({});
  const [feedback, setFeedback] = useState<RecordData[]>([]);
  useEffect(() => {
    void json(`/api/knowledge/${id(initial)}`)
      .then((payload) => {
        setArticle(payload.article as RecordData);
        setMetrics(payload.metrics as RecordData);
        setFeedback(
          Array.isArray((payload.article as RecordData).feedback)
            ? ((payload.article as RecordData).feedback as RecordData[])
            : []
        );
      })
      .catch((error) => onToast({ tone: "error", message: error.message }));
  }, [initial, onToast]);
  async function action(actionName: string) {
    if (
      (actionName === "archive" || actionName === "restore") &&
      !window.confirm(`${actionName === "archive" ? "Archive" : "Restore"} this article?`)
    )
      return;
    try {
      const payload = await json(`/api/knowledge/${id(article)}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionName })
      });
      const next = payload.article as RecordData;
      setArticle(next);
      onChanged(next, payload.notifications as RecordData[] | undefined);
      onToast({ tone: "success", message: `Article is now ${text(next.publicationStatus)}.` });
    } catch (error) {
      onToast({ tone: "error", message: error instanceof Error ? error.message : "Unable to update article." });
    }
  }
  const publicHref = `/knowledge/${data.organization.slug}/${text(article.urlName)}`;
  return (
    <section className="space-y-3">
      <div className="rounded-lg border border-[#e4e7ec] bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex gap-3">
            <BookOpen className="text-brand-600" />
            <div>
              <div className="text-xs text-[#706e6b]">Knowledge Article · {text(article.articleNumber)}</div>
              <h1 className="text-2xl font-semibold">{text(article.title)}</h1>
              <div className="mt-2">
                <Status value={article.publicationStatus} />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {article.publicationStatus !== "Archived" && (
              <button className={secondary} onClick={onEdit}>
                Edit
              </button>
            )}
            {article.publicationStatus === "Draft" && (
              <button className={primary} onClick={() => void action("publish")}>
                <CheckCircle2 size={13} /> Publish
              </button>
            )}
            {article.publicationStatus === "Published" && (
              <button className={secondary} onClick={() => void action("archive")}>
                <Archive size={13} /> Archive
              </button>
            )}
            {article.publicationStatus === "Archived" && (
              <button className={secondary} onClick={() => void action("restore")}>
                <RotateCcw size={13} /> Restore
              </button>
            )}
            {article.publicationStatus === "Draft" && (
              <button className={danger} onClick={onDelete}>
                <Trash2 size={13} /> Delete
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Views" value={article.totalViewCount ?? 0} />
        <Metric label="Helpful" value={metrics.helpful ?? 0} />
        <Metric label="Not Helpful" value={metrics.notHelpful ?? 0} />
        <Metric
          label="Visibility"
          value={
            article.visibleToCustomer ? "Customer + Internal" : article.visibleInInternalApp ? "Internal" : "Hidden"
          }
        />
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_330px]">
        <Card title="Article Content">
          <div className="mb-4 text-lg text-[#514f4d]">{text(article.summary)}</div>
          <div className="whitespace-pre-wrap text-sm leading-7">
            {plain(article.bodyRichText) || "No article body."}
          </div>
        </Card>
        <div className="space-y-3">
          <Card title="Publishing">
            <dl className="space-y-3">
              <Detail label="URL Name" value={article.urlName} />
              <Detail label="Validation" value={article.validationStatus} />
              <Detail label="Published" value={article.publishedAt ? formatDateTime(text(article.publishedAt)) : "-"} />
              <Detail
                label="Last Viewed"
                value={article.lastViewedAt ? formatDateTime(text(article.lastViewedAt)) : "-"}
              />
            </dl>
            {article.publicationStatus === "Published" && article.visibleToCustomer && (
              <a
                className="mt-4 inline-flex text-sm font-semibold text-brand-700 hover:underline"
                href={publicHref}
                target="_blank"
                rel="noreferrer"
              >
                Open customer article
              </a>
            )}
          </Card>
          <Card title={`Customer Feedback (${feedback.length})`}>
            {feedback.slice(0, 8).map((item) => (
              <div key={id(item)} className="border-b border-[#eef1f6] py-2 text-sm last:border-0">
                <div className="font-semibold">{item.helpful ? "Helpful" : "Not helpful"}</div>
                <div className="text-[#514f4d]">{text(item.comment) || "No comment"}</div>
                <div className="text-xs text-[#706e6b]">{formatDateTime(text(item.updatedAt))}</div>
              </div>
            ))}
            {!feedback.length && <div className="text-sm text-[#706e6b]">No customer feedback yet.</div>}
          </Card>
        </div>
      </div>
    </section>
  );
}
