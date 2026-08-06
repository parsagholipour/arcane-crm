"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { type FieldDefinition, type ScopedCrmData, type RecordData } from "@/lib/crm-types";
import { AsyncButton } from "@/components/crm/AsyncButton";
import { LookupField } from "@/features/crm/form-controls";
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

const accountLookupField: FieldDefinition = {
  name: "accountId",
  label: "Account",
  section: "Session Details",
  type: "lookup",
  lookupObject: "Account"
};
const contactLookupField: FieldDefinition = {
  name: "contactId",
  label: "Primary Contact",
  section: "Session Details",
  type: "lookup",
  lookupObject: "Contact"
};
const participantContactLookupField: FieldDefinition = {
  name: "participantContactId",
  label: "Participant Contact",
  section: "Participants",
  type: "lookup",
  lookupObject: "Contact"
};
const messagingParticipantRoles = ["Customer", "Agent", "Observer"];

function messagingParticipantRoleOptions(role: string) {
  return role && !messagingParticipantRoles.includes(role)
    ? [role, ...messagingParticipantRoles]
    : messagingParticipantRoles;
}

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
  const contacts = data.contacts.filter((contact) => !values.accountId || contact.accountId === values.accountId);
  const ownerUnavailable = Boolean(values.ownerId && !data.users.some((user) => user.id === values.ownerId));
  const unavailableOwnerLabel = text(initial?.ownerName) || values.ownerId;
  const initialAccount = initial?.account as RecordData | undefined;
  const initialContact = initial?.contact as RecordData | undefined;
  const selectedAccountLabel = text(initialAccount?.name ?? initial?.accountName);
  const selectedContactLabel = initialContact ? contactLabel(initialContact) : text(initial?.contactName);

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
  function selectAccount(accountId: string) {
    setValues((current) => ({
      ...current,
      accountId,
      contactId: data.contacts.some(
        (contact) =>
          requiredId(contact) === current.contactId && (!accountId || String(contact.accountId ?? "") === accountId)
      )
        ? current.contactId
        : ""
    }));
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
      onEnterAction={save}
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
              {ownerUnavailable && (
                <option value={values.ownerId} disabled>
                  {unavailableOwnerLabel} (Unavailable)
                </option>
              )}
              {data.users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Account">
            <LookupField
              field={accountLookupField}
              value={values.accountId}
              data={data}
              selectedLabel={selectedAccountLabel}
              inlineSelection
              onChange={selectAccount}
            />
          </Field>
          <Field label="Primary Contact">
            <LookupField
              field={contactLookupField}
              value={values.contactId}
              data={{ ...data, contacts }}
              selectedLabel={selectedContactLabel}
              inlineSelection
              onChange={(contactId) => setValues({ ...values, contactId })}
            />
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
                <LookupField
                  field={{ ...participantContactLookupField, label: `Participant ${index + 1} Contact` }}
                  value={participant.contactId}
                  data={data}
                  selectedLabel={
                    participant.contactId
                      ? `Contact: ${participant.name || participant.address || participant.contactId} (Unavailable)`
                      : ""
                  }
                  inlineSelection
                  onChange={(contactId) => selectContact(index, contactId)}
                />
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
                  aria-label={`Participant ${index + 1} Role`}
                  className={inputClass}
                  value={participant.role}
                  onChange={(event) => updateParticipant(index, { role: event.target.value })}
                >
                  {messagingParticipantRoleOptions(participant.role).map((value) => (
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
