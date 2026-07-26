"use client";

import * as Popover from "@radix-ui/react-popover";
import { Minus, X } from "lucide-react";
import { cn } from "@/lib/utils";
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
          className={cn(
            "z-50 rounded border border-[#d8dde6] bg-white shadow-popover",
            kind === "help" || kind === "settings" ? "w-[460px]" : kind === "agentforce" ? "w-[420px]" : "w-[360px]"
          )}
        >
          <div className="flex items-center justify-between border-b border-[#d8dde6] px-3 py-2">
            <div className="font-semibold">{label}</div>
            <div className="flex items-center gap-1">
              {kind === "help" && (
                <Popover.Close asChild>
                  <button className="rounded p-1 hover:bg-[#f3f3f3]" aria-label={`Minimize ${label}`} title="Minimize">
                    <Minus size={14} />
                  </button>
                </Popover.Close>
              )}
              <Popover.Close asChild>
                <button className="rounded p-1 hover:bg-[#f3f3f3]" aria-label={`Close ${label}`}>
                  <X size={14} />
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
