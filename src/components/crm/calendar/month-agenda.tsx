"use client";

import { CalendarClock, CheckSquare, Repeat, Video } from "lucide-react";
import { type ReactNode } from "react";
import {
  allDayItemsForDay,
  calendarTimeRange,
  fullDateLabel,
  layoutDayItems,
  sameMonth,
  toDateInputValue,
  weekdayHeaderLabels,
  type CalendarItem
} from "@/lib/calendar";
import { cn } from "@/lib/utils";
import { ItemPopover } from "@/components/crm/calendar/event-detail";
import { text } from "@/components/crm/calendar/primitives";

export function MonthView({
  items,
  days,
  anchorDate,
  weekStartsOn,
  timeZone,
  expandedDay,
  selectedKey,
  onExpandDay,
  onSelect,
  onCreateAt,
  renderPopover
}: {
  items: CalendarItem[];
  days: Date[];
  anchorDate: Date;
  weekStartsOn: number;
  timeZone: string;
  expandedDay: string | null;
  selectedKey: string | null;
  onExpandDay: (key: string | null) => void;
  onSelect: (key: string | null) => void;
  onCreateAt: (day: Date) => void;
  renderPopover: (item: CalendarItem) => ReactNode;
}) {
  return (
    <div className="grid grid-cols-7 border-b border-[#d8dde6] text-xs">
      {weekdayHeaderLabels(weekStartsOn).map((label) => (
        <div key={label} className="border-b border-l border-[#d8dde6] bg-[#f3f3f3] p-2 text-center font-semibold">
          {label}
        </div>
      ))}
      {days.map((day) => {
        const key = toDateInputValue(day);
        const dayItems = itemsOnDay(items, day, timeZone);
        const expanded = expandedDay === key;
        const shown = expanded ? dayItems : dayItems.slice(0, 3);
        const isToday = key === toDateInputValue(new Date());
        return (
          <div
            key={key}
            className={cn(
              "min-h-28 border-l border-t border-[#d8dde6] p-2 align-top",
              !sameMonth(day, anchorDate) && "bg-[#fafafa] text-[#a8a8a8]"
            )}
          >
            <div className="mb-1 flex items-center justify-between">
              <button
                className={cn(
                  "rounded px-1 font-semibold hover:bg-brand-50",
                  isToday && "bg-brand-500 text-white hover:bg-brand-600"
                )}
                onClick={() => onCreateAt(day)}
              >
                {day.getDate()}
              </button>
            </div>
            <div className="space-y-1">
              {shown.map((item) => (
                <ItemPopover
                  key={item.occurrenceKey}
                  item={item}
                  open={selectedKey === item.occurrenceKey}
                  onOpenChange={(open) => onSelect(open ? item.occurrenceKey : null)}
                  renderPopover={renderPopover}
                >
                  <button
                    className="flex w-full items-center gap-1 rounded border bg-white px-1.5 py-1 text-left text-[11px] leading-tight"
                    style={{ borderColor: item.color, boxShadow: `inset 3px 0 0 ${item.color}` }}
                    onClick={() => onSelect(selectedKey === item.occurrenceKey ? null : item.occurrenceKey)}
                  >
                    {item.recurring && <Repeat size={9} className="shrink-0" aria-hidden="true" />}
                    <span className="truncate font-semibold">{item.title}</span>
                  </button>
                </ItemPopover>
              ))}
              {dayItems.length > 3 && (
                <button
                  className="text-[11px] font-semibold text-brand-700 hover:underline"
                  onClick={() => onExpandDay(expanded ? null : key)}
                >
                  {expanded ? "Show less" : `+${dayItems.length - 3} more`}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
export function AgendaView({
  items,
  days,
  timeZone,
  selectedKey,
  onSelect,
  renderPopover
}: {
  items: CalendarItem[];
  days: Date[];
  timeZone: string;
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  renderPopover: (item: CalendarItem) => ReactNode;
}) {
  const grouped = days
    .map((day) => ({ day, dayItems: itemsOnDay(items, day, timeZone) }))
    .filter((entry) => entry.dayItems.length > 0);

  if (grouped.length === 0) {
    return (
      <div className="p-10 text-center">
        <CalendarClock size={28} className="mx-auto text-[#a8a8a8]" aria-hidden="true" />
        <p className="mt-3 text-sm text-[#706e6b]">Nothing scheduled in the next {days.length} days.</p>
      </div>
    );
  }

  return (
    <div className="max-h-[70vh] divide-y divide-[#e4e7ec] overflow-auto">
      {grouped.map(({ day, dayItems }) => (
        <div key={toDateInputValue(day)} className="grid gap-2 p-3 sm:grid-cols-[160px_minmax(0,1fr)]">
          <div className="text-sm font-semibold text-[#181818]">{fullDateLabel(day)}</div>
          <div className="space-y-1">
            {dayItems.map((item) => (
              <ItemPopover
                key={item.occurrenceKey}
                item={item}
                open={selectedKey === item.occurrenceKey}
                onOpenChange={(open) => onSelect(open ? item.occurrenceKey : null)}
                renderPopover={renderPopover}
              >
                <button
                  className="flex w-full items-start gap-3 rounded border border-[#e4e7ec] px-3 py-2 text-left hover:bg-brand-50"
                  onClick={() => onSelect(selectedKey === item.occurrenceKey ? null : item.occurrenceKey)}
                >
                  <span className="mt-1 h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: item.color }} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 truncate text-sm font-semibold">
                      {item.kind === "videoCall" && <Video size={12} aria-hidden="true" />}
                      {item.kind === "task" && <CheckSquare size={12} aria-hidden="true" />}
                      {item.recurring && <Repeat size={12} aria-hidden="true" />}
                      {item.title}
                    </span>
                    <span className="block truncate text-xs text-[#706e6b]">
                      {calendarTimeRange(item, timeZone)}
                      {item.record.location ? ` · ${text(item.record.location)}` : ""}
                    </span>
                  </span>
                </button>
              </ItemPopover>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
export function itemsOnDay(items: CalendarItem[], day: Date, timeZone: string) {
  const timed = layoutDayItems(items, day, timeZone).map((entry) => entry.item);
  return [...allDayItemsForDay(items, day, timeZone), ...timed];
}
