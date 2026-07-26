"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState, type ReactNode } from "react";
import { AsyncButton } from "@/components/crm/AsyncButton";
import { DEFAULT_CALENDAR_COLOR } from "@/lib/calendar-items";
import { cn } from "@/lib/utils";
import { type RecordData } from "@/lib/crm-types";
import {
  type CalendarSourceDialogState,
  text,
  calendarSourceType,
  secondary,
  primary,
  input,
  CALENDAR_SOURCE_COLORS,
  checkbox,
  type ScopePrompt
} from "@/components/crm/calendar/primitives";

export function CalendarSourceModal({
  state,
  onClose,
  onSave
}: {
  state: Exclude<CalendarSourceDialogState, null>;
  onClose: () => void;
  onSave: (values: RecordData, source?: RecordData) => Promise<void>;
}) {
  const source = state.type === "edit" ? state.source : undefined;
  const [values, setValues] = useState<RecordData>(() => ({
    name: text(source?.name),
    type: calendarSourceType(source ?? { type: "My" }),
    color: text(source?.color) || DEFAULT_CALENDAR_COLOR,
    visible: source?.visible !== false
  }));
  const [error, setError] = useState("");

  return (
    <Modal
      title={source ? "Edit Calendar" : "Add Calendar"}
      onClose={onClose}
      footer={
        <>
          <button className={secondary} onClick={onClose}>
            Cancel
          </button>
          <AsyncButton
            className={primary}
            onClick={() => {
              if (!text(values.name).trim()) {
                setError("Complete this field.");
                return;
              }
              setError("");
              return onSave(values, source);
            }}
          >
            Save
          </AsyncButton>
        </>
      }
    >
      <div className="grid gap-3">
        <div className="rounded border border-[#d8dde6] bg-[#f8f9fb] p-3 text-xs text-[#514f4d]">
          This creates a local CRM calendar. Google, Microsoft, and CalDAV synchronization require a configured provider
          connection and are not available. Use the calendar&apos;s .ics export for interoperability.
        </div>
        <Field label="Calendar Name" error={error}>
          <input
            className={input}
            value={text(values.name)}
            onChange={(event) => setValues({ ...values, name: event.target.value })}
          />
        </Field>
        <Field label="Type">
          <select
            className={input}
            value={calendarSourceType(values)}
            onChange={(event) => setValues({ ...values, type: event.target.value })}
          >
            <option value="My">My</option>
            <option value="Other">Other</option>
          </select>
        </Field>
        <Field label="Color">
          <div className="flex flex-wrap gap-2">
            {CALENDAR_SOURCE_COLORS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-label={`Use ${option.label}`}
                onClick={() => setValues({ ...values, color: option.value })}
                className={cn(
                  "h-8 w-8 rounded border border-[#c9c9c9] ring-offset-2",
                  text(values.color) === option.value && "ring-2 ring-brand-500"
                )}
                style={{ backgroundColor: option.value }}
              />
            ))}
          </div>
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className={checkbox}
            checked={values.visible !== false}
            onChange={(event) => setValues({ ...values, visible: event.target.checked })}
          />
          Visible
        </label>
      </div>
    </Modal>
  );
}
export function ScopeDialog({
  prompt,
  onClose,
  onChoose
}: {
  prompt: NonNullable<ScopePrompt>;
  onClose: () => void;
  onChoose: (scope: "single" | "all") => void;
}) {
  const verb = prompt.action === "delete" ? "Delete" : "Reschedule";
  return (
    <Modal
      title={`${verb} repeating event`}
      onClose={onClose}
      footer={
        <>
          <button className={secondary} onClick={onClose}>
            Cancel
          </button>
          <button className={secondary} onClick={() => onChoose("single")}>
            This occurrence
          </button>
          <button className={primary} onClick={() => onChoose("all")}>
            All occurrences
          </button>
        </>
      }
    >
      <p className="text-sm text-[#514f4d]">
        &ldquo;{prompt.item.title}&rdquo; repeats. {verb} only this occurrence, or every occurrence in the series?
      </p>
    </Modal>
  );
}
export function Modal({
  title,
  onClose,
  footer,
  children
}: {
  title: string;
  onClose: () => void;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[100] w-[min(30rem,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-[#d8dde6] bg-white shadow-popover">
          <Dialog.Title className="border-b border-[#d8dde6] px-4 py-3 text-base font-semibold">{title}</Dialog.Title>
          <div className="max-h-[70vh] overflow-auto p-4">{children}</div>
          <div className="flex justify-end gap-2 border-t border-[#d8dde6] px-4 py-3">{footer}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-[#514f4d]">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-[#ba0517]">{error}</span>}
    </label>
  );
}
