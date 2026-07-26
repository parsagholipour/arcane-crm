"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronLeft, ChevronRight, Edit3, Eye, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import {
  addCalendarMonths,
  getMonthDays,
  monthYearLabel,
  sameMonth,
  toDateInputValue,
  weekdayHeaderLabels
} from "@/lib/calendar";
import { DEFAULT_CALENDAR_COLOR } from "@/lib/calendar-items";
import { cn } from "@/lib/utils";
import { type ScopedCrmData, type RecordData } from "@/lib/crm-types";
import { recordId, checkbox, text, secondary } from "@/components/crm/calendar/primitives";

export function CalendarSidebar({
  data,
  miniMonth,
  anchorDate,
  weekStartsOn,
  myCalendarSources,
  otherCalendarSources,
  showTasks,
  showVideoCalls,
  onMiniMonthChange,
  onPickDate,
  onAddCalendar,
  onEditCalendar,
  onToggleCalendar,
  onDeleteCalendar,
  onToggleTasks,
  onToggleVideoCalls
}: {
  data: ScopedCrmData;
  miniMonth: Date;
  anchorDate: Date;
  weekStartsOn: number;
  myCalendarSources: RecordData[];
  otherCalendarSources: RecordData[];
  showTasks: boolean;
  showVideoCalls: boolean;
  onMiniMonthChange: (updater: (date: Date) => Date) => void;
  onPickDate: (day: Date) => void;
  onAddCalendar: () => void;
  onEditCalendar: (source: RecordData) => void;
  onToggleCalendar: (source: RecordData, visible: boolean) => void;
  onDeleteCalendar: (source: RecordData) => void;
  onToggleTasks: (visible: boolean) => void;
  onToggleVideoCalls: (visible: boolean) => void;
}) {
  function renderSource(source: RecordData) {
    const visible = source.visible !== false;
    return (
      <div
        key={recordId(source)}
        className="flex items-center justify-between gap-2 rounded px-1 py-1 text-sm hover:bg-brand-50"
      >
        <label className="flex min-w-0 flex-1 items-center gap-2">
          <input
            type="checkbox"
            className={checkbox}
            checked={visible}
            onChange={(event) => onToggleCalendar(source, event.target.checked)}
          />
          <span
            className="h-3 w-3 shrink-0 rounded-sm"
            style={{ backgroundColor: text(source.color) || DEFAULT_CALENDAR_COLOR }}
          />
          <span className={cn("truncate", !visible && "text-[#706e6b] line-through")}>
            {text(source.name) || "Calendar"}
          </span>
        </label>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              aria-label={`${text(source.name) || "Calendar"} options`}
              className="rounded p-1 hover:bg-[#f3f3f3]"
            >
              <MoreHorizontal size={14} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              className="z-50 min-w-36 rounded border border-[#d8dde6] bg-white p-1 shadow-popover"
            >
              <DropdownMenu.Item
                onSelect={() => onEditCalendar(source)}
                className="flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm outline-none hover:bg-brand-50"
              >
                <Edit3 size={13} /> Edit
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={() => onToggleCalendar(source, !visible)}
                className="flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm outline-none hover:bg-brand-50"
              >
                <Eye size={13} /> {visible ? "Hide" : "Show"}
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={() => onDeleteCalendar(source)}
                className="flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm text-[#ba0517] outline-none hover:bg-[#fff1f1]"
              >
                <Trash2 size={13} /> Delete
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    );
  }

  return (
    <aside className="rounded-lg border border-[#e4e7ec] bg-white p-3 shadow-card">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          className={secondary}
          aria-label="Previous month"
          onClick={() => onMiniMonthChange((date) => addCalendarMonths(date, -1))}
        >
          <ChevronLeft size={14} />
        </button>
        <div className="min-w-0 flex-1 text-center text-sm font-semibold">{monthYearLabel(miniMonth)}</div>
        <button
          className={secondary}
          aria-label="Next month"
          onClick={() => onMiniMonthChange((date) => addCalendarMonths(date, 1))}
        >
          <ChevronRight size={14} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {weekdayHeaderLabels(weekStartsOn).map((label, index) => (
          <div key={`${label}-${index}`} className="font-semibold text-[#706e6b]">
            {label.slice(0, 1)}
          </div>
        ))}
        {getMonthDays(miniMonth, weekStartsOn).map((day) => {
          const active = toDateInputValue(day) === toDateInputValue(anchorDate);
          const today = toDateInputValue(day) === toDateInputValue(new Date());
          return (
            <button
              key={toDateInputValue(day)}
              onClick={() => onPickDate(day)}
              className={cn(
                "rounded py-1 hover:bg-brand-50",
                active && "bg-brand-500 text-white hover:bg-brand-600",
                !sameMonth(day, miniMonth) && "text-[#a8a8a8]",
                today && !active && "ring-1 ring-brand-500"
              )}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>

      <div className="mt-4 border-t border-[#d8dde6] pt-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-sm font-semibold">My Calendars</div>
          <button
            aria-label="Add calendar"
            className="rounded p-1 text-brand-700 hover:bg-brand-50"
            onClick={onAddCalendar}
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="space-y-1">
          {myCalendarSources.length > 0 ? (
            myCalendarSources.map(renderSource)
          ) : (
            <div className="text-sm text-[#706e6b]">{data.user.name}</div>
          )}
        </div>
      </div>

      <div className="mt-4 border-t border-[#d8dde6] pt-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-sm font-semibold">Other Calendars</div>
          <button className="text-sm text-brand-700 hover:underline" onClick={onAddCalendar}>
            Add
          </button>
        </div>
        <div className="space-y-1">
          {otherCalendarSources.length > 0 ? (
            otherCalendarSources.map(renderSource)
          ) : (
            <div className="text-sm text-[#706e6b]">No other calendars</div>
          )}
        </div>
      </div>

      <div className="mt-4 border-t border-[#d8dde6] pt-3">
        <div className="mb-2 text-sm font-semibold">Overlays</div>
        <label className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-brand-50">
          <input
            type="checkbox"
            className={checkbox}
            checked={showTasks}
            onChange={(event) => onToggleTasks(event.target.checked)}
          />
          <span className="h-3 w-3 shrink-0 rounded-sm bg-[#f3b451]" />
          <span>Tasks</span>
        </label>
        <label className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-brand-50">
          <input
            type="checkbox"
            className={checkbox}
            checked={showVideoCalls}
            onChange={(event) => onToggleVideoCalls(event.target.checked)}
          />
          <span className="h-3 w-3 shrink-0 rounded-sm bg-[#0176d3]" />
          <span>Video Calls</span>
        </label>
      </div>
    </aside>
  );
}
