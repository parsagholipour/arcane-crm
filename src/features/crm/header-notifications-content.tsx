"use client";

import { BellOff, Check, CheckCheck, ChevronDown, Settings2, Trash2 } from "lucide-react";
import { useState } from "react";
import { BaseDialog, Button } from "@/components/ui/crm-primitives";
import { checkboxClass } from "@/features/crm/controls";
import { type HeaderUtilityContentProps } from "@/features/crm/header-utility-content";
import { notificationCategories } from "@/features/crm/utilities-model";
import { cn, formatDateTime } from "@/lib/utils";

export function NotificationsUtilityContent({ model }: HeaderUtilityContentProps) {
  const [deleteConfirmation, setDeleteConfirmation] = useState<
    { kind: "single"; id: string; title: string } | { kind: "read" } | { kind: "all" } | null
  >(null);
  const {
    notificationFilter,
    notificationPreferences,
    visibleNotifications,
    unreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    openNotification,
    deleteNotification,
    clearReadNotifications,
    clearAllNotifications,
    updateNotificationPreference
  } = model;
  const enabledPreferenceCount = notificationCategories.filter(
    (category) => notificationPreferences[category] !== false
  ).length;
  const confirmationTitle =
    deleteConfirmation?.kind === "single"
      ? "Delete notification?"
      : deleteConfirmation?.kind === "read"
        ? "Clear read notifications?"
        : "Clear all notifications?";
  const confirmationMessage =
    deleteConfirmation?.kind === "single"
      ? `“${deleteConfirmation.title}” will be permanently removed from your feed.`
      : deleteConfirmation?.kind === "read"
        ? "Every notification you’ve already read will be permanently removed from your feed."
        : "Every notification will be permanently removed from your feed.";
  const confirmationAction =
    deleteConfirmation?.kind === "single" ? "Delete" : deleteConfirmation?.kind === "read" ? "Clear read" : "Clear all";

  async function confirmDeletion() {
    const confirmation = deleteConfirmation;
    if (!confirmation) return;

    if (confirmation.kind === "single") await deleteNotification(confirmation.id);
    if (confirmation.kind === "read") await clearReadNotifications();
    if (confirmation.kind === "all") await clearAllNotifications();
    setDeleteConfirmation(null);
  }

  return (
    <div className="flex h-[min(600px,calc(100vh-5.5rem))] min-h-[360px] flex-col overflow-hidden">
      <div className="shrink-0 border-b border-[#e4e7ec] p-3">
        <div className="flex items-center justify-between gap-2">
          <Button className="px-2.5" disabled={unreadCount === 0} onClick={() => void markAllNotificationsRead()}>
            <CheckCheck size={14} aria-hidden="true" />
            Mark all as read
          </Button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-haspopup="dialog"
              className="min-h-8 rounded-md px-2 text-xs font-semibold text-brand-700 hover:bg-brand-50"
              onClick={() => setDeleteConfirmation({ kind: "read" })}
            >
              Clear read
            </button>
            <button
              type="button"
              aria-haspopup="dialog"
              className="min-h-8 rounded-md px-2 text-xs font-semibold text-[#ba0517] hover:bg-[#fef1f2]"
              onClick={() => setDeleteConfirmation({ kind: "all" })}
            >
              Clear all
            </button>
          </div>
        </div>
      </div>

      <details className="group shrink-0 border-b border-[#e4e7ec]">
        <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 px-3 text-xs font-semibold text-[#444] outline-none hover:bg-[#f8f9fb] focus-visible:bg-brand-50 [&::-webkit-details-marker]:hidden">
          <Settings2 size={14} className="text-[#706e6b]" aria-hidden="true" />
          Notification preferences
          <span className="ml-auto font-normal text-[#706e6b]">
            {enabledPreferenceCount} of {notificationCategories.length} on
          </span>
          <ChevronDown
            size={14}
            className="text-[#706e6b] transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <div className="grid grid-cols-2 gap-1 bg-[#fbfcfd] px-3 pb-3 pt-1">
          {notificationCategories.map((category) => (
            <label
              key={category}
              className="flex min-h-8 cursor-pointer items-center justify-between gap-2 rounded-md px-2 text-xs hover:bg-white"
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
      </details>

      <div className="slds-scrollbar min-h-0 flex-1 overflow-y-auto" role="list" aria-label="Notifications">
        {visibleNotifications.map((item) => {
          const isUnread = !item.read;
          const category = String(item.category ?? "General");
          const createdAt = item.createdAt ? formatDateTime(String(item.createdAt)) : "";

          return (
            <div
              key={String(item.id)}
              role="listitem"
              className={cn(
                "group border-b border-[#e4e7ec] transition-colors last:border-b-0 hover:bg-[#f8f9fb]",
                isUnread && "bg-brand-50/60 hover:bg-brand-50"
              )}
            >
              <div className="flex items-start gap-1 p-3">
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => void openNotification(item)}
                    className="w-full min-w-0 rounded-md text-left outline-none focus-visible:shadow-[0_0_0_3px_rgba(79,70,229,0.16)]"
                  >
                    <span className="flex items-start gap-2 text-sm font-semibold leading-5 text-[#181818]">
                      <span
                        className={cn(
                          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                          isUnread ? "bg-brand-600" : "bg-transparent"
                        )}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 break-words">
                        {isUnread && <span className="sr-only">Unread: </span>}
                        {String(item.title)}
                      </span>
                    </span>
                    <span className="ml-4 mt-1 block text-xs leading-[1.45] text-[#5f6368]">{String(item.body)}</span>
                    <span className="ml-4 mt-1.5 block text-[11px] text-[#706e6b]">
                      {category}
                      {createdAt && <span aria-hidden="true"> · </span>}
                      {createdAt}
                    </span>
                  </button>
                  {isUnread && (
                    <button
                      type="button"
                      className="ml-4 mt-2 inline-flex min-h-7 items-center gap-1 rounded-md px-2 text-[11px] font-semibold text-brand-700 hover:bg-white"
                      onClick={() => void markNotificationRead(String(item.id))}
                    >
                      <Check size={13} aria-hidden="true" />
                      Mark as read
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  aria-haspopup="dialog"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#706e6b] opacity-70 hover:bg-white hover:text-[#ba0517] hover:opacity-100 focus-visible:bg-white focus-visible:text-[#ba0517] focus-visible:opacity-100"
                  aria-label={`Delete ${String(item.title)} notification`}
                  title="Delete notification"
                  onClick={() =>
                    setDeleteConfirmation({
                      kind: "single",
                      id: String(item.id),
                      title: String(item.title)
                    })
                  }
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </div>
            </div>
          );
        })}
        {visibleNotifications.length === 0 && (
          <div className="flex h-full min-h-52 flex-col items-center justify-center px-8 text-center">
            <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#f2f4f7] text-[#706e6b]">
              <BellOff size={20} aria-hidden="true" />
            </span>
            <div className="text-sm font-semibold text-[#181818]">
              {notificationFilter === "unread" ? "You’re all caught up" : "No notifications"}
            </div>
            <p className="mt-1 text-xs leading-5 text-[#706e6b]">
              {notificationFilter === "unread"
                ? "There are no unread notifications in this category."
                : "New activity will appear here when it arrives."}
            </p>
          </div>
        )}
      </div>

      <BaseDialog
        open={deleteConfirmation !== null}
        title={confirmationTitle}
        onClose={() => setDeleteConfirmation(null)}
        footer={
          <>
            <Button onClick={() => setDeleteConfirmation(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDeletion}>
              {confirmationAction}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-6 text-[#444]">{confirmationMessage} This action can’t be undone.</p>
      </BaseDialog>
    </div>
  );
}
