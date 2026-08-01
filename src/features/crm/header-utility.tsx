"use client";

import * as Popover from "@radix-ui/react-popover";
import { Minus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { NativeSelect } from "@/features/crm/controls";
import { HeaderUtilityContent } from "@/features/crm/header-utility-content";
import { type HeaderUtilityProps, useHeaderUtility } from "@/features/crm/use-header-utility";

export function HeaderUtility(props: HeaderUtilityProps) {
  const { icon: Icon, label, kind } = props;
  const model = useHeaderUtility(props);

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          aria-label={label}
          className="relative flex h-8 w-8 items-center justify-center rounded-md text-[#444] hover:bg-[#f2f4f7] hover:text-brand-700 focus-visible:bg-[#f2f4f7] focus-visible:text-brand-700 active:scale-90 active:bg-[#e8ebef] data-[state=open]:bg-brand-50 data-[state=open]:text-brand-700"
        >
          <Icon size={17} />
          {model.effectiveBadge && (
            <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ba0517] px-1 text-[10px] text-white">
              {model.effectiveBadge}
            </span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          collisionPadding={8}
          className={cn(
            "z-50 max-w-[calc(100vw-1rem)] overflow-hidden rounded-lg border border-[#d8dde6] bg-white shadow-popover",
            kind === "help" || kind === "settings"
              ? "w-[460px]"
              : kind === "agentforce"
                ? "w-[420px]"
                : kind === "notifications"
                  ? "w-[400px]"
                  : "w-[360px]"
          )}
        >
          <div className="flex min-h-11 items-center justify-between gap-1 border-b border-[#e4e7ec] px-3 py-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <div className="shrink-0 text-sm font-semibold">{label}</div>
              {kind === "notifications" && (
                <div
                  className="inline-flex rounded-md bg-[#f2f4f7] p-0.5 text-[11px] font-medium"
                  role="tablist"
                  aria-label="Filter notifications"
                >
                  {(["all", "unread"] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      role="tab"
                      aria-selected={model.notificationFilter === filter}
                      className={cn(
                        "min-h-6 rounded px-2 capitalize text-[#5f6368] transition-colors hover:text-[#181818]",
                        model.notificationFilter === filter && "bg-white font-semibold text-brand-700 shadow-sm"
                      )}
                      onClick={() => model.setNotificationFilter(filter)}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              )}
              {kind === "notifications" && (
                <NativeSelect
                  aria-label="Notification category"
                  className="h-7 min-h-7 w-[108px] px-2 py-0.5 text-[11px]"
                  options={model.availableNotificationCategories}
                  value={model.notificationCategory}
                  onChange={model.setNotificationCategory}
                />
              )}
            </div>
            <div className="flex items-center gap-1">
              {kind === "notifications" && (
                <span className="whitespace-nowrap text-[11px] font-medium text-[#706e6b]" aria-live="polite">
                  {model.unreadCount} unread
                </span>
              )}
              {kind === "help" && (
                <Popover.Close asChild>
                  <button className="rounded p-1 hover:bg-[#f3f3f3]" aria-label={`Minimize ${label}`} title="Minimize">
                    <Minus size={14} />
                  </button>
                </Popover.Close>
              )}
              <Popover.Close asChild>
                <button
                  className="flex h-7 w-7 items-center justify-center rounded-md text-[#706e6b] hover:bg-[#f3f3f3] hover:text-[#181818]"
                  aria-label={`Close ${label}`}
                >
                  <X size={15} />
                </button>
              </Popover.Close>
            </div>
          </div>
          <HeaderUtilityContent model={model} utilityProps={props} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
