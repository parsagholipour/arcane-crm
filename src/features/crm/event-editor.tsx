"use client";

import { useId, useState } from "react";
import {
  EVENT_SUBJECTS,
  NAME_OBJECT_TYPES,
  OBJECT_DEFINITIONS,
  RELATED_OBJECT_TYPES,
  SHOW_TIME_AS,
  TIME_SLOTS
} from "@/lib/crm-metadata";
import { type ScopedCrmData, type CrmObject, type FieldDefinition, type RecordData } from "@/lib/crm-types";
import { cn } from "@/lib/utils";
import { nextTimeSlot, toDateInputValue, utcToZonedFormValues, zonedTimeToUtc } from "@/lib/calendar";
import {
  DEFAULT_EVENT_REMINDER_MINUTES,
  EVENT_REMINDER_OPTIONS,
  formatReminderOffset
} from "@/lib/calendar-reminder-values";
import {
  RECURRENCE_DAYS,
  describeRecurrence,
  formatRecurrenceRule,
  parseRecurrenceRule,
  type RecurrenceDay,
  type RecurrenceFrequency
} from "@/lib/calendar-recurrence";
import { BaseDialog, Button } from "@/components/ui/crm-primitives";
import { checkboxClass, FieldShell, inputClass, NativeSelect, RadixCheckbox } from "@/features/crm/controls";
import { AttendeePicker, LookupField } from "@/features/crm/form-controls";
import { recordDataShallowEqual } from "@/features/crm/form-model";
import { useUnsavedChangesGuard } from "@/features/crm/record-editors";
import { requiredId } from "@/features/crm/record-model";

export function EventModal({
  data,
  record,
  occurrenceStart,
  recurring = false,
  relatedObjectType,
  relatedRecordId,
  startDate = toDateInputValue(new Date()),
  startTime = "09:00",
  endDate,
  endTime,
  onClose,
  onSave,
  onDelete
}: {
  data: ScopedCrmData;
  record?: RecordData;
  occurrenceStart?: string | null;
  recurring?: boolean;
  relatedObjectType?: CrmObject;
  relatedRecordId?: string;
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  onClose: () => void;
  onSave: (values: RecordData, options?: { id?: string }) => Promise<boolean>;
  onDelete?: (record: RecordData, scope: "single" | "all") => void;
}) {
  const timeZone = String(data.userPreferences[0]?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
  const isEdit = Boolean(record?.id);
  // A recurring occurrence is opened at its own slot, not at the series anchor.
  const editStart = record ? String(record.occurrenceStartAt ?? record.startAt ?? "") : "";
  const editEnd = record ? String(record.occurrenceEndAt ?? record.endAt ?? "") : "";
  const editStartParts = editStart ? utcToZonedFormValues(editStart, timeZone) : null;
  const editEndParts = editEnd ? utcToZonedFormValues(editEnd, timeZone) : null;
  const existingRecurrence = parseRecurrenceRule(record?.recurrenceRule) ?? null;
  const [scope, setScope] = useState<"single" | "all">(recurring ? "single" : "all");
  const allDayCheckboxId = useId();
  const relatedPlural =
    relatedObjectType && relatedObjectType !== "Event" ? OBJECT_DEFINITIONS[relatedObjectType]?.plural : undefined;
  const relatedTypeDefault =
    relatedPlural && RELATED_OBJECT_TYPES.includes(relatedPlural)
      ? relatedPlural
      : relatedObjectType === "Contact" || relatedObjectType === "Lead"
        ? "Accounts"
        : "Accounts";
  const nameTypeDefault =
    relatedObjectType === "Lead" ? "Leads" : relatedObjectType === "Contact" ? "Contacts" : "Contacts";
  const nameRecordDefault =
    relatedObjectType === "Contact" || relatedObjectType === "Lead" ? relatedRecordId : undefined;
  const relatedRecordDefault =
    relatedObjectType &&
    relatedObjectType !== "Contact" &&
    relatedObjectType !== "Lead" &&
    relatedObjectType !== "Event"
      ? relatedRecordId
      : relatedObjectType === "Contact"
        ? (() => {
            const contact = data.contacts.find((item) => item.id === relatedRecordId);
            return contact?.accountId ? String(contact.accountId) : undefined;
          })()
        : undefined;

  const [initialValues] = useState<RecordData>(() => ({
    subject: record ? String(record.subject ?? "--None--") : "--None--",
    description: record ? String(record.description ?? "") : "",
    startDate: editStartParts?.date ?? startDate,
    startTime: editStartParts?.time ?? startTime,
    endDate: editEndParts?.date ?? endDate ?? startDate,
    endTime: editEndParts?.time ?? endTime ?? nextTimeSlot(startTime),
    assignedToId: record ? String(record.assignedToId ?? data.user.id) : data.user.id,
    showTimeAs: record ? String(record.showTimeAs ?? "Busy") : "Busy",
    attendeeIds: record && Array.isArray(record.attendeeIds) ? record.attendeeIds.map(String) : [data.user.id],
    nameObjectType: record ? String(record.nameObjectType ?? nameTypeDefault) : nameTypeDefault,
    nameRecordId: record ? String(record.nameRecordId ?? "") : (nameRecordDefault ?? ""),
    relatedObjectType: record ? String(record.relatedObjectType ?? relatedTypeDefault) : relatedTypeDefault,
    relatedRecordId: record ? String(record.relatedRecordId ?? "") : (relatedRecordDefault ?? ""),
    calendarSourceId: record
      ? String(record.calendarSourceId ?? "")
      : String(data.calendarSources.find((source) => String(source.type ?? "My") !== "Other")?.id ?? ""),
    location: record ? String(record.location ?? "") : "",
    allDay: record ? Boolean(record.allDay) : false,
    private: record ? Boolean(record.private) : false,
    reminderMinutes: record
      ? record.reminderMinutes === null || record.reminderMinutes === undefined
        ? ""
        : String(record.reminderMinutes)
      : String(DEFAULT_EVENT_REMINDER_MINUTES),
    repeatFrequency: existingRecurrence?.freq ?? "None",
    repeatInterval: String(existingRecurrence?.interval ?? 1),
    repeatByDay: existingRecurrence?.byDay ?? [],
    repeatUntil: record?.recurrenceEndAt
      ? utcToZonedFormValues(record.recurrenceEndAt, timeZone).date
      : existingRecurrence?.until
        ? utcToZonedFormValues(existingRecurrence.until, timeZone).date
        : ""
  }));
  const [values, setValues] = useState<RecordData>(() => initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isDirty = !recordDataShallowEqual(values, initialValues);
  const { requestClose, discardDialog } = useUnsavedChangesGuard(isDirty, onClose);

  const nameLookupField: FieldDefinition = {
    name: "nameRecordId",
    label: "Name",
    section: "Related Records",
    type: "lookup",
    lookupObject: String(values.nameObjectType ?? "Contacts") === "Leads" ? "Lead" : "Contact"
  };
  const relatedLookupObject = relatedPluralToCrmObject(String(values.relatedObjectType ?? "Accounts"));
  const relatedLookupField: FieldDefinition | null = relatedLookupObject
    ? {
        name: "relatedRecordId",
        label: "Related To",
        section: "Related Records",
        type: "lookup",
        lookupObject: relatedLookupObject
      }
    : null;
  const attendeeField: FieldDefinition = {
    name: "attendeeIds",
    label: "Attendees",
    section: "Attendees",
    type: "lookup",
    lookupObject: "People"
  };
  const attendeeIds = Array.isArray(values.attendeeIds) ? values.attendeeIds.map(String) : [data.user.id];

  function insertEventQuickText() {
    const snippet = eventQuickTextSnippet(data);
    setValues((current) => {
      const description = String(current.description ?? "");
      return {
        ...current,
        description: [description, snippet].filter(Boolean).join(description ? "\n\n" : "")
      };
    });
  }

  const repeatFrequency = String(values.repeatFrequency ?? "None");
  const repeatByDay = Array.isArray(values.repeatByDay) ? values.repeatByDay.map(String) : [];
  const reminderValue = String(values.reminderMinutes ?? "");
  const reminderOptions: Array<{ value: string; label: string }> = EVENT_REMINDER_OPTIONS.map((option) => ({
    ...option
  }));
  if (reminderValue && !reminderOptions.some((option) => option.value === reminderValue)) {
    reminderOptions.push({ value: reminderValue, label: formatReminderOffset(reminderValue) });
  }
  const recurrenceRule =
    repeatFrequency === "None"
      ? null
      : formatRecurrenceRule({
          freq: repeatFrequency as RecurrenceFrequency,
          interval: Math.max(1, Number(values.repeatInterval) || 1),
          byDay: repeatByDay as RecurrenceDay[]
        });
  const recurrenceSummary = recurrenceRule ? describeRecurrence(recurrenceRule, timeZone) : "";

  async function submit(stayOpen = false) {
    const required = [
      "subject",
      "startDate",
      "endDate",
      "assignedToId",
      ...(values.allDay ? [] : ["startTime", "endTime"])
    ];
    const nextErrors = Object.fromEntries(
      required.filter((key) => !values[key] || values[key] === "--None--").map((key) => [key, "Complete this field."])
    );
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    // The grid renders in the user's preference zone, so the form must write in it too.
    const startAt = zonedTimeToUtc(
      String(values.startDate),
      values.allDay ? "00:00" : String(values.startTime),
      timeZone
    );
    const endAt = zonedTimeToUtc(String(values.endDate), values.allDay ? "23:59" : String(values.endTime), timeZone);
    if (endAt <= startAt) {
      setErrors(
        values.allDay
          ? { endDate: "End date must be on or after the start date." }
          : { endTime: "End must be after the start." }
      );
      return;
    }

    const rest = { ...values };
    delete rest.repeatFrequency;
    delete rest.repeatInterval;
    delete rest.repeatByDay;
    delete rest.repeatUntil;
    const payload: RecordData = {
      ...rest,
      nameRecordId: values.nameRecordId || null,
      relatedRecordId: values.relatedRecordId || null,
      calendarSourceId: values.calendarSourceId || null,
      reminderMinutes:
        values.reminderMinutes === "" || values.reminderMinutes === undefined ? null : Number(values.reminderMinutes),
      recurrenceRule,
      recurrenceEndAt:
        recurrenceRule && values.repeatUntil
          ? zonedTimeToUtc(String(values.repeatUntil), "23:59", timeZone).toISOString()
          : null,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString()
    };
    if (isEdit) {
      payload.recurrenceScope = scope;
      payload.occurrenceStart = occurrenceStart ?? null;
    }

    const ok = await onSave(payload, isEdit ? { id: String(record?.id) } : undefined);
    if (ok && stayOpen) {
      setValues(initialValues);
      setErrors({});
    }
  }

  if (discardDialog) return discardDialog;
  return (
    <BaseDialog
      open
      title={isEdit ? "Edit Event" : "New Event"}
      onClose={requestClose}
      onEnterAction={() => submit(false)}
      wide
      footer={
        <>
          <Button onClick={requestClose}>Cancel</Button>
          {isEdit && onDelete && record && (
            <Button
              onClick={() => onDelete(record, recurring ? scope : "all")}
              className="border-[#ea001e] text-[#ba0517] hover:bg-[#fff1f1]"
            >
              Delete
            </Button>
          )}
          <Button variant="primary" onClick={() => submit(false)}>
            Save
          </Button>
        </>
      }
    >
      {recurring && (
        <div className="mb-4 rounded border border-[#d8dde6] bg-[#f8f9fb] p-3">
          <div className="mb-2 text-xs font-semibold text-[#514f4d]">This event repeats. Apply your changes to:</div>
          <div className="flex flex-wrap gap-3 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="event-scope"
                className={checkboxClass}
                checked={scope === "single"}
                onChange={() => setScope("single")}
              />{" "}
              This occurrence
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="event-scope"
                className={checkboxClass}
                checked={scope === "all"}
                onChange={() => setScope("all")}
              />{" "}
              All occurrences
            </label>
          </div>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <FieldShell label="Subject" required error={errors.subject}>
          <NativeSelect
            options={["--None--", ...EVENT_SUBJECTS]}
            value={String(values.subject ?? "--None--")}
            onChange={(value) => setValues({ ...values, subject: value })}
          />
        </FieldShell>
        <FieldShell label="Description">
          <textarea
            className={inputClass}
            value={String(values.description ?? "")}
            onChange={(event) => setValues({ ...values, description: event.target.value })}
            onKeyDown={(event) => {
              if (event.ctrlKey && event.key === ".") {
                event.preventDefault();
                insertEventQuickText();
              }
            }}
            placeholder="Type Control + period to insert quick text."
          />
        </FieldShell>
        <div className="flex items-center gap-2 md:col-span-2">
          <RadixCheckbox
            id={allDayCheckboxId}
            checked={Boolean(values.allDay)}
            onCheckedChange={(value) => setValues({ ...values, allDay: Boolean(value) })}
          />
          <label
            htmlFor={allDayCheckboxId}
            className="cursor-pointer text-xs font-semibold text-[var(--control-label,#444)]"
          >
            All-day Event
          </label>
        </div>
        <FieldShell label="Start Date" required error={errors.startDate}>
          <input
            className={inputClass}
            type="date"
            value={String(values.startDate)}
            onChange={(event) => setValues({ ...values, startDate: event.target.value })}
          />
        </FieldShell>
        {!values.allDay && (
          <FieldShell label="Start Time" required error={errors.startTime}>
            <NativeSelect
              options={TIME_SLOTS}
              value={String(values.startTime)}
              onChange={(value) => setValues({ ...values, startTime: value })}
            />
          </FieldShell>
        )}
        <FieldShell label="End Date" required error={errors.endDate}>
          <input
            className={inputClass}
            type="date"
            value={String(values.endDate)}
            onChange={(event) => setValues({ ...values, endDate: event.target.value })}
          />
        </FieldShell>
        {!values.allDay && (
          <FieldShell label="End Time" required error={errors.endTime}>
            <NativeSelect
              options={TIME_SLOTS}
              value={String(values.endTime)}
              onChange={(value) => setValues({ ...values, endTime: value })}
            />
          </FieldShell>
        )}
        <FieldShell label="Attendees">
          <AttendeePicker
            field={attendeeField}
            value={attendeeIds}
            data={data}
            onChange={(next) => setValues({ ...values, attendeeIds: next })}
          />
        </FieldShell>
        <FieldShell label="Name">
          <div className="grid grid-cols-[120px_minmax(0,1fr)] items-end gap-2">
            <NativeSelect
              options={NAME_OBJECT_TYPES}
              value={String(values.nameObjectType ?? "Contacts")}
              onChange={(value) => setValues({ ...values, nameObjectType: value, nameRecordId: "" })}
            />
            <LookupField
              field={nameLookupField}
              value={String(values.nameRecordId ?? "")}
              data={data}
              inlineSelection
              onChange={(next) => setValues({ ...values, nameRecordId: next })}
            />
          </div>
        </FieldShell>
        <FieldShell label="Related To">
          <div className="grid grid-cols-[160px_minmax(0,1fr)] items-end gap-2">
            <NativeSelect
              options={RELATED_OBJECT_TYPES}
              value={String(values.relatedObjectType ?? "Accounts")}
              onChange={(value) => setValues({ ...values, relatedObjectType: value, relatedRecordId: "" })}
            />
            {relatedLookupField ? (
              <LookupField
                field={relatedLookupField}
                value={String(values.relatedRecordId ?? "")}
                data={data}
                inlineSelection
                onChange={(next) => setValues({ ...values, relatedRecordId: next })}
              />
            ) : (
              <input
                className={cn(inputClass, "opacity-70")}
                readOnly
                placeholder="No searchable records for this type"
                value=""
                aria-label="Related To search unavailable"
              />
            )}
          </div>
        </FieldShell>
        <FieldShell label="Assigned To" required error={errors.assignedToId}>
          <input className={inputClass} value={data.user.name} readOnly />
        </FieldShell>
        <FieldShell label="Calendar">
          <select
            className={inputClass}
            value={String(values.calendarSourceId ?? "")}
            onChange={(event) => setValues({ ...values, calendarSourceId: event.target.value })}
          >
            <option value="">{data.user.name} (default local calendar)</option>
            {data.calendarSources.map((source) => (
              <option key={requiredId(source)} value={requiredId(source)}>
                {String(source.name ?? "Calendar")}
              </option>
            ))}
          </select>
        </FieldShell>
        <FieldShell label="Location">
          <input
            className={inputClass}
            value={String(values.location ?? "")}
            onChange={(event) => setValues({ ...values, location: event.target.value })}
          />
        </FieldShell>
        <FieldShell label="Show Time As">
          <NativeSelect
            options={SHOW_TIME_AS}
            value={String(values.showTimeAs)}
            onChange={(value) => setValues({ ...values, showTimeAs: value })}
          />
        </FieldShell>
        <FieldShell label="Private">
          <RadixCheckbox
            checked={Boolean(values.private)}
            onCheckedChange={(value) => setValues({ ...values, private: Boolean(value) })}
          />
          <p className="mt-1 text-xs text-[#706e6b]">
            Private details remain visible to organization admins and users with View All Data.
          </p>
        </FieldShell>
        <FieldShell label="Notify me">
          <NativeSelect
            options={reminderOptions}
            value={reminderValue}
            onChange={(value) => setValues({ ...values, reminderMinutes: value })}
          />
          <p className={cn("mt-1 text-xs", data.emailDeliveryConfigured ? "text-[#706e6b]" : "text-[#8e6a00]")}>
            {data.emailDeliveryConfigured
              ? "Emails the Assigned To user and also creates an in-app notification."
              : "The in-app reminder will still work, but email requires SendGrid configuration before this reminder is due."}
          </p>
        </FieldShell>
        <FieldShell label="Repeat">
          <div className="grid gap-2">
            <NativeSelect
              options={REPEAT_OPTIONS.map((option) => option.label)}
              value={REPEAT_OPTIONS.find((option) => option.value === repeatFrequency)?.label ?? "Does not repeat"}
              onChange={(label) =>
                setValues({
                  ...values,
                  repeatFrequency: REPEAT_OPTIONS.find((option) => option.label === label)?.value ?? "None"
                })
              }
            />
            {repeatFrequency !== "None" && (
              <>
                <label className="flex items-center gap-2 text-sm">
                  Every
                  <input
                    className={cn(inputClass, "w-20")}
                    type="number"
                    min="1"
                    max="52"
                    value={String(values.repeatInterval ?? "1")}
                    onChange={(event) => setValues({ ...values, repeatInterval: event.target.value })}
                  />
                  {repeatFrequency === "DAILY"
                    ? "day(s)"
                    : repeatFrequency === "WEEKLY"
                      ? "week(s)"
                      : repeatFrequency === "MONTHLY"
                        ? "month(s)"
                        : "year(s)"}
                </label>
                {repeatFrequency === "WEEKLY" && (
                  <div className="flex flex-wrap gap-1">
                    {RECURRENCE_DAYS.map((day) => {
                      const selected = repeatByDay.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          aria-pressed={selected}
                          onClick={() =>
                            setValues({
                              ...values,
                              repeatByDay: selected
                                ? repeatByDay.filter((value) => value !== day)
                                : [...repeatByDay, day]
                            })
                          }
                          className={cn(
                            "h-8 w-9 rounded border border-[#c9c9c9] text-xs font-semibold",
                            selected
                              ? "border-brand-700 bg-brand-600 text-white"
                              : "bg-white text-[#514f4d] hover:bg-[#f3f3f3]"
                          )}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                )}
                <label className="block text-xs text-[#514f4d]">
                  Ends on
                  <input
                    className={inputClass}
                    type="date"
                    value={String(values.repeatUntil ?? "")}
                    onChange={(event) => setValues({ ...values, repeatUntil: event.target.value })}
                  />
                </label>
                {recurrenceSummary && <p className="text-xs text-[#706e6b]">{recurrenceSummary}</p>}
              </>
            )}
          </div>
        </FieldShell>
      </div>
    </BaseDialog>
  );
}
export const REPEAT_OPTIONS = [
  { label: "Does not repeat", value: "None" },
  { label: "Daily", value: "DAILY" },
  { label: "Weekly", value: "WEEKLY" },
  { label: "Monthly", value: "MONTHLY" },
  { label: "Yearly", value: "YEARLY" }
];
export function relatedPluralToCrmObject(plural: string): CrmObject | null {
  const match = (Object.keys(OBJECT_DEFINITIONS) as CrmObject[]).find(
    (object) => OBJECT_DEFINITIONS[object].plural === plural
  );
  return match ?? null;
}
export function eventQuickTextSnippet(data: ScopedCrmData) {
  const eventQuickText = data.quickTexts.find((item) => {
    const channels = Array.isArray(item.channels) ? item.channels.map(String) : [];
    return channels.includes("Event") || channels.includes("Email");
  });
  return String(eventQuickText?.message ?? "Thank you for your time. I will follow up with next steps.");
}
