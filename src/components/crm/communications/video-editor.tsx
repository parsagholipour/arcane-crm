"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { type ScopedCrmData, type RecordData } from "@/lib/crm-types";
import { cn } from "@/lib/utils";
import { AsyncButton } from "@/components/crm/AsyncButton";
import {
  type ParticipantDraft,
  text,
  type CommunicationsMutationResult,
  type Toast,
  toDateTimeInput,
  contactLabel,
  jsonRequest,
  requiredId,
  DialogShell,
  secondaryButton,
  primaryButton,
  Field,
  inputClass
} from "@/components/crm/communications/primitives";

export function initialVideoParticipants(record: RecordData | undefined): ParticipantDraft[] {
  const participants = Array.isArray(record?.participants) ? (record.participants as RecordData[]) : [];
  return participants.map((participant) => ({
    contactId: text(participant.contactId),
    userId: text(participant.userId),
    name: text(participant.name),
    email: text(participant.email),
    role: text(participant.role) || "Attendee"
  }));
}
export function VideoCallEditorModal({
  data,
  initial,
  onClose,
  onSaved,
  onToast
}: {
  data: ScopedCrmData;
  initial?: RecordData;
  onClose: () => void;
  onSaved: (result: CommunicationsMutationResult) => void;
  onToast: (toast: Toast) => void;
}) {
  const terminal = Boolean(initial && ["Completed", "Cancelled"].includes(text(initial.status)));
  const [values, setValues] = useState(() => ({
    name: text(initial?.name),
    description: text(initial?.description),
    provider: text(initial?.provider) || "External Link",
    meetingUrl: text(initial?.meetingUrl),
    scheduledStartAt: toDateTimeInput(initial?.scheduledStartAt, 60),
    scheduledEndAt: toDateTimeInput(initial?.scheduledEndAt, 120),
    accountId: text(initial?.accountId),
    contactId: text(initial?.contactId),
    opportunityId: text(initial?.opportunityId),
    organizerId: text(initial?.organizerId) || data.user.id,
    recordingUrl: text(initial?.recordingUrl),
    notes: text(initial?.notes),
    notifyParticipants: false
  }));
  const [participants, setParticipants] = useState<ParticipantDraft[]>(() => initialVideoParticipants(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const initialSnapshot = useMemo(() => JSON.stringify({ values, participants }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = JSON.stringify({ values, participants }) !== initialSnapshot;
  function requestClose() {
    if (!dirty || window.confirm("Discard unsaved video-call changes?")) onClose();
  }
  function updateParticipant(index: number, patch: Partial<ParticipantDraft>) {
    setParticipants((current) =>
      current.map((participant, itemIndex) => (itemIndex === index ? { ...participant, ...patch } : participant))
    );
  }
  function selectParticipant(index: number, key: "contactId" | "userId", id: string) {
    const source =
      key === "contactId" ? data.contacts.find((item) => item.id === id) : data.users.find((item) => item.id === id);
    updateParticipant(index, {
      contactId: key === "contactId" ? id : "",
      userId: key === "userId" ? id : "",
      name: source ? (key === "contactId" ? contactLabel(source as RecordData) : text(source.name)) : "",
      email: text(source?.email)
    });
  }
  async function save() {
    if (!terminal && !values.name.trim()) {
      setError("Video call name is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = await jsonRequest(initial?.id ? `/api/video-calls/${requiredId(initial)}` : "/api/video-calls", {
        method: initial?.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          terminal
            ? { notes: values.notes, recordingUrl: values.recordingUrl }
            : {
                ...values,
                scheduledStartAt: new Date(values.scheduledStartAt).toISOString(),
                scheduledEndAt: new Date(values.scheduledEndAt).toISOString(),
                participants
              }
        )
      });
      onSaved({
        videoCall: payload.videoCall as RecordData,
        notifications: payload.notifications as RecordData[] | undefined
      });
      onToast({
        tone: "success",
        message: terminal
          ? "Video call notes updated."
          : initial?.id
            ? "Video call updated."
            : payload.invitation
              ? "Video call scheduled and invitations accepted for delivery."
              : "Video call scheduled."
      });
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save video call.");
    } finally {
      setSaving(false);
    }
  }
  if (terminal)
    return (
      <DialogShell
        title={`Update ${text(initial?.name)}`}
        onClose={requestClose}
        footer={
          <>
            <button className={secondaryButton} onClick={requestClose}>
              Cancel
            </button>
            <AsyncButton className={primaryButton} onClick={() => save()} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </AsyncButton>
          </>
        }
      >
        <div className="space-y-4">
          {error && (
            <div className="rounded border border-[#ea001e] bg-[#fff1f1] p-2 text-sm text-[#8e030f]">{error}</div>
          )}
          <div className="rounded border border-[#d8dde6] bg-[#f8f9fb] p-3 text-sm text-[#514f4d]">
            Completed and cancelled calls keep their schedule and participants immutable. You can add a recording link
            or update notes.
          </div>
          <Field label="Recording URL">
            <input
              type="url"
              className={inputClass}
              placeholder="https://…"
              value={values.recordingUrl}
              onChange={(event) => setValues({ ...values, recordingUrl: event.target.value })}
            />
          </Field>
          <Field label="Notes">
            <textarea
              className={cn(inputClass, "min-h-28")}
              value={values.notes}
              onChange={(event) => setValues({ ...values, notes: event.target.value })}
            />
          </Field>
        </div>
      </DialogShell>
    );
  return (
    <DialogShell
      title={initial ? `Edit ${text(initial.name)}` : "New Video Call"}
      onClose={requestClose}
      wide
      footer={
        <>
          <button className={secondaryButton} onClick={requestClose}>
            Cancel
          </button>
          <AsyncButton className={primaryButton} onClick={() => save()} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </AsyncButton>
        </>
      }
    >
      <div className="space-y-5">
        {error && (
          <div className="rounded border border-[#ea001e] bg-[#fff1f1] p-2 text-sm text-[#8e030f]">{error}</div>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Video Call Name" required>
            <input
              className={inputClass}
              value={values.name}
              onChange={(event) => setValues({ ...values, name: event.target.value })}
            />
          </Field>
          <Field label="Provider">
            <select
              className={inputClass}
              value={values.provider}
              onChange={(event) => setValues({ ...values, provider: event.target.value })}
            >
              {["External Link", "Zoom", "Google Meet", "Microsoft Teams", "Other"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </Field>
          <Field label="Start" required>
            <input
              type="datetime-local"
              className={inputClass}
              value={values.scheduledStartAt}
              onChange={(event) => setValues({ ...values, scheduledStartAt: event.target.value })}
            />
          </Field>
          <Field label="End" required>
            <input
              type="datetime-local"
              className={inputClass}
              value={values.scheduledEndAt}
              onChange={(event) => setValues({ ...values, scheduledEndAt: event.target.value })}
            />
          </Field>
          <Field label="Meeting URL">
            <input
              type="url"
              className={inputClass}
              placeholder="https://…"
              value={values.meetingUrl}
              onChange={(event) => setValues({ ...values, meetingUrl: event.target.value })}
            />
          </Field>
          <Field label="Organizer">
            <select
              className={inputClass}
              value={values.organizerId}
              onChange={(event) => setValues({ ...values, organizerId: event.target.value })}
            >
              {data.users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Account">
            <select
              className={inputClass}
              value={values.accountId}
              onChange={(event) => setValues({ ...values, accountId: event.target.value })}
            >
              <option value="">No account</option>
              {data.accounts.map((account) => (
                <option key={requiredId(account)} value={requiredId(account)}>
                  {text(account.name)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Contact">
            <select
              className={inputClass}
              value={values.contactId}
              onChange={(event) => setValues({ ...values, contactId: event.target.value })}
            >
              <option value="">No contact</option>
              {data.contacts
                .filter((contact) => !values.accountId || contact.accountId === values.accountId)
                .map((contact) => (
                  <option key={requiredId(contact)} value={requiredId(contact)}>
                    {contactLabel(contact)}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Opportunity">
            <select
              className={inputClass}
              value={values.opportunityId}
              onChange={(event) => setValues({ ...values, opportunityId: event.target.value })}
            >
              <option value="">No opportunity</option>
              {data.opportunities
                .filter((opportunity) => !values.accountId || opportunity.accountId === values.accountId)
                .map((opportunity) => (
                  <option key={requiredId(opportunity)} value={requiredId(opportunity)}>
                    {text(opportunity.name)}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Recording URL">
            <input
              type="url"
              className={inputClass}
              placeholder="https://…"
              value={values.recordingUrl}
              onChange={(event) => setValues({ ...values, recordingUrl: event.target.value })}
            />
          </Field>
          <div className="md:col-span-2">
            <Field label="Description">
              <textarea
                className={cn(inputClass, "min-h-20")}
                value={values.description}
                onChange={(event) => setValues({ ...values, description: event.target.value })}
              />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Notes">
              <textarea
                className={cn(inputClass, "min-h-20")}
                value={values.notes}
                onChange={(event) => setValues({ ...values, notes: event.target.value })}
              />
            </Field>
          </div>
        </div>
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold">Participants</h3>
            <button
              className={secondaryButton}
              onClick={() =>
                setParticipants((current) => [
                  ...current,
                  { contactId: "", userId: "", name: "", email: "", role: "Attendee" }
                ])
              }
            >
              <Plus size={13} /> Add Participant
            </button>
          </div>
          <div className="space-y-2">
            {participants.map((participant, index) => (
              <div
                key={index}
                className="grid gap-2 rounded border border-[#d8dde6] p-3 md:grid-cols-[1fr_1fr_1fr_120px_auto]"
              >
                <select
                  className={inputClass}
                  value={
                    participant.contactId
                      ? `contact:${participant.contactId}`
                      : participant.userId
                        ? `user:${participant.userId}`
                        : ""
                  }
                  onChange={(event) => {
                    const [kind, id] = event.target.value.split(":");
                    selectParticipant(index, kind === "user" ? "userId" : "contactId", id || "");
                  }}
                >
                  <option value="">Custom participant</option>
                  <optgroup label="Contacts">
                    {data.contacts.map((contact) => (
                      <option key={requiredId(contact)} value={`contact:${requiredId(contact)}`}>
                        {contactLabel(contact)}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Users">
                    {data.users.map((user) => (
                      <option key={user.id} value={`user:${user.id}`}>
                        {user.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
                <input
                  className={inputClass}
                  placeholder="Name"
                  value={participant.name}
                  onChange={(event) => updateParticipant(index, { name: event.target.value })}
                />
                <input
                  className={inputClass}
                  placeholder="Email"
                  value={participant.email || ""}
                  onChange={(event) => updateParticipant(index, { email: event.target.value })}
                />
                <select
                  className={inputClass}
                  value={participant.role}
                  onChange={(event) => updateParticipant(index, { role: event.target.value })}
                >
                  {["Host", "Presenter", "Attendee", "Observer"].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
                <button
                  className={secondaryButton}
                  onClick={() => setParticipants((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
          {!initial && (
            <label className="mt-3 flex items-start gap-2 rounded border border-[#d8dde6] p-3 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={values.notifyParticipants}
                onChange={(event) => setValues({ ...values, notifyParticipants: event.target.checked })}
              />
              <span>
                <span className="block font-semibold">Email invitations through configured SendGrid</span>
                <span className="text-xs text-[#706e6b]">
                  If delivery is not configured or no participant has a valid email, creation is rejected. Saving
                  without this option only records the call.
                </span>
              </span>
            </label>
          )}
        </section>
      </div>
    </DialogShell>
  );
}
