"use client";

import { MessageSquareText, Plus, RotateCcw, Square, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { type ScopedCrmData, type RecordData } from "@/lib/crm-types";
import { cn, formatDateTime } from "@/lib/utils";
import { AsyncButton } from "@/components/crm/AsyncButton";
import {
  type CommunicationsMutationResult,
  toDateTimeInput,
  jsonRequest,
  requiredId,
  DialogShell,
  secondaryButton,
  primaryButton,
  Field,
  inputClass,
  type Toast,
  text,
  CommunicationsStatusBadge,
  dangerButton,
  WorkspaceCard,
  Detail,
  DetailLink,
  contactLabel
} from "@/components/crm/communications/primitives";

export function MessageModal({
  session,
  capabilities,
  onClose,
  onSaved
}: {
  session: RecordData;
  capabilities: { emailDelivery: boolean };
  onClose: () => void;
  onSaved: (result: CommunicationsMutationResult) => void;
}) {
  const [direction, setDirection] = useState("Inbound");
  const [body, setBody] = useState("");
  const [senderName, setSenderName] = useState("");
  const [sentAt, setSentAt] = useState(toDateTimeInput(new Date()));
  const [deliver, setDeliver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const canDeliver = capabilities.emailDelivery && session.channel === "Email" && direction === "Outbound";
  async function save() {
    setSaving(true);
    setError("");
    try {
      const payload = await jsonRequest(`/api/messaging-sessions/${requiredId(session)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          direction,
          body,
          senderName,
          sentAt: new Date(sentAt).toISOString(),
          deliver: canDeliver && deliver
        })
      });
      const messages = [
        ...(Array.isArray(session.messages) ? (session.messages as RecordData[]) : []),
        payload.message as RecordData
      ];
      onSaved({
        session: { ...session, messages, lastMessageAt: (payload.message as RecordData).sentAt },
        notifications: payload.notifications as RecordData[] | undefined
      });
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to record message.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <DialogShell
      title="Record Message"
      onClose={onClose}
      onEnterAction={canDeliver && deliver ? undefined : save}
      footer={
        <>
          <button className={secondaryButton} onClick={onClose}>
            Cancel
          </button>
          <AsyncButton className={primaryButton} onClick={() => save()} disabled={saving}>
            {saving ? "Saving…" : canDeliver && deliver ? "Send Email & Record" : "Record Message"}
          </AsyncButton>
        </>
      }
    >
      <div className="space-y-3">
        {error && (
          <div className="rounded border border-[#ea001e] bg-[#fff1f1] p-2 text-sm text-[#8e030f]">{error}</div>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Direction">
            <select
              className={inputClass}
              value={direction}
              onChange={(event) => {
                setDirection(event.target.value);
                setDeliver(false);
              }}
            >
              {["Inbound", "Outbound", "System"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </Field>
          <Field label="Message Date">
            <input
              type="datetime-local"
              className={inputClass}
              value={sentAt}
              onChange={(event) => setSentAt(event.target.value)}
            />
          </Field>
        </div>
        <Field label="Sender Name">
          <input className={inputClass} value={senderName} onChange={(event) => setSenderName(event.target.value)} />
        </Field>
        <Field label="Message" required>
          <textarea
            className={cn(inputClass, "min-h-32")}
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
        </Field>
        {session.channel === "Email" && direction === "Outbound" && (
          <label className="flex items-start gap-2 rounded border border-[#d8dde6] p-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={deliver}
              disabled={!capabilities.emailDelivery}
              onChange={(event) => setDeliver(event.target.checked)}
            />
            <span>
              <span className="block font-semibold">Deliver through configured SendGrid account</span>
              <span className="text-xs text-[#706e6b]">
                {capabilities.emailDelivery
                  ? "When unchecked, this only records an externally sent message."
                  : "SendGrid is not configured. This message can only be recorded."}
              </span>
            </span>
          </label>
        )}
        {!(session.channel === "Email" && direction === "Outbound") && (
          <div className="rounded bg-[#f3f3f3] p-3 text-xs text-[#706e6b]">
            Recording a message does not contact the participant or claim external delivery.
          </div>
        )}
      </div>
    </DialogShell>
  );
}
export function MessagingSessionDetailPage({
  initial,
  data,
  onEdit,
  onChanged,
  onDeleted,
  onToast
}: {
  initial: RecordData;
  data: ScopedCrmData;
  onEdit: () => void;
  onChanged: (result: CommunicationsMutationResult) => void;
  onDeleted: (id: string) => void;
  onToast: (toast: Toast) => void;
}) {
  const [session, setSession] = useState(initial);
  const [capabilities, setCapabilities] = useState({ emailDelivery: false });
  const [messageOpen, setMessageOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    void jsonRequest(`/api/messaging-sessions/${requiredId(initial)}`)
      .then((payload) => {
        setSession(payload.session as RecordData);
        setCapabilities(payload.capabilities as { emailDelivery: boolean });
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load session."));
  }, [initial]);
  const participants = Array.isArray(session.participants) ? (session.participants as RecordData[]) : [];
  const messages = Array.isArray(session.messages) ? (session.messages as RecordData[]) : [];
  function apply(result: CommunicationsMutationResult) {
    if (result.session) setSession(result.session);
    onChanged(result);
  }
  async function action(actionName: string) {
    try {
      const payload = await jsonRequest(`/api/messaging-sessions/${requiredId(session)}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionName })
      });
      apply({
        session: payload.session as RecordData,
        notifications: payload.notifications as RecordData[] | undefined
      });
      onToast({
        tone: "success",
        message: `Messaging session is now ${text((payload.session as RecordData).status)}.`
      });
    } catch (actionError) {
      onToast({
        tone: "error",
        message: actionError instanceof Error ? actionError.message : "Unable to update session."
      });
    }
  }
  async function remove() {
    try {
      await jsonRequest(`/api/messaging-sessions/${requiredId(session)}`, { method: "DELETE" });
      onDeleted(requiredId(session));
    } catch (deleteError) {
      setConfirmDelete(false);
      onToast({
        tone: "error",
        message: deleteError instanceof Error ? deleteError.message : "Unable to delete session."
      });
    }
  }
  return (
    <section className="space-y-3">
      <div className="rounded-lg border border-[#e4e7ec] bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex gap-3">
            <MessageSquareText className="text-brand-600" />
            <div>
              <div className="text-xs text-[#706e6b]">Messaging Session</div>
              <h1 className="text-2xl font-semibold">{text(session.name)}</h1>
              <div className="mt-2">
                <CommunicationsStatusBadge status={session.status} />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {session.status !== "Closed" && (
              <button className={secondaryButton} onClick={onEdit}>
                Edit
              </button>
            )}
            {session.status === "Open" && (
              <button className={secondaryButton} onClick={() => void action("wait")}>
                Mark Waiting
              </button>
            )}
            {session.status === "Waiting" && (
              <button className={secondaryButton} onClick={() => void action("resume")}>
                Resume
              </button>
            )}
            {session.status !== "Closed" && (
              <button className={secondaryButton} onClick={() => void action("close")}>
                <Square size={13} /> Close
              </button>
            )}
            {session.status === "Closed" && (
              <button className={secondaryButton} onClick={() => void action("reopen")}>
                <RotateCcw size={13} /> Reopen
              </button>
            )}
            {session.status !== "Closed" && (
              <button className={primaryButton} onClick={() => setMessageOpen(true)}>
                <Plus size={13} /> Record Message
              </button>
            )}
            {session.status === "Open" && messages.length === 0 && (
              <button className={dangerButton} onClick={() => setConfirmDelete(true)}>
                <Trash2 size={13} /> Delete
              </button>
            )}
          </div>
        </div>
        {error && (
          <div className="mt-3 rounded border border-[#ea001e] bg-[#fff1f1] p-2 text-sm text-[#8e030f]">{error}</div>
        )}
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <WorkspaceCard title="Session Details">
          <dl className="space-y-3 text-sm">
            <Detail label="Channel" value={session.channel} />
            <Detail label="Subject" value={session.subject} />
            <Detail
              label="Owner"
              value={data.users.find((user) => user.id === session.ownerId)?.name || session.ownerId}
            />
            <Detail label="Started" value={session.startedAt ? formatDateTime(text(session.startedAt)) : "-"} />
            <Detail label="Ended" value={session.endedAt ? formatDateTime(text(session.endedAt)) : "-"} />
          </dl>
        </WorkspaceCard>
        <WorkspaceCard title="Related Records">
          <dl className="space-y-3 text-sm">
            <DetailLink
              label="Account"
              value={text((session.account as RecordData | undefined)?.name)}
              href={session.accountId ? `/lightning/r/Account/${text(session.accountId)}/view` : ""}
            />
            <DetailLink
              label="Contact"
              value={session.contact ? contactLabel(session.contact as RecordData) : ""}
              href={session.contactId ? `/lightning/r/Contact/${text(session.contactId)}/view` : ""}
            />
            <Detail label="External ID" value={session.externalId} />
          </dl>
        </WorkspaceCard>
        <WorkspaceCard title={`Participants (${participants.length})`}>
          <div className="space-y-2">
            {participants.map((participant) => (
              <div key={requiredId(participant)} className="rounded border border-[#eef1f6] p-2 text-sm">
                <div className="font-semibold">{text(participant.name)}</div>
                <div className="text-xs text-[#706e6b]">
                  {text(participant.role)}
                  {participant.address ? ` · ${text(participant.address)}` : ""}
                </div>
              </div>
            ))}
            {!participants.length && <div className="text-sm text-[#706e6b]">No participants recorded.</div>}
          </div>
        </WorkspaceCard>
      </div>
      <WorkspaceCard title={`Conversation (${messages.length})`}>
        <div className="space-y-3">
          {messages.map((message) => (
            <div
              key={requiredId(message)}
              className={cn(
                "max-w-3xl rounded-lg border p-3",
                message.direction === "Outbound"
                  ? "ml-auto border-brand-200 bg-brand-50"
                  : message.direction === "Inbound"
                    ? "border-[#d8dde6] bg-white"
                    : "mx-auto bg-[#f3f3f3]"
              )}
            >
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold">{text(message.senderName) || text(message.direction)}</span>
                <span className="text-[#706e6b]">
                  {formatDateTime(text(message.sentAt))} · {text(message.status)}
                </span>
              </div>
              <div className="whitespace-pre-wrap text-sm">{text(message.body)}</div>
            </div>
          ))}
          {!messages.length && (
            <div className="rounded border border-dashed border-[#d8dde6] p-5 text-center text-sm text-[#706e6b]">
              No messages yet. Record inbound or externally exchanged messages to build the transcript.
            </div>
          )}
        </div>
      </WorkspaceCard>
      {messageOpen && (
        <MessageModal
          session={session}
          capabilities={capabilities}
          onClose={() => setMessageOpen(false)}
          onSaved={(result) => {
            apply(result);
            onToast({ tone: "success", message: "Message recorded." });
          }}
        />
      )}
      {confirmDelete && (
        <DialogShell
          title={`Delete ${text(session.name)}?`}
          onClose={() => setConfirmDelete(false)}
          footer={
            <>
              <button className={secondaryButton} onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
              <AsyncButton className={dangerButton} onClick={() => remove()}>
                Delete
              </AsyncButton>
            </>
          }
        >
          <p className="text-sm text-[#706e6b]">Only an empty Open session can be deleted. This cannot be undone.</p>
        </DialogShell>
      )}
    </section>
  );
}
