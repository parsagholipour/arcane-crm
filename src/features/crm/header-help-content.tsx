"use client";

import { Button } from "@/components/ui/crm-primitives";
import { inputClass } from "@/features/crm/controls";
import { BRAND } from "@/lib/brand";
import { cn, formatDateTime } from "@/lib/utils";
import { Bookmark, BookOpen, History, ThumbsUp } from "lucide-react";
import { type HeaderUtilityContentProps } from "@/features/crm/header-utility-content";

export function HelpUtilityContent({ model, utilityProps }: HeaderUtilityContentProps) {
  const {
    helpQuery,
    setHelpQuery,
    helpView,
    setHelpView,
    helpStateByArticleId,
    visibleHelpArticles,
    updateHelpArticleState,
    openHelpArticle,
    clearHelpHistory
  } = model;
  const { onNavigate } = utilityProps;

  return (
    <div className="p-3">
      <div className="mb-3 flex items-center gap-2 rounded border border-[#d8dde6] bg-[#f8f8f8] p-2">
        <BookOpen size={16} className="text-brand-600" />
        <div>
          <div className="text-sm font-semibold">{BRAND.name} Help</div>
          <div className="text-xs text-[#706e6b]">Saved articles and viewed history are persisted for this user.</div>
        </div>
      </div>
      <input
        className={inputClass}
        value={helpQuery}
        onChange={(event) => setHelpQuery(event.target.value)}
        placeholder="Search help, objects, settings..."
      />
      <div className="mt-2 inline-flex rounded border border-[#c9c9c9] bg-white p-0.5 text-xs">
        {(["All", "Saved", "Recent"] as const).map((view) => (
          <button
            key={view}
            className={cn("rounded px-2 py-1", helpView === view && "bg-brand-600 text-white")}
            onClick={() => setHelpView(view)}
          >
            {view}
          </button>
        ))}
      </div>
      <div className="mt-3 max-h-80 space-y-2 overflow-auto">
        {visibleHelpArticles.map((article) => {
          const state = helpStateByArticleId[article.id];
          const saved = state?.saved === true;
          const helpful = state?.helpful === true;
          return (
            <div
              key={article.id}
              className={cn("rounded border border-[#d8dde6] p-2 text-sm", saved && "border-brand-500 bg-brand-50")}
            >
              <div className="flex items-start justify-between gap-2">
                <button className="min-w-0 flex-1 text-left" onClick={() => void openHelpArticle(article)}>
                  <span className="flex items-center gap-2 font-semibold">
                    {saved && <Bookmark size={13} className="shrink-0 fill-brand-600 text-brand-600" />}
                    <span className="truncate">{article.title}</span>
                  </span>
                  <span className="mt-1 block text-xs text-[#706e6b]">{article.summary}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-1 text-[11px] uppercase text-[#706e6b]">
                    <span>{article.category}</span>
                    {Boolean(state?.viewedAt) && (
                      <span className="inline-flex items-center gap-1 normal-case">
                        <History size={11} /> {formatDateTime(String(state.viewedAt))}
                      </span>
                    )}
                  </span>
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button onClick={() => void openHelpArticle(article)}>Open</Button>
                <Button onClick={() => void updateHelpArticleState(article, { saved: !saved })}>
                  {saved ? "Unsave" : "Save"}
                </Button>
                <Button onClick={() => void updateHelpArticleState(article, { helpful: !helpful })}>
                  <ThumbsUp size={13} /> {helpful ? "Useful" : "Helpful"}
                </Button>
              </div>
            </div>
          );
        })}
        {visibleHelpArticles.length === 0 && (
          <div className="rounded border border-dashed border-[#d8dde6] p-4 text-center text-sm text-[#706e6b]">
            No help articles match this view.
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap justify-between gap-2 border-t border-[#d8dde6] pt-3">
        <Button onClick={() => void clearHelpHistory()}>Clear history</Button>
        <Button onClick={() => onNavigate("/lightning/page/analytics?report=Pipeline%20by%20Stage")}>
          Open Analytics Help
        </Button>
      </div>
    </div>
  );
}
