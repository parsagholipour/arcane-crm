"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { type ScopedCrmData, type RecordData } from "@/lib/crm-types";
import { AsyncButton } from "@/components/crm/AsyncButton";
import {
  type ParticipantDraft,
  text,
  type CommunicationsMutationResult,
  type Toast,
  contactLabel,
  jsonRequest,
  requiredId,
  DialogShell,
  secondaryButton,
  primaryButton,
  Field,
  inputClass
} from "@/components/crm/communications/primitives";

export function initialMessagingParticipants(record: RecordData | undefined): ParticipantDraft[] {
  const participants = Array.isArray(record?.participants) ? (record.participants as RecordData[]) : [];
  return participants.map((participant) => ({
    contactId: text(participant.contactId),
    name: text(participant.name),
    address: text(participant.address),
    role: text(participant.role) || "Customer"
  }));
}
export function MessagingSessionEditorModal({
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
  const [values, setValues] = useState(() => ({
    name: text(initial?.name),
    subject: text(initial?.subject),
    channel: text(initial?.channel) || "Web Chat",
    ownerId: text(initial?.ownerId) || data.user.id,
    accountId: text(initial?.accountId),
    contactId: text(initial?.contactId),
    externalId: text(initial?.externalId)
  }));
  const [participants, setParticipants] = useState<ParticipantDraft[]>(() => initialMessagingParticipants(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const initialSnapshot = useMemo(() => JSON.stringify({ values, participants }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = JSON.stringify({ values, participants }) !== initialSnapshot;

  function requestClose() {
    if (!dirty || window.confirm("Discard unsaved messaging-session changes?")) onClose();
  }
  function updateParticipant(index: number, patch: Partial<ParticipantDraft>) {
    setParticipants((current) =>
      current.map((participant, itemIndex) => (itemIndex === index ? { ...participant, ...patch } : participant))
    );
  }
  function selectContact(index: number, contactId: string) {
    const contact = data.contacts.find((item) => item.id === contactId);
    updateParticipant(index, { contactId, name: contact ? contactLabel(contact) : "", address: text(contact?.email) });
  }
  async function save() {
    if (!values.name.trim()) {
      setError("Messaging session name is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = await jsonRequest(
        initial?.id ? `/api/messaging-sessions/${requiredId(initial)}` : "/api/messaging-sessions",
        {
          method: initial?.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...values, participants })
        }
      );
      onSaved({
        session: payload.session as RecordData,
        notifications: payload.notifications as RecordData[] | undefined
      });
      onToast({ tone: "success", message: initial?.id ? "Messaging session updated." : "Messaging session created." });
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save messaging session.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogShell
      title={initial ? `Edit ${text(initial.name)}` : "New Messaging Session"}
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
          <div className="rounded border border-[#ea001e] bg-[#fff1f1] px-3 py-2 text-sm text-[#8e030f]">{error}</div>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Session Name" required>
            <input
              className={inputClass}
              value={values.name}
              onChange={(event) => setValues({ ...values, name: event.target.value })}
            />
          </Field>
          <Field label="Channel">
            <select
              className={inputClass}
              value={values.channel}
              onChange={(event) => setValues({ ...values, channel: event.target.value })}
            >
              {["Web Chat", "Email", "SMS", "WhatsApp", "Social", "Other"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </Field>
          <Field label="Subject">
            <input
              className={inputClass}
              value={values.subject}
              onChange={(event) => setValues({ ...values, subject: event.target.value })}
            />
          </Field>
          <Field label="Owner">
            <select
              className={inputClass}
              value={values.ownerId}
              onChange={(event) => setValues({ ...values, ownerId: event.target.value })}
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
          <Field label="Primary Contact">
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
          <Field label="External Conversation ID">
            <input
              className={inputClass}
              value={values.externalId}
              onChange={(event) => setValues({ ...values, externalId: event.target.value })}
            />
          </Field>
        </div>
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold">Participants</h3>
            <button
              className={secondaryButton}
              onClick={() =>
                setParticipants((current) => [...current, { contactId: "", name: "", address: "", role: "Customer" }])
              }
            >
              <Plus size={13} /> Add Participant
            </button>
          </div>
          <div className="space-y-2">
            {participants.map((participant, index) => (
              <div
                key={index}
                className="grid gap-2 rounded border border-[#d8dde6] p-3 md:grid-cols-[1.2fr_1fr_1fr_130px_auto]"
              >
                <select
                  className={inputClass}
                  value={participant.contactId}
                  onChange={(event) => selectContact(index, event.target.value)}
                >
                  <option value="">Custom participant</option>
                  {data.contacts.map((contact) => (
                    <option key={requiredId(contact)} value={requiredId(contact)}>
                      {contactLabel(contact)}
                    </option>
                  ))}
                </select>
                <input
                  className={inputClass}
                  placeholder="Name"
                  value={participant.name}
                  onChange={(event) => updateParticipant(index, { name: event.target.value })}
                />
                <input
                  className={inputClass}
                  placeholder="Email / address"
                  value={participant.address || ""}
                  onChange={(event) => updateParticipant(index, { address: event.target.value })}
                />
                <select
                  className={inputClass}
                  value={participant.role}
                  onChange={(event) => updateParticipant(index, { role: event.target.value })}
                >
                  {["Customer", "Agent", "Observer"].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
                <button
                  className={secondaryButton}
                  onClick={() => setParticipants((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  aria-label="Remove participant"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            {!participants.length && (
              <div className="rounded border border-dashed border-[#d8dde6] p-4 text-sm text-[#706e6b]">
                Participants are optional; add contacts or external conversation identities when available.
              </div>
            )}
          </div>
        </section>
      </div>
    </DialogShell>
  );
}
