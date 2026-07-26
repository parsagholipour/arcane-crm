"use client";

import * as Popover from "@radix-ui/react-popover";
import { Edit3, Trash2 } from "lucide-react";
import { type ReactNode } from "react";
import { calendarTimeRange, type CalendarItem } from "@/lib/calendar";
import { formatReminderOffset } from "@/lib/calendar-reminder-values";
import { describeRecurrence } from "@/lib/calendar-recurrence";
import { cn } from "@/lib/utils";
import { text, secondary, primary } from "@/components/crm/calendar/primitives";

export function ItemPopover({
  item,
  open,
  onOpenChange,
  renderPopover,
  children
}: {
  item: CalendarItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  renderPopover: (item: CalendarItem) => ReactNode;
  children: ReactNode;
}) {
  // An Anchor rather than a Trigger: the callers own the open state, so a click
  // that ends a drag cannot race Radix's own toggle and reopen what it closed.
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Anchor asChild>{children}</Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-[80] w-80 rounded border border-[#d8dde6] bg-white p-3 shadow-popover"
          onPointerDown={(event) => event.stopPropagation()}
        >
          {renderPopover(item)}
          <Popover.Arrow className="fill-white" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
export function EventDetail({
  item,
  timeZone,
  attendeeNames,
  nameRecordName,
  relatedRecordName,
  calendarSourceName,
  assignedToName,
  onEdit,
  onDelete,
  onOpenRelated
}: {
  item: CalendarItem;
  timeZone: string;
  attendeeNames: string[];
  nameRecordName: string;
  relatedRecordName: string;
  calendarSourceName: string;
  assignedToName: string;
  onEdit: () => void;
  onDelete: () => void;
  onOpenRelated: () => void;
}) {
  const recurrence = describeRecurrence(item.record.recurrenceRule, timeZone);
  const related = relatedRecordName || nameRecordName;
  const reminderMinutes = item.record.reminderMinutes;

  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-start gap-2">
        <span className="mt-1 h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: item.color }} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-[#181818]">{item.title}</div>
          <div className="text-xs text-[#706e6b]">
            {new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone }).format(
              new Date(item.startAt)
            )}{" "}
            · {calendarTimeRange(item, timeZone)}
          </div>
        </div>
      </div>

      <dl className="space-y-1 text-xs">
        {recurrence && <DetailRow label="Repeats" value={recurrence} />}
        {Boolean(item.record.location) && <DetailRow label="Location" value={text(item.record.location)} />}
        {attendeeNames.length > 0 && <DetailRow label="Attendees" value={attendeeNames.join(", ")} />}
        {assignedToName && <DetailRow label="Assigned to" value={assignedToName} />}
        {related && <DetailRow label="Related to" value={related} />}
        {calendarSourceName && <DetailRow label="Calendar" value={calendarSourceName} />}
        {Boolean(item.record.showTimeAs) && <DetailRow label="Shows as" value={text(item.record.showTimeAs)} />}
        {reminderMinutes !== null && reminderMinutes !== undefined && (
          <DetailRow label="Reminder" value={formatReminderOffset(reminderMinutes)} />
        )}
      </dl>

      {Boolean(item.record.description) && (
        <p className="max-h-24 overflow-auto whitespace-pre-wrap rounded bg-[#f8f9fb] p-2 text-xs text-[#514f4d]">
          {text(item.record.description)}
        </p>
      )}

      <div className="flex flex-wrap gap-1 border-t border-[#e4e7ec] pt-2">
        {item.kind === "task" ? (
          <button className={secondary} onClick={onOpenRelated}>
            Open related record
          </button>
        ) : (
          <>
            <button className={primary} onClick={onEdit}>
              <Edit3 size={12} /> {item.kind === "videoCall" ? "Open" : "Edit"}
            </button>
            {(relatedRecordName || nameRecordName) && (
              <button className={secondary} onClick={onOpenRelated}>
                Open record
              </button>
            )}
            {item.kind === "event" && (
              <button
                className={cn(secondary, "border-[#ea001e] text-[#ba0517] hover:bg-[#fff1f1]")}
                onClick={onDelete}
              >
                <Trash2 size={12} /> Delete
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
export function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[84px_minmax(0,1fr)] gap-2">
      <dt className="text-[#706e6b]">{label}</dt>
      <dd className="min-w-0 break-words text-[#181818]">{value}</dd>
    </div>
  );
}
