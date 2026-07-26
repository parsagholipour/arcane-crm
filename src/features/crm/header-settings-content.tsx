"use client";

import { Button } from "@/components/ui/crm-primitives";
import { checkboxClass, FieldShell, inputClass, NativeSelect } from "@/features/crm/controls";
import { cn, formatDateTime } from "@/lib/utils";
import { History, Pin } from "lucide-react";
import { type HeaderUtilityContentProps } from "@/features/crm/header-utility-content";

export function SettingsUtilityContent({ model, utilityProps }: HeaderUtilityContentProps) {
  const {
    settingsQuery,
    setSettingsQuery,
    settingsView,
    setSettingsView,
    density,
    setDensity,
    guidanceEnabled,
    setGuidanceEnabled,
    consoleTabsEnabled,
    setConsoleTabsEnabled,
    timezone,
    setTimezone,
    locale,
    setLocale,
    setupStateByShortcutId,
    visibleSetupShortcuts,
    updateSetupShortcutState,
    openSetupShortcut,
    clearSetupShortcutHistory,
    savePreferences
  } = model;
  const { data } = utilityProps;

  return (
    <div className="p-3">
      <div className="mb-3 rounded border border-[#d8dde6] bg-[#f8f8f8] p-3">
        <div className="text-sm font-semibold">Quick Settings</div>
        <div className="mt-1 text-xs text-[#706e6b]">
          Preferences, pinned setup shortcuts, and recent setup launches are saved for {data.user.alias}.
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <FieldShell label="Density">
            <NativeSelect
              options={["Comfy", "Compact"]}
              value={density}
              onChange={(value) => {
                setDensity(value);
                void savePreferences({ displayDensity: value });
              }}
            />
          </FieldShell>
          <FieldShell label="Timezone">
            <NativeSelect
              options={["Asia/Dubai", "UTC", "America/New_York", "America/Los_Angeles", "Europe/London"]}
              value={timezone}
              onChange={(value) => {
                setTimezone(value);
                void savePreferences({ timezone: value });
              }}
            />
          </FieldShell>
          <FieldShell label="Locale">
            <NativeSelect
              options={["en-US", "en-GB", "ar-AE", "fr-FR", "de-DE"]}
              value={locale}
              onChange={(value) => {
                setLocale(value);
                void savePreferences({ locale: value });
              }}
            />
          </FieldShell>
        </div>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <label className="flex items-center justify-between rounded-lg border border-[#e4e7ec] bg-white p-2 text-sm shadow-card">
            Guidance cards
            <input
              type="checkbox"
              checked={guidanceEnabled}
              onChange={(event) => {
                setGuidanceEnabled(event.target.checked);
                void savePreferences({ guidanceEnabled: event.target.checked });
              }}
              className={checkboxClass}
            />
          </label>
          <label className="flex items-center justify-between rounded-lg border border-[#e4e7ec] bg-white p-2 text-sm shadow-card">
            Console tabs
            <input
              type="checkbox"
              checked={consoleTabsEnabled}
              onChange={(event) => {
                setConsoleTabsEnabled(event.target.checked);
                void savePreferences({ consoleTabsEnabled: event.target.checked });
              }}
              className={checkboxClass}
            />
          </label>
        </div>
      </div>
      <div className="mb-2 flex gap-2">
        <input
          className={inputClass}
          value={settingsQuery}
          onChange={(event) => setSettingsQuery(event.target.value)}
          placeholder="Search setup, objects, reports..."
        />
        <Button onClick={() => void clearSetupShortcutHistory()}>Clear recent</Button>
      </div>
      <div className="mb-3 inline-flex rounded border border-[#c9c9c9] bg-white p-0.5 text-xs">
        {(["All", "Pinned", "Recent"] as const).map((view) => (
          <button
            key={view}
            className={cn("rounded px-2 py-1", settingsView === view && "bg-brand-600 text-white")}
            onClick={() => setSettingsView(view)}
          >
            {view}
          </button>
        ))}
      </div>
      <div className="max-h-80 space-y-2 overflow-auto">
        {visibleSetupShortcuts.map((shortcut) => {
          const state = setupStateByShortcutId[shortcut.id];
          const pinned = state?.pinned === true;
          return (
            <div
              key={shortcut.id}
              className={cn("rounded border border-[#d8dde6] p-2 text-sm", pinned && "border-brand-500 bg-brand-50")}
            >
              <div className="flex items-start justify-between gap-2">
                <button className="min-w-0 flex-1 text-left" onClick={() => void openSetupShortcut(shortcut)}>
                  <span className="flex items-center gap-2 font-semibold">
                    {pinned && <Pin size={13} className="shrink-0 fill-brand-600 text-brand-600" />}
                    <span className="truncate">{shortcut.title}</span>
                  </span>
                  <span className="mt-1 block text-xs text-[#706e6b]">{shortcut.summary}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-1 text-[11px] uppercase text-[#706e6b]">
                    <span>{shortcut.category}</span>
                    {Boolean(state?.lastOpenedAt) && (
                      <span className="inline-flex items-center gap-1 normal-case">
                        <History size={11} /> {formatDateTime(String(state.lastOpenedAt))}
                      </span>
                    )}
                  </span>
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button onClick={() => void openSetupShortcut(shortcut)}>Open</Button>
                <Button onClick={() => void updateSetupShortcutState(shortcut, { pinned: !pinned })}>
                  {pinned ? "Unpin" : "Pin"}
                </Button>
              </div>
            </div>
          );
        })}
        {visibleSetupShortcuts.length === 0 && (
          <div className="rounded border border-dashed border-[#d8dde6] p-4 text-center text-sm text-[#706e6b]">
            No setup shortcuts match this view.
          </div>
        )}
      </div>
    </div>
  );
}
