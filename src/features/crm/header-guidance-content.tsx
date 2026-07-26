"use client";

import { Button } from "@/components/ui/crm-primitives";
import { guidanceSnoozedUntil, guidanceStateBadgeClass, guidanceStateLabel } from "@/features/crm/shell-model";
import { cn, formatDateTime } from "@/lib/utils";
import { type HeaderUtilityContentProps } from "@/features/crm/header-utility-content";

export function GuidanceUtilityContent({ model, utilityProps }: HeaderUtilityContentProps) {
  const { guidanceItems, updateGuidanceItem } = model;
  const { onNavigate } = utilityProps;

  return (
    <div className="p-3">
      <div className="mb-2 text-sm text-[#706e6b]">
        Contextual setup cards and walkthroughs for the current CRM workspace.
      </div>
      <div className="space-y-2">
        {guidanceItems.map((item) => {
          const state = String(item.state ?? "ACTIVE");
          const snoozedUntil = String(item.snoozedUntil ?? "");
          const isSnoozed = state === "SNOOZED" && guidanceSnoozedUntil(item) > Date.now();
          return (
            <div key={item.id} className="rounded border border-[#d8dde6] p-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div
                    className={cn(
                      "font-semibold",
                      state === "DONE" && "line-through",
                      state === "DISMISSED" && "text-[#706e6b]"
                    )}
                  >
                    {String(item.title)}
                  </div>
                  <div className="text-xs text-[#706e6b]">{String(item.body)}</div>
                  <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
                    <span className={cn("rounded px-1.5 py-0.5", guidanceStateBadgeClass(state))}>
                      {guidanceStateLabel(item)}
                    </span>
                    {isSnoozed && (
                      <span className="rounded bg-[#f3f3f3] px-1.5 py-0.5 text-[#514f4d]">
                        Until {formatDateTime(snoozedUntil)}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  className="rounded border border-[#c9c9c9] px-2 py-1 text-xs"
                  onClick={() => void updateGuidanceItem(String(item.id), state === "DONE" ? "ACTIVE" : "DONE", null)}
                >
                  {state === "DONE" ? "Restore" : "Done"}
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {Boolean(item.href) && <Button onClick={() => onNavigate(String(item.href))}>Open</Button>}
                <Button
                  onClick={() =>
                    void updateGuidanceItem(
                      String(item.id),
                      "SNOOZED",
                      new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                    )
                  }
                >
                  Snooze
                </Button>
                {state === "DISMISSED" ? (
                  <Button onClick={() => void updateGuidanceItem(String(item.id), "ACTIVE", null)}>Restore</Button>
                ) : (
                  <Button onClick={() => void updateGuidanceItem(String(item.id), "DISMISSED", null)}>Dismiss</Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
