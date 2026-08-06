"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Activity,
  Bell,
  Building2,
  ChevronDown,
  CircleHelp,
  Edit3,
  HelpCircle,
  Home,
  List,
  Megaphone,
  Settings,
  ShoppingBag,
  Sparkles,
  Target,
  User,
  X
} from "lucide-react";
import Link from "next/link";
import { type ElementType } from "react";
import { type AppKey, type ScopedCrmData } from "@/lib/crm-types";
import { type AiEmailDraft } from "@/lib/ai-types";
import { cn } from "@/lib/utils";
import { ReloriqLogo } from "@/components/brand/ReloriqLogo";
import { BRAND } from "@/lib/brand";
import { type ToastState } from "@/components/ui/crm-primitives";
import { HeaderUtility } from "@/features/crm/header-utility";
import { consoleTabListHref, pathMatches } from "@/features/crm/record-model";
import { SearchOverlay } from "@/features/crm/search";
import { type ScopedCrmDataUpdater, type ConsoleTab } from "@/features/crm/shared-types";
import { navItemsForApp } from "@/features/crm/shell-model";

export const appRail: Array<{ key: AppKey; label: string; href: string; icon: ElementType }> = [
  { key: "home", label: "Home", href: "/lightning/page/home", icon: Home },
  { key: "contacts", label: "Contacts", href: "/lightning/app/contacts", icon: User },
  { key: "accounts", label: "Accounts", href: "/lightning/app/accounts", icon: Building2 },
  { key: "sales", label: "Sales", href: "/lightning/app/sales", icon: Target },
  { key: "service", label: "Service", href: "/lightning/app/service", icon: CircleHelp },
  { key: "marketing", label: "Marketing", href: "/lightning/app/marketing", icon: Megaphone },
  { key: "commerce", label: "Commerce", href: "/lightning/app/commerce", icon: ShoppingBag },
  { key: "your-account", label: "Your Account", href: "/lightning/app/your-account", icon: User }
];
export function LeftAppRail({ activeApp }: { activeApp: AppKey }) {
  return (
    <aside className="flex w-[80px] shrink-0 flex-col items-center bg-shell py-3 text-white">
      <nav className="flex w-full flex-1 flex-col items-stretch gap-0.5 px-1.5" aria-label="App launcher">
        {appRail.map((item) => {
          const Icon = item.icon;
          const active = item.key === activeApp;
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex min-h-[3.75rem] flex-col items-center justify-center gap-1 rounded-md px-0.5 py-1.5 text-[12.5px] leading-tight text-[#c9e0f5] outline-none transition-[background-color,color,box-shadow] duration-150",
                "hover:bg-[#29276b] hover:text-white hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]",
                "focus-visible:bg-[#29276b] focus-visible:text-white focus-visible:shadow-[inset_0_0_0_2px_#ffffff]",
                "active:bg-[#312e81]",
                active && "bg-[#29276b] font-semibold text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.28)]"
              )}
            >
              {active && (
                <span className="absolute bottom-2 left-0.5 top-2 w-0.5 rounded-full bg-white" aria-hidden="true" />
              )}
              <Icon
                size={22}
                className={cn("transition-transform duration-150 group-hover:scale-105", active && "scale-105")}
              />
              <span className="text-center">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
export function GlobalHeader({
  data,
  pathname,
  onNavigate,
  onOpenDraft,
  onDataChange,
  onToast
}: {
  data: ScopedCrmData;
  pathname: string;
  onNavigate: (href: string) => void;
  onOpenDraft: (draft: AiEmailDraft) => void;
  onDataChange: ScopedCrmDataUpdater;
  onToast: (toast: ToastState) => void;
}) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-[#d8dde6] bg-white px-3">
      <ReloriqLogo className="min-w-[112px] text-shell" wordmarkClassName="text-[17px] font-bold" />
      <SearchOverlay data={data} onNavigate={onNavigate} onDataChange={onDataChange} onToast={onToast} />
      <div className="ml-auto flex items-center gap-1">
        <HeaderUtility
          icon={Sparkles}
          label={BRAND.assistant}
          kind="agentforce"
          data={data}
          pathname={pathname}
          onNavigate={onNavigate}
          onOpenDraft={onOpenDraft}
          onDataChange={onDataChange}
          onToast={onToast}
        />
        <HeaderUtility
          icon={Activity}
          label="Guidance Center"
          kind="guidance"
          data={data}
          pathname={pathname}
          onNavigate={onNavigate}
          onOpenDraft={onOpenDraft}
          onDataChange={onDataChange}
          onToast={onToast}
        />
        <HeaderUtility
          icon={HelpCircle}
          label={`${BRAND.name} Help`}
          kind="help"
          data={data}
          pathname={pathname}
          onNavigate={onNavigate}
          onOpenDraft={onOpenDraft}
          onDataChange={onDataChange}
          onToast={onToast}
        />
        <HeaderUtility
          icon={Settings}
          label="Quick Settings"
          kind="settings"
          data={data}
          pathname={pathname}
          onNavigate={onNavigate}
          onOpenDraft={onOpenDraft}
          onDataChange={onDataChange}
          onToast={onToast}
        />
        <HeaderUtility
          icon={Bell}
          label="Notifications"
          kind="notifications"
          data={data}
          pathname={pathname}
          onNavigate={onNavigate}
          onOpenDraft={onOpenDraft}
          onDataChange={onDataChange}
          onToast={onToast}
        />
        <HeaderUtility
          icon={User}
          label="View profile"
          kind="profile"
          data={data}
          pathname={pathname}
          onNavigate={onNavigate}
          onOpenDraft={onOpenDraft}
          onDataChange={onDataChange}
          onToast={onToast}
        />
      </div>
    </header>
  );
}
export function AppNavBar({
  data,
  activeApp,
  pathname,
  onEditNav
}: {
  data: ScopedCrmData;
  activeApp: AppKey;
  pathname: string;
  onEditNav: () => void;
}) {
  const app = appRail.find((item) => item.key === activeApp)!;
  const AppIcon = app.icon;
  const items = navItemsForApp(activeApp, data);
  const visible = items.slice(0, 7);
  const overflow = items.slice(7);
  return (
    <div className="relative z-10 flex h-11 shrink-0 items-center gap-4 border-b border-[#e4e7ec] bg-white px-3 shadow-header">
      <div className="flex min-w-32 items-center gap-2 font-semibold text-[#181818]">
        <AppIcon size={18} className="text-brand-600" />
        <span>{app.label}</span>
      </div>
      <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden" aria-label={`${app.label} navigation`}>
        {visible.map((item) => {
          const active = pathMatches(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "whitespace-nowrap border-b-2 border-transparent px-3 py-3 text-sm text-[#181818] transition-colors duration-150 hover:border-brand-500 hover:bg-brand-50/60 hover:text-brand-700",
                "focus-visible:border-brand-500 focus-visible:bg-brand-50/60 focus-visible:text-brand-700",
                active && "border-brand-500 bg-brand-50/40 font-semibold text-brand-700"
              )}
            >
              {item.label}
            </Link>
          );
        })}
        {overflow.length > 0 && (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="flex items-center gap-1 rounded px-3 py-2 text-sm transition-colors duration-150 hover:bg-[#f3f3f3] hover:text-brand-700 focus-visible:bg-[#f3f3f3]">
                More <ChevronDown size={14} />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="z-50 min-w-44 rounded border border-[#d8dde6] bg-white p-1 shadow-popover">
                {overflow.map((item) => (
                  <DropdownMenu.Item key={item.href} asChild>
                    <Link href={item.href} className="block rounded px-3 py-2 text-sm hover:bg-brand-50">
                      {item.label}
                    </Link>
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        )}
      </nav>
      <button
        onClick={onEditNav}
        className="flex items-center gap-1 rounded px-2 py-1 text-xs text-brand-700 transition-colors duration-150 hover:bg-brand-50 focus-visible:bg-brand-50 active:bg-brand-100"
      >
        <Edit3 size={14} />
        Edit nav items
      </button>
    </div>
  );
}
export function ConsoleTabs({
  tabs,
  activeHref,
  onClose
}: {
  tabs: ConsoleTab[];
  activeHref: string;
  onClose: (href: string) => void;
}) {
  const maxVisibleTabs = 6;
  const activeTab = tabs.find((tab) => tab.href === activeHref);
  const baseVisibleTabs =
    tabs.length > maxVisibleTabs && activeTab && tabs.indexOf(activeTab) >= maxVisibleTabs
      ? [...tabs.slice(0, maxVisibleTabs - 1), activeTab]
      : tabs.slice(0, maxVisibleTabs);
  const visibleHrefs = new Set(baseVisibleTabs.map((tab) => tab.href));
  const overflowTabs = tabs.filter((tab) => !visibleHrefs.has(tab.href));

  return (
    <div className="flex h-9 shrink-0 items-end gap-1 overflow-hidden border-b border-[#d8dde6] bg-[#f3f3f3] px-2 pt-1">
      {baseVisibleTabs.map((tab) => (
        <div
          key={tab.href}
          role="tab"
          aria-selected={activeHref === tab.href}
          className={cn(
            "flex h-8 max-w-56 items-center rounded-t border border-[#d8dde6] bg-white text-xs",
            activeHref === tab.href && "border-b-white font-semibold"
          )}
        >
          <Link href={tab.href} className="truncate px-3">
            * {tab.label}
          </Link>
          <Link
            href={consoleTabListHref(tab.href)}
            className="mr-1 flex h-5 w-5 items-center justify-center rounded text-[#706e6b] hover:bg-[#f3f3f3] hover:text-brand-700"
            aria-label={`List ${tab.label}`}
          >
            <List size={12} />
          </Link>
          <button
            className="mr-1 flex h-5 w-5 items-center justify-center rounded hover:bg-[#f3f3f3]"
            aria-label={`Close tab ${tab.label}`}
            onClick={() => onClose(tab.href)}
          >
            <X size={12} />
          </button>
        </div>
      ))}
      {overflowTabs.length > 0 && (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              className="flex h-8 items-center gap-1 rounded-t border border-[#d8dde6] bg-white px-3 text-xs hover:bg-[#f8f8f8]"
              aria-label={`More console tabs, ${overflowTabs.length} hidden`}
            >
              More <ChevronDown size={12} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="z-50 min-w-64 rounded border border-[#d8dde6] bg-white p-1 shadow-popover">
              {overflowTabs.map((tab) => (
                <DropdownMenu.Item key={tab.href} asChild>
                  <div className="flex items-center gap-1 rounded px-2 py-1.5 text-sm hover:bg-brand-50">
                    <Link href={tab.href} className="min-w-0 flex-1 truncate">
                      * {tab.label}
                    </Link>
                    <Link
                      href={consoleTabListHref(tab.href)}
                      className="flex h-6 w-6 items-center justify-center rounded text-[#706e6b] hover:bg-white hover:text-brand-700"
                      aria-label={`List ${tab.label}`}
                    >
                      <List size={13} />
                    </Link>
                    <button
                      className="flex h-6 w-6 items-center justify-center rounded text-[#706e6b] hover:bg-white hover:text-[#ba0517]"
                      aria-label={`Close tab ${tab.label}`}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onClose(tab.href);
                      }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      )}
    </div>
  );
}
