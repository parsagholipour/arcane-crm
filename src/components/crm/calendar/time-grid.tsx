"use client";

import { Repeat, Video } from "lucide-react";
import { useState, type MutableRefObject, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import {
  MINUTES_PER_DAY,
  SNAP_MINUTES,
  allDayItemsForDay,
  calendarTimeRange,
  layoutDayItems,
  minutesToTimeText,
  minutesFromMidnight,
  shortDayLabel,
  snapMinutes,
  toDateInputValue,
  zonedTimeToUtc,
  type CalendarItem
} from "@/lib/calendar";
import { cn } from "@/lib/utils";
import { ItemPopover } from "@/components/crm/calendar/event-detail";
import { DAY_COLUMN_HEIGHT } from "@/components/crm/calendar/primitives";

export function TimeGridView({
  scrollRef,
  items,
  days,
  timeZone,
  now,
  selectedDate,
  selectedKey,
  onSelectDate,
  onSelect,
  onCreateRange,
  onMove,
  renderPopover
}: {
  scrollRef: MutableRefObject<HTMLDivElement | null>;
  items: CalendarItem[];
  days: Date[];
  timeZone: string;
  now: Date;
  selectedDate: Date;
  selectedKey: string | null;
  onSelectDate: (date: Date) => void;
  onSelect: (key: string | null) => void;
  onCreateRange: (day: Date, startMinutes: number, endMinutes: number) => void;
  onMove: (item: CalendarItem, startAt: Date, endAt: Date) => void;
  renderPopover: (item: CalendarItem) => ReactNode;
}) {
  const [draft, setDraft] = useState<{ dayIndex: number; startMinutes: number; endMinutes: number } | null>(null);
  const [drag, setDrag] = useState<{
    key: string;
    mode: "move" | "resize";
    startMinutes: number;
    endMinutes: number;
    dayIndex: number;
  } | null>(null);

  const hours = Array.from({ length: 24 }, (_, hour) => hour);
  const nowMinutes = minutesFromMidnight(now, timeZone);
  const selectedDateKey = toDateInputValue(selectedDate);

  function minutesFromPointer(element: HTMLElement, clientY: number) {
    const bounds = element.getBoundingClientRect();
    const ratio = (clientY - bounds.top) / bounds.height;
    return Math.max(0, Math.min(MINUTES_PER_DAY, snapMinutes(ratio * MINUTES_PER_DAY)));
  }

  function beginCreate(event: ReactPointerEvent<HTMLDivElement>, dayIndex: number) {
    if (event.button !== 0) return;
    const column = event.currentTarget;
    onSelectDate(days[dayIndex]);
    const startMinutes = minutesFromPointer(column, event.clientY);
    column.setPointerCapture(event.pointerId);
    setDraft({ dayIndex, startMinutes, endMinutes: startMinutes + SNAP_MINUTES });

    const move = (moveEvent: PointerEvent) => {
      const current = minutesFromPointer(column, moveEvent.clientY);
      setDraft({
        dayIndex,
        startMinutes: Math.min(startMinutes, current),
        endMinutes: Math.max(startMinutes + SNAP_MINUTES, current)
      });
    };
    const finish = (upEvent: PointerEvent) => {
      column.removeEventListener("pointermove", move);
      column.removeEventListener("pointerup", finish);
      column.removeEventListener("pointercancel", finish);
      const current = minutesFromPointer(column, upEvent.clientY);
      const start = Math.min(startMinutes, current);
      const end = Math.max(startMinutes + SNAP_MINUTES, current);
      setDraft(null);
      // A plain click means "one hour here", a drag means the range that was drawn.
      onCreateRange(days[dayIndex], start, end - start < 30 ? Math.min(start + 60, MINUTES_PER_DAY - 1) : end);
    };
    column.addEventListener("pointermove", move);
    column.addEventListener("pointerup", finish);
    column.addEventListener("pointercancel", finish);
  }

  function beginDrag(
    event: ReactPointerEvent<HTMLElement>,
    item: CalendarItem,
    dayIndex: number,
    mode: "move" | "resize"
  ) {
    if (event.button !== 0) return;
    event.stopPropagation();
    onSelectDate(days[dayIndex]);
    if (item.kind !== "event") return;
    const column = event.currentTarget.closest("[data-day-column]") as HTMLElement | null;
    if (!column) return;

    const originStart = minutesFromMidnight(item.startAt, timeZone);
    const originEnd =
      originStart + Math.max(SNAP_MINUTES, (new Date(item.endAt).getTime() - new Date(item.startAt).getTime()) / 60000);
    const grabbedAt = minutesFromPointer(column, event.clientY);
    let moved = false;
    let latest = { startMinutes: originStart, endMinutes: originEnd };

    const move = (moveEvent: PointerEvent) => {
      const current = minutesFromPointer(column, moveEvent.clientY);
      if (Math.abs(current - grabbedAt) >= SNAP_MINUTES) moved = true;
      if (!moved) return;
      latest =
        mode === "move"
          ? (() => {
              const delta = current - grabbedAt;
              const duration = originEnd - originStart;
              const start = Math.max(0, Math.min(MINUTES_PER_DAY - duration, originStart + delta));
              return { startMinutes: start, endMinutes: start + duration };
            })()
          : {
              startMinutes: originStart,
              endMinutes: Math.max(originStart + SNAP_MINUTES, Math.min(MINUTES_PER_DAY, current))
            };
      setDrag({ key: item.occurrenceKey, mode, dayIndex, ...latest });
    };

    const finish = () => {
      globalThis.removeEventListener("pointermove", move);
      globalThis.removeEventListener("pointerup", finish);
      globalThis.removeEventListener("pointercancel", finish);
      setDrag(null);
      if (!moved) {
        onSelect(item.occurrenceKey);
        return;
      }
      const dayText = toDateInputValue(days[dayIndex]);
      onMove(
        item,
        zonedTimeToUtc(dayText, minutesToTimeText(latest.startMinutes), timeZone),
        zonedTimeToUtc(dayText, minutesToTimeText(latest.endMinutes), timeZone)
      );
    };

    globalThis.addEventListener("pointermove", move);
    globalThis.addEventListener("pointerup", finish);
    globalThis.addEventListener("pointercancel", finish);
  }

  return (
    <div ref={scrollRef} className="max-h-[70vh] overflow-auto">
      <div
        className={cn(
          "grid min-w-[820px]",
          days.length === 1 ? "grid-cols-[64px_1fr]" : "grid-cols-[64px_repeat(7,minmax(0,1fr))]"
        )}
      >
        <div className="sticky top-0 z-20 border-b border-[#d8dde6] bg-[#f3f3f3] p-2" />
        {days.map((day) => {
          const dayKey = toDateInputValue(day);
          const selected = dayKey === selectedDateKey;
          return (
            <button
              type="button"
              key={dayKey}
              data-day-header={dayKey}
              aria-pressed={selected}
              onClick={() => onSelectDate(day)}
              className={cn(
                "sticky top-0 z-20 border-b border-l border-[#d8dde6] bg-[#f3f3f3] p-2 text-center text-xs font-semibold hover:bg-brand-50",
                selected && "border-b-brand-300 bg-brand-100 text-brand-800 hover:bg-brand-100"
              )}
            >
              {shortDayLabel(day)}
            </button>
          );
        })}

        <div className="border-b border-[#d8dde6] p-2 text-[11px] text-[#706e6b]">All day</div>
        {days.map((day) => {
          const dayKey = toDateInputValue(day);
          const selected = dayKey === selectedDateKey;
          return (
            <div
              key={`${dayKey}-allday`}
              data-day-all-day={dayKey}
              className={cn("min-h-10 space-y-1 border-b border-l border-[#d8dde6] p-1", selected && "bg-brand-50")}
              onClick={() => onSelectDate(day)}
            >
              {allDayItemsForDay(items, day, timeZone).map((item) => (
                <ItemPopover
                  key={item.occurrenceKey}
                  item={item}
                  open={selectedKey === item.occurrenceKey}
                  onOpenChange={(open) => onSelect(open ? item.occurrenceKey : null)}
                  renderPopover={renderPopover}
                >
                  <button
                    className="block w-full truncate rounded px-1.5 py-1 text-left text-[11px] font-semibold text-white"
                    style={{ backgroundColor: item.color }}
                    onClick={() => onSelect(selectedKey === item.occurrenceKey ? null : item.occurrenceKey)}
                  >
                    {item.title}
                  </button>
                </ItemPopover>
              ))}
            </div>
          );
        })}

        <div className="relative" style={{ height: DAY_COLUMN_HEIGHT }}>
          {hours.map((hour) => (
            <div
              key={hour}
              className="absolute right-1 -translate-y-1/2 text-[11px] text-[#706e6b]"
              style={{ top: (hour / 24) * DAY_COLUMN_HEIGHT }}
            >
              {hour === 0 ? "" : `${String(hour).padStart(2, "0")}:00`}
            </div>
          ))}
        </div>

        {days.map((day, dayIndex) => {
          const positioned = layoutDayItems(items, day, timeZone);
          const isToday = toDateInputValue(day) === toDateInputValue(now);
          const selected = toDateInputValue(day) === selectedDateKey;
          return (
            <div
              key={`${toDateInputValue(day)}-grid`}
              data-day-column={toDateInputValue(day)}
              className={cn("relative border-l border-[#d8dde6]", selected && "bg-brand-50")}
              style={{ height: DAY_COLUMN_HEIGHT }}
              onPointerDown={(event) => beginCreate(event, dayIndex)}
            >
              {hours.map((hour) => (
                <div
                  key={hour}
                  className={cn(
                    "absolute inset-x-0 border-t",
                    hour % 2 === 0 ? "border-[#d8dde6]" : "border-[#eef1f6]"
                  )}
                  style={{ top: (hour / 24) * DAY_COLUMN_HEIGHT }}
                />
              ))}

              {draft?.dayIndex === dayIndex && (
                <div
                  className="pointer-events-none absolute inset-x-1 rounded border border-dashed border-brand-600 bg-brand-500/20"
                  style={{
                    top: (draft.startMinutes / MINUTES_PER_DAY) * DAY_COLUMN_HEIGHT,
                    height: ((draft.endMinutes - draft.startMinutes) / MINUTES_PER_DAY) * DAY_COLUMN_HEIGHT
                  }}
                />
              )}

              {isToday && (
                <div
                  className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
                  style={{ top: (nowMinutes / MINUTES_PER_DAY) * DAY_COLUMN_HEIGHT }}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full bg-[#ba0517]" />
                  <span className="h-px flex-1 bg-[#ba0517]" />
                </div>
              )}

              {positioned.map(({ item, topPct, heightPct, columnIndex, columnCount }) => {
                const dragging = drag?.key === item.occurrenceKey && drag.dayIndex === dayIndex;
                const top = dragging ? (drag.startMinutes / MINUTES_PER_DAY) * 100 : topPct;
                const height = dragging ? ((drag.endMinutes - drag.startMinutes) / MINUTES_PER_DAY) * 100 : heightPct;
                return (
                  <ItemPopover
                    key={item.occurrenceKey}
                    item={item}
                    open={selectedKey === item.occurrenceKey}
                    onOpenChange={(open) => onSelect(open ? item.occurrenceKey : null)}
                    renderPopover={renderPopover}
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      aria-label={`${item.title} ${calendarTimeRange(item, timeZone)}`}
                      onPointerDown={(event) => beginDrag(event, item, dayIndex, "move")}
                      onClick={() => {
                        if (item.kind !== "event") onSelect(item.occurrenceKey);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onSelect(item.occurrenceKey);
                        }
                      }}
                      className={cn(
                        "absolute overflow-hidden rounded border-l-4 bg-white/95 px-1.5 py-0.5 text-[11px] leading-tight shadow-sm",
                        item.kind === "event" ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
                        dragging && "z-30 opacity-90 ring-2 ring-brand-500"
                      )}
                      style={{
                        top: `${top}%`,
                        height: `${height}%`,
                        left: `calc(${(columnIndex / columnCount) * 100}% + 2px)`,
                        width: `calc(${(1 / columnCount) * 100}% - 4px)`,
                        borderLeftColor: item.color,
                        boxShadow: `inset 0 0 0 1px ${item.color}33`
                      }}
                    >
                      <div className="flex items-center gap-1 truncate font-semibold text-[#181818]">
                        {item.kind === "videoCall" && <Video size={10} className="shrink-0" aria-hidden="true" />}
                        {item.recurring && <Repeat size={10} className="shrink-0" aria-hidden="true" />}
                        <span className="truncate">{item.title}</span>
                      </div>
                      <div className="truncate text-[#514f4d]">{calendarTimeRange(item, timeZone)}</div>
                      {item.kind === "event" && (
                        <span
                          role="presentation"
                          onPointerDown={(event) => beginDrag(event, item, dayIndex, "resize")}
                          className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
                        />
                      )}
                    </div>
                  </ItemPopover>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
