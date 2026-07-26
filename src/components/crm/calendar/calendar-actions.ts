import type { Dispatch, SetStateAction } from "react";
import type { CalendarItem } from "@/lib/calendar";
import { DEFAULT_CALENDAR_COLOR } from "@/lib/calendar-items";
import { apiRequest, jsonBody } from "@/lib/api/client";
import { resourceApi } from "@/lib/api/resources";
import type { RecordData } from "@/lib/crm-types";
import {
  calendarSourceType,
  recordId,
  text,
  type CalendarSourceDialogState,
  type CalendarWorkspaceProps,
  type ScopePrompt
} from "@/components/crm/calendar/primitives";

type CalendarActionsOptions = Pick<
  CalendarWorkspaceProps,
  "onDataChange" | "onEditEvent" | "onNavigate" | "onOpenVideoCall" | "onToast"
> & {
  loadWindow: () => Promise<void>;
  setCalendarDialog: Dispatch<SetStateAction<CalendarSourceDialogState>>;
  setOptimistic: Dispatch<SetStateAction<Record<string, { startAt: string; endAt: string }>>>;
  setScopePrompt: Dispatch<SetStateAction<ScopePrompt>>;
  setSelectedKey: Dispatch<SetStateAction<string | null>>;
};

export function createCalendarActions(options: CalendarActionsOptions) {
  const {
    loadWindow,
    onDataChange,
    onEditEvent,
    onNavigate,
    onOpenVideoCall,
    onToast,
    setCalendarDialog,
    setOptimistic,
    setScopePrompt,
    setSelectedKey
  } = options;

  async function persistTimes(item: CalendarItem, startAt: Date, endAt: Date, scope: "single" | "all") {
    const key = item.occurrenceKey;
    setOptimistic((previous) => ({
      ...previous,
      [key]: { startAt: startAt.toISOString(), endAt: endAt.toISOString() }
    }));
    try {
      await apiRequest<RecordData>(`/api/records/Event/${item.id}`, {
        method: "PATCH",
        body: jsonBody({
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          recurrenceScope: scope,
          occurrenceStart: item.occurrenceStart
        })
      });
      onToast({ tone: "success", message: "Event rescheduled." });
      await loadWindow();
    } catch (error) {
      setOptimistic((previous) => {
        const next = { ...previous };
        delete next[key];
        return next;
      });
      onToast({ tone: "error", message: error instanceof Error ? error.message : "Unable to reschedule the event." });
    }
  }

  async function deleteItem(item: CalendarItem, scope: "single" | "all") {
    try {
      const params = new URLSearchParams({ scope });
      if (item.occurrenceStart) params.set("occurrenceStart", item.occurrenceStart);
      await apiRequest<RecordData>(`/api/records/Event/${item.id}?${params.toString()}`, { method: "DELETE" });
      setSelectedKey(null);
      onToast({ tone: "success", message: scope === "single" ? "Occurrence removed." : "Event deleted." });
      onDataChange((previous) => ({
        ...previous,
        events: previous.events.filter((record) => recordId(record) !== item.id || scope === "single")
      }));
      await loadWindow();
    } catch (error) {
      onToast({ tone: "error", message: error instanceof Error ? error.message : "Unable to delete the event." });
    }
  }

  function requestMove(item: CalendarItem, startAt: Date, endAt: Date) {
    if (item.recurring) setScopePrompt({ item, action: "move", startAt, endAt });
    else void persistTimes(item, startAt, endAt, "all");
  }

  function requestDelete(item: CalendarItem) {
    if (item.recurring) {
      setScopePrompt({ item, action: "delete" });
      return;
    }
    if (!globalThis.confirm(`Delete "${item.title}"?`)) return;
    void deleteItem(item, "all");
  }

  function openItem(item: CalendarItem) {
    if (item.kind === "videoCall") {
      onOpenVideoCall(item.record);
      return;
    }
    if (item.kind === "task") {
      const href =
        item.record.relatedObjectType && item.record.relatedRecordId
          ? `/lightning/r/${text(item.record.relatedObjectType)}/${text(item.record.relatedRecordId)}/view`
          : null;
      if (href) onNavigate(href);
      return;
    }
    onEditEvent(item.record, { occurrenceStart: item.occurrenceStart ?? null, recurring: item.recurring });
  }

  async function saveCalendarSource(values: RecordData, source?: RecordData) {
    const name = text(values.name).trim();
    if (!name) {
      onToast({ tone: "error", message: "Calendar name is required." });
      return;
    }
    const payload: RecordData = {
      name,
      type: calendarSourceType(values),
      color: text(values.color) || DEFAULT_CALENDAR_COLOR,
      visible: values.visible !== false
    };
    try {
      const response = source
        ? await resourceApi.updateCalendarSource(recordId(source), payload)
        : await resourceApi.createCalendarSource(payload);
      const sources = Array.isArray(response.calendarSources) ? (response.calendarSources as RecordData[]) : null;
      onDataChange((previous) => ({
        ...previous,
        calendarSources:
          sources ??
          (source
            ? previous.calendarSources.map((item) =>
                recordId(item) === recordId(source) ? { ...item, ...payload } : item
              )
            : [
                ...previous.calendarSources,
                { ...payload, id: text(response.calendarSource && (response.calendarSource as RecordData).id) }
              ])
      }));
      setCalendarDialog(null);
      onToast({ tone: "success", message: source ? "Calendar updated." : "Calendar added." });
    } catch (error) {
      onToast({ tone: "error", message: error instanceof Error ? error.message : "Unable to save calendar." });
    }
  }

  async function setSourceVisibility(source: RecordData, visible: boolean) {
    onDataChange((previous) => ({
      ...previous,
      calendarSources: previous.calendarSources.map((item) =>
        recordId(item) === recordId(source) ? { ...item, visible } : item
      )
    }));
    try {
      await resourceApi.updateCalendarSource(recordId(source), { ...source, visible });
    } catch {
      onDataChange((previous) => ({
        ...previous,
        calendarSources: previous.calendarSources.map((item) =>
          recordId(item) === recordId(source) ? { ...item, visible: !visible } : item
        )
      }));
      onToast({ tone: "error", message: "Unable to update calendar visibility." });
    }
  }

  async function deleteCalendarSource(source: RecordData) {
    if (!globalThis.confirm(`Delete the calendar "${text(source.name)}"? Its events stay in the CRM.`)) return;
    try {
      await resourceApi.deleteCalendarSource(recordId(source));
      onDataChange((previous) => ({
        ...previous,
        calendarSources: previous.calendarSources.filter((item) => recordId(item) !== recordId(source))
      }));
      onToast({ tone: "success", message: "Calendar deleted." });
    } catch (error) {
      onToast({ tone: "error", message: error instanceof Error ? error.message : "Unable to delete calendar." });
    }
  }

  return {
    deleteCalendarSource,
    deleteItem,
    openItem,
    persistTimes,
    requestDelete,
    requestMove,
    saveCalendarSource,
    setSourceVisibility
  };
}
