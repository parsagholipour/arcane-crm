"use client";

import { ChevronLeft, ChevronRight, Download, Plus, RefreshCw, Search } from "lucide-react";
import { AsyncButton } from "@/components/crm/AsyncButton";
import { minutesToTimeText, nextTimeSlot, toDateInputValue } from "@/lib/calendar";
import { cn } from "@/lib/utils";
import {
  type ViewMode,
  input,
  SHOW_TIME_AS_FILTERS,
  secondary,
  VIEW_MODES,
  primary
} from "@/components/crm/calendar/primitives";
import { CalendarSidebar } from "@/components/crm/calendar/sidebar";
import { AgendaView, MonthView } from "@/components/crm/calendar/month-agenda";
import { TimeGridView } from "@/components/crm/calendar/time-grid";
import { CalendarSourceModal, ScopeDialog } from "@/components/crm/calendar/dialogs";
import { type CalendarWorkspaceModel } from "@/components/crm/calendar/workspace-controller";

export function CalendarWorkspaceView({ model }: { model: CalendarWorkspaceModel }) {
  const {
    data,
    onCreate,
    timeZone,
    weekStartsOn,
    anchorDate,
    setAnchorDate,
    viewMode,
    setViewMode,
    sidebarVisible,
    setSidebarVisible,
    miniMonth,
    setMiniMonth,
    calendarDialog,
    setCalendarDialog,
    refreshedAt,
    now,
    searchText,
    setSearchText,
    showTimeAsFilter,
    setShowTimeAsFilter,
    assignedToFilter,
    setAssignedToFilter,
    showTasks,
    setShowTasks,
    showVideoCalls,
    setShowVideoCalls,
    loading,
    selectedKey,
    setSelectedKey,
    expandedDay,
    setExpandedDay,
    scopePrompt,
    setScopePrompt,
    scrollRef,
    visibleDays,
    myCalendarSources,
    otherCalendarSources,
    items,
    movePrevious,
    moveNext,
    rangeLabel,
    persistTimes,
    deleteItem,
    requestMove,
    saveCalendarSource,
    setSourceVisibility,
    deleteCalendarSource,
    refreshCalendar,
    renderPopover
  } = model;

  return (
    <>
      <div className={cn("grid gap-3", sidebarVisible && "xl:grid-cols-[280px_minmax(0,1fr)]")}>
        {sidebarVisible && (
          <CalendarSidebar
            data={data}
            miniMonth={miniMonth}
            anchorDate={anchorDate}
            weekStartsOn={weekStartsOn}
            myCalendarSources={myCalendarSources}
            otherCalendarSources={otherCalendarSources}
            showTasks={showTasks}
            showVideoCalls={showVideoCalls}
            onMiniMonthChange={setMiniMonth}
            onPickDate={(day) => setAnchorDate(day)}
            onAddCalendar={() => setCalendarDialog({ type: "new" })}
            onEditCalendar={(source) => setCalendarDialog({ type: "edit", source })}
            onToggleCalendar={(source, visible) => void setSourceVisibility(source, visible)}
            onDeleteCalendar={(source) => void deleteCalendarSource(source)}
            onToggleTasks={setShowTasks}
            onToggleVideoCalls={setShowVideoCalls}
          />
        )}

        <section className="min-w-0 rounded-lg border border-[#e4e7ec] bg-white shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#d8dde6] p-3">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold">Calendar</h1>
              <div className="text-xs text-[#706e6b]">
                {rangeLabel} · {timeZone} ·{" "}
                {loading
                  ? "Loading…"
                  : `Updated ${new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit" }).format(refreshedAt)}`}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <label className="relative">
                <Search
                  size={13}
                  className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[#706e6b]"
                  aria-hidden="true"
                />
                <input
                  className={cn(input, "min-h-8 w-44 py-1 pl-7 text-xs")}
                  placeholder="Search calendar"
                  aria-label="Search calendar"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                />
              </label>
              <select
                className={cn(input, "min-h-8 w-auto py-1 text-xs")}
                aria-label="Show time as"
                value={showTimeAsFilter}
                onChange={(event) => setShowTimeAsFilter(event.target.value)}
              >
                {SHOW_TIME_AS_FILTERS.map((option) => (
                  <option key={option} value={option}>
                    {option === "All" ? "Any status" : option}
                  </option>
                ))}
              </select>
              <select
                className={cn(input, "min-h-8 w-auto py-1 text-xs")}
                aria-label="Assigned to"
                value={assignedToFilter}
                onChange={(event) => setAssignedToFilter(event.target.value)}
              >
                <option value="All">Anyone</option>
                {data.users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
              <button className={secondary} onClick={movePrevious} aria-label="Previous">
                <ChevronLeft size={14} />
              </button>
              <button className={secondary} onClick={() => setAnchorDate(new Date())}>
                Today
              </button>
              <button className={secondary} onClick={moveNext} aria-label="Next">
                <ChevronRight size={14} />
              </button>
              <select
                className={cn(input, "min-h-8 w-auto py-1 text-xs")}
                aria-label="Calendar view"
                value={viewMode}
                onChange={(event) => setViewMode(event.target.value as ViewMode)}
              >
                {VIEW_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
              <AsyncButton className={secondary} onClick={() => refreshCalendar()}>
                <RefreshCw size={14} /> Refresh
              </AsyncButton>
              <a href="/api/calendar/export" className={secondary}>
                <Download size={14} /> Export .ics
              </a>
              <button className={secondary} onClick={() => setSidebarVisible((visible) => !visible)}>
                {sidebarVisible ? "Hide Sidebar" : "Show Sidebar"}
              </button>
              <button
                className={primary}
                onClick={() => onCreate(toDateInputValue(anchorDate), "09:00", nextTimeSlot("09:00"))}
              >
                <Plus size={14} /> New Event
              </button>
            </div>
          </div>

          {viewMode === "Agenda" ? (
            <AgendaView
              items={items}
              days={visibleDays}
              timeZone={timeZone}
              onSelect={setSelectedKey}
              selectedKey={selectedKey}
              renderPopover={renderPopover}
            />
          ) : viewMode === "Month" ? (
            <MonthView
              items={items}
              days={visibleDays}
              anchorDate={anchorDate}
              weekStartsOn={weekStartsOn}
              timeZone={timeZone}
              expandedDay={expandedDay}
              selectedKey={selectedKey}
              onExpandDay={setExpandedDay}
              onSelect={setSelectedKey}
              onCreateAt={(day) => onCreate(toDateInputValue(day), "09:00", nextTimeSlot("09:00"))}
              renderPopover={renderPopover}
            />
          ) : (
            <TimeGridView
              scrollRef={scrollRef}
              items={items}
              days={visibleDays}
              timeZone={timeZone}
              now={now}
              selectedDate={anchorDate}
              selectedKey={selectedKey}
              onSelectDate={setAnchorDate}
              onSelect={setSelectedKey}
              onCreateRange={(day, startMinutes, endMinutes) =>
                onCreate(toDateInputValue(day), minutesToTimeText(startMinutes), minutesToTimeText(endMinutes))
              }
              onMove={requestMove}
              renderPopover={renderPopover}
            />
          )}
        </section>
      </div>

      {calendarDialog && (
        <CalendarSourceModal
          state={calendarDialog}
          onClose={() => setCalendarDialog(null)}
          onSave={saveCalendarSource}
        />
      )}
      {scopePrompt && (
        <ScopeDialog
          prompt={scopePrompt}
          onClose={() => setScopePrompt(null)}
          onChoose={(scope) => {
            const prompt = scopePrompt;
            setScopePrompt(null);
            if (prompt.action === "move") void persistTimes(prompt.item, prompt.startAt, prompt.endAt, scope);
            else void deleteItem(prompt.item, scope);
          }}
        />
      )}
    </>
  );
}
