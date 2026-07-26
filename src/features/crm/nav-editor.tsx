"use client";

import { GripVertical, Plus, X } from "lucide-react";
import { useState } from "react";
import { APP_NAV } from "@/lib/crm-metadata";
import { type AppKey, type AppNavItem, type ScopedCrmData } from "@/lib/crm-types";
import { BaseDialog, Button } from "@/components/ui/crm-primitives";
import { appRail } from "@/features/crm/shell";
import { navItemsForApp } from "@/features/crm/shell-model";

export function NavEditModal({
  app,
  data,
  onClose,
  onSave,
  onReset
}: {
  app: AppKey;
  data: ScopedCrmData;
  onClose: () => void;
  onSave: (app: AppKey, items: AppNavItem[]) => Promise<boolean>;
  onReset: (app: AppKey) => Promise<boolean>;
}) {
  const appLabel = appRail.find((item) => item.key === app)?.label ?? "Current";
  const [items, setItems] = useState<AppNavItem[]>(() => navItemsForApp(app, data));
  const available = APP_NAV[app].filter((item) => !items.some((current) => current.href === item.href));

  function moveItem(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    setItems((current) => {
      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  }

  function removeItem(href: string) {
    if (items.length <= 1) return;
    setItems((current) => current.filter((item) => item.href !== href));
  }

  function addItem(item: AppNavItem) {
    setItems((current) => [...current, item]);
  }

  return (
    <BaseDialog
      open
      title={`Edit ${appLabel} App Navigation Items`}
      onClose={onClose}
      wide
      footer={
        <>
          <Button onClick={() => available[0] && addItem(available[0])}>Add More Items</Button>
          <Button onClick={() => onReset(app)}>Reset Defaults</Button>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => onSave(app, items)}>
            Save
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-[#706e6b]">
        Reorder visible navigation items with Arrow Up/Down when a row is focused, or use the buttons. Remove items to
        hide them from the app nav, or add them back from available items.
      </p>
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase text-[#706e6b]">Visible Navigation Items</div>
          <div className="space-y-2">
            {items.map((item, index) => (
              <div
                key={item.href}
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    moveItem(index, -1);
                  }
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    moveItem(index, 1);
                  }
                }}
                className="flex items-center gap-2 rounded-lg border border-[#e4e7ec] bg-white p-2 shadow-card outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              >
                <GripVertical size={16} className="shrink-0 text-[#706e6b]" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{item.label}</div>
                  <div className="truncate text-xs text-[#706e6b]">{item.href}</div>
                </div>
                <button
                  className="rounded border border-[#c9c9c9] px-2 py-1 text-xs disabled:opacity-40"
                  disabled={index === 0}
                  onClick={() => moveItem(index, -1)}
                  aria-label={`Move ${item.label} up`}
                >
                  Up
                </button>
                <button
                  className="rounded border border-[#c9c9c9] px-2 py-1 text-xs disabled:opacity-40"
                  disabled={index === items.length - 1}
                  onClick={() => moveItem(index, 1)}
                  aria-label={`Move ${item.label} down`}
                >
                  Down
                </button>
                <button
                  className="rounded p-1 text-[#706e6b] hover:bg-[#f3f3f3] hover:text-[#ba0517] disabled:opacity-40"
                  disabled={items.length <= 1}
                  onClick={() => removeItem(item.href)}
                  aria-label={`Remove ${item.label}`}
                >
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 text-xs font-semibold uppercase text-[#706e6b]">Available Items</div>
          <div className="space-y-2 rounded border border-[#d8dde6] bg-[#f8f8f8] p-2">
            {available.map((item) => (
              <button
                key={item.href}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-[#e4e7ec] bg-white px-2 py-2 text-left text-sm shadow-card hover:border-brand-500 hover:bg-brand-50"
                onClick={() => addItem(item)}
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{item.label}</span>
                  <span className="block truncate text-xs text-[#706e6b]">{item.href}</span>
                </span>
                <Plus size={14} className="shrink-0 text-brand-600" />
              </button>
            ))}
            {available.length === 0 && (
              <div className="rounded border border-dashed border-[#d8dde6] bg-white p-3 text-sm text-[#706e6b]">
                All available items are already in the navigation.
              </div>
            )}
          </div>
        </div>
      </div>
    </BaseDialog>
  );
}
