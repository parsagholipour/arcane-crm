"use client";

import { Button } from "@/components/ui/crm-primitives";
import { checkboxClass, FieldShell, NativeSelect } from "@/features/crm/controls";
import { notificationCategories } from "@/features/crm/utilities-model";
import { cn, formatDateTime } from "@/lib/utils";
import { Trash2 } from "lucide-react";
import { type HeaderUtilityContentProps } from "@/features/crm/header-utility-content";

export function NotificationsUtilityContent({ model }: HeaderUtilityContentProps) {
  const {
    notificationFilter,
    setNotificationFilter,
    notificationCategory,
    setNotificationCategory,
    notificationPreferences,
    visibleNotifications,
    unreadCount,
    availableNotificationCategories,
    markAllNotificationsRead,
    openNotification,
    deleteNotification,
    clearReadNotifications,
    clearAllNotifications,
    updateNotificationPreference
  } = model;

  return (
    <div className="p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="inline-flex rounded border border-[#c9c9c9] bg-white p-0.5 text-xs">
          {(["all", "unread"] as const).map((filter) => (
            <button
              key={filter}
              className={cn("rounded px-2 py-1 capitalize", notificationFilter === filter && "bg-brand-600 text-white")}
              onClick={() => setNotificationFilter(filter)}
            >
              {filter}
            </button>
          ))}
        </div>
        <span className="text-sm text-[#706e6b]">{unreadCount} unread</span>
      </div>
      <FieldShell label="Category">
        <NativeSelect
          options={availableNotificationCategories}
          value={notificationCategory}
          onChange={setNotificationCategory}
        />
      </FieldShell>
      <div className="mb-2 flex flex-wrap gap-2">
        <Button onClick={() => void markAllNotificationsRead()}>Mark all read</Button>
        <Button onClick={() => void clearReadNotifications()}>Clear read</Button>
        <Button onClick={() => void clearAllNotifications()}>Clear all</Button>
      </div>
      <div className="mb-3 rounded border border-[#d8dde6] p-2">
        <div className="mb-1 text-xs font-semibold uppercase text-[#706e6b]">Notification Settings</div>
        <div className="grid grid-cols-2 gap-1">
          {notificationCategories.map((category) => (
            <label
              key={category}
              className="flex items-center justify-between gap-2 rounded px-2 py-1 text-xs hover:bg-[#f8f8f8]"
            >
              <span>{category}</span>
              <input
                type="checkbox"
                checked={notificationPreferences[category] !== false}
                onChange={(event) => void updateNotificationPreference(category, event.target.checked)}
                className={checkboxClass}
              />
            </label>
          ))}
        </div>
      </div>
      <div className="max-h-80 space-y-2 overflow-auto">
        {visibleNotifications.map((item) => (
          <div
            key={String(item.id)}
            className={cn("rounded border border-[#d8dde6] p-2 text-sm", !item.read && "border-brand-500 bg-brand-50")}
          >
            <div className="flex items-start gap-2">
              <button onClick={() => void openNotification(item)} className="min-w-0 flex-1 text-left">
                <span className="flex items-center gap-2 font-semibold">
                  {!item.read && <span className="h-2 w-2 rounded-full bg-brand-600" aria-label="Unread" />}
                  <span className="truncate">{String(item.title)}</span>
                </span>
                <span className="mt-1 block text-xs text-[#706e6b]">{String(item.body)}</span>
                <span className="mt-1 block text-[11px] uppercase text-[#706e6b]">
                  {String(item.category ?? "General")}{" "}
                  {item.createdAt ? `- ${formatDateTime(String(item.createdAt))}` : ""}
                </span>
              </button>
              <button
                className="rounded p-1 text-[#706e6b] hover:bg-white hover:text-[#ba0517]"
                aria-label="Delete notification"
                onClick={() => void deleteNotification(String(item.id))}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {visibleNotifications.length === 0 && (
          <div className="rounded border border-dashed border-[#d8dde6] p-4 text-center text-sm text-[#706e6b]">
            No notifications to show.
          </div>
        )}
      </div>
    </div>
  );
}
