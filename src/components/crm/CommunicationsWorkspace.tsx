"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { CheckCircle2, ExternalLink, MessageSquareText, Play, Plus, RotateCcw, Square, Trash2, Video, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { BootstrapData, RecordData } from "@/lib/crm-types";
import { cn, formatDateTime } from "@/lib/utils";

export type CommunicationsMutationResult = {
  session?: RecordData;
  videoCall?: RecordData;
  notifications?: RecordData[];
};

type Toast = { tone: "success" | "error" | "warning"; message: string } | null;
type ParticipantDraft = { contactId: string; userId?: string; name: string; address?: string; email?: string; role: string };

const inputClass = "min-h-9 w-full rounded border border-[#c9c9c9] bg-white px-3 py-2 text-sm outline-none focus:border-[#0176d3] focus:ring-2 focus:ring-[#0176d3]/20 disabled:bg-[#f3f3f3]";
const secondaryButton = "inline-flex min-h-8 items-center justify-center gap-1 rounded border border-[#c9c9c9] bg-white px-3 py-1 text-xs font-semibold text-brand-700 hover:bg-[#f3f3f3] disabled:cursor-not-allowed disabled:opacity-50";
const primaryButton = "inline-flex min-h-8 items-center justify-center gap-1 rounded border border-brand-700 bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50";
const dangerButton = "inline-flex min-h-8 items-center justify-center gap-1 rounded border border-[#ba0517] bg-[#ba0517] px-3 py-1 text-xs font-semibold text-white hover:bg-[#8e030f] disabled:cursor-not-allowed disabled:opacity-50";

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function requiredId(record: RecordData) {
  return text(record.id);
}

function contactLabel(contact: RecordData) {
  return [contact.firstName, contact.lastName].filter(Boolean).join(" ") || text(contact.name || contact.id);
}

function toDateTimeInput(value: unknown, fallbackMinutes = 0) {
  const date = value ? new Date(text(value)) : new Date(Date.now() + fallbackMinutes * 60_000);
  if (!Number.isFinite(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

async function jsonRequest(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(text(payload.error) || "The request could not be completed.");
  return payload as Record<string, unknown>;
}

function DialogShell({ title, children, footer, onClose, wide = false }: { title: string; children: ReactNode; footer: ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/40" />
        <Dialog.Content className={cn("fixed left-1/2 top-1/2 z-[100] max-h-[90vh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg bg-white shadow-2xl", wide ? "max-w-5xl" : "max-w-2xl")}>
          <div className="flex items-center justify-between border-b border-[#d8dde6] px-5 py-3">
            <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
            <button className="rounded p-1 hover:bg-[#f3f3f3]" onClick={onClose} aria-label="Close"><X size={18} /></button>
          </div>
          <div className="max-h-[calc(90vh-120px)] overflow-auto p-5">{children}</div>
          <div className="flex justify-end gap-2 border-t border-[#d8dde6] bg-[#f8f9fb] px-5 py-3">{footer}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return <label className="block text-sm"><span className="mb-1 block text-xs font-semibold text-[#444]">{required && <span className="mr-1 text-[#ba0517]">*</span>}{label}</span>{children}</label>;
}

function WorkspaceCard({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-lg border border-[#e4e7ec] bg-white shadow-card"><div className="border-b border-[#d8dde6] px-4 py-3 font-semibold">{title}</div><div className="p-4">{children}</div></section>;
}

export function CommunicationsStatusBadge({ status }: { status: unknown }) {
  const value = text(status) || "Unknown";
  const tone = ["Open", "In Progress"].includes(value) ? "bg-[#e4f6e6] text-[#194f25]" : value === "Waiting" || value === "Scheduled" ? "bg-[#fff7e8] text-[#5f4b00]" : value === "Closed" || value === "Completed" ? "bg-brand-50 text-brand-900" : "bg-[#f3f3f3] text-[#514f4d]";
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", tone)}><span className="sr-only">Status: </span>{value}</span>;
}

function initialMessagingParticipants(record: RecordData | undefined): ParticipantDraft[] {
  const participants = Array.isArray(record?.participants) ? record.participants as RecordData[] : [];
  return participants.map((participant) => ({ contactId: text(participant.contactId), name: text(participant.name), address: text(participant.address), role: text(participant.role) || "Customer" }));
}

export function MessagingSessionEditorModal({ data, initial, onClose, onSaved, onToast }: { data: BootstrapData; initial?: RecordData; onClose: () => void; onSaved: (result: CommunicationsMutationResult) => void; onToast: (toast: Toast) => void }) {
  const [values, setValues] = useState(() => ({
    name: text(initial?.name), subject: text(initial?.subject), channel: text(initial?.channel) || "Web Chat", ownerId: text(initial?.ownerId) || data.user.id,
    accountId: text(initial?.accountId), contactId: text(initial?.contactId), externalId: text(initial?.externalId)
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
    setParticipants((current) => current.map((participant, itemIndex) => itemIndex === index ? { ...participant, ...patch } : participant));
  }
  function selectContact(index: number, contactId: string) {
    const contact = data.contacts.find((item) => item.id === contactId);
    updateParticipant(index, { contactId, name: contact ? contactLabel(contact) : "", address: text(contact?.email) });
  }
  async function save() {
    if (!values.name.trim()) { setError("Messaging session name is required."); return; }
    setSaving(true); setError("");
    try {
      const payload = await jsonRequest(initial?.id ? `/api/messaging-sessions/${requiredId(initial)}` : "/api/messaging-sessions", {
        method: initial?.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...values, participants })
      });
      onSaved({ session: payload.session as RecordData, notifications: payload.notifications as RecordData[] | undefined });
      onToast({ tone: "success", message: initial?.id ? "Messaging session updated." : "Messaging session created." });
      onClose();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Unable to save messaging session."); }
    finally { setSaving(false); }
  }

  return (
    <DialogShell title={initial ? `Edit ${text(initial.name)}` : "New Messaging Session"} onClose={requestClose} wide footer={<><button className={secondaryButton} onClick={requestClose}>Cancel</button><button className={primaryButton} onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save"}</button></>}>
      <div className="space-y-5">
        {error && <div className="rounded border border-[#ea001e] bg-[#fff1f1] px-3 py-2 text-sm text-[#8e030f]">{error}</div>}
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Session Name" required><input className={inputClass} value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} /></Field>
          <Field label="Channel"><select className={inputClass} value={values.channel} onChange={(event) => setValues({ ...values, channel: event.target.value })}>{["Web Chat", "Email", "SMS", "WhatsApp", "Social", "Other"].map((value) => <option key={value}>{value}</option>)}</select></Field>
          <Field label="Subject"><input className={inputClass} value={values.subject} onChange={(event) => setValues({ ...values, subject: event.target.value })} /></Field>
          <Field label="Owner"><select className={inputClass} value={values.ownerId} onChange={(event) => setValues({ ...values, ownerId: event.target.value })}>{data.users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></Field>
          <Field label="Account"><select className={inputClass} value={values.accountId} onChange={(event) => setValues({ ...values, accountId: event.target.value })}><option value="">No account</option>{data.accounts.map((account) => <option key={requiredId(account)} value={requiredId(account)}>{text(account.name)}</option>)}</select></Field>
          <Field label="Primary Contact"><select className={inputClass} value={values.contactId} onChange={(event) => setValues({ ...values, contactId: event.target.value })}><option value="">No contact</option>{data.contacts.filter((contact) => !values.accountId || contact.accountId === values.accountId).map((contact) => <option key={requiredId(contact)} value={requiredId(contact)}>{contactLabel(contact)}</option>)}</select></Field>
          <Field label="External Conversation ID"><input className={inputClass} value={values.externalId} onChange={(event) => setValues({ ...values, externalId: event.target.value })} /></Field>
        </div>
        <section>
          <div className="mb-2 flex items-center justify-between"><h3 className="font-semibold">Participants</h3><button className={secondaryButton} onClick={() => setParticipants((current) => [...current, { contactId: "", name: "", address: "", role: "Customer" }])}><Plus size={13} /> Add Participant</button></div>
          <div className="space-y-2">
            {participants.map((participant, index) => <div key={index} className="grid gap-2 rounded border border-[#d8dde6] p-3 md:grid-cols-[1.2fr_1fr_1fr_130px_auto]">
              <select className={inputClass} value={participant.contactId} onChange={(event) => selectContact(index, event.target.value)}><option value="">Custom participant</option>{data.contacts.map((contact) => <option key={requiredId(contact)} value={requiredId(contact)}>{contactLabel(contact)}</option>)}</select>
              <input className={inputClass} placeholder="Name" value={participant.name} onChange={(event) => updateParticipant(index, { name: event.target.value })} />
              <input className={inputClass} placeholder="Email / address" value={participant.address || ""} onChange={(event) => updateParticipant(index, { address: event.target.value })} />
              <select className={inputClass} value={participant.role} onChange={(event) => updateParticipant(index, { role: event.target.value })}>{["Customer", "Agent", "Observer"].map((value) => <option key={value}>{value}</option>)}</select>
              <button className={secondaryButton} onClick={() => setParticipants((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remove participant"><Trash2 size={13} /></button>
            </div>)}
            {!participants.length && <div className="rounded border border-dashed border-[#d8dde6] p-4 text-sm text-[#706e6b]">Participants are optional; add contacts or external conversation identities when available.</div>}
          </div>
        </section>
      </div>
    </DialogShell>
  );
}

function MessageModal({ session, capabilities, onClose, onSaved }: { session: RecordData; capabilities: { emailDelivery: boolean }; onClose: () => void; onSaved: (result: CommunicationsMutationResult) => void }) {
  const [direction, setDirection] = useState("Inbound");
  const [body, setBody] = useState("");
  const [senderName, setSenderName] = useState("");
  const [sentAt, setSentAt] = useState(toDateTimeInput(new Date()));
  const [deliver, setDeliver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const canDeliver = capabilities.emailDelivery && session.channel === "Email" && direction === "Outbound";
  async function save() {
    setSaving(true); setError("");
    try {
      const payload = await jsonRequest(`/api/messaging-sessions/${requiredId(session)}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ direction, body, senderName, sentAt: new Date(sentAt).toISOString(), deliver: canDeliver && deliver }) });
      const messages = [...(Array.isArray(session.messages) ? session.messages as RecordData[] : []), payload.message as RecordData];
      onSaved({ session: { ...session, messages, lastMessageAt: (payload.message as RecordData).sentAt }, notifications: payload.notifications as RecordData[] | undefined });
      onClose();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Unable to record message."); }
    finally { setSaving(false); }
  }
  return <DialogShell title="Record Message" onClose={onClose} footer={<><button className={secondaryButton} onClick={onClose}>Cancel</button><button className={primaryButton} onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : canDeliver && deliver ? "Send Email & Record" : "Record Message"}</button></>}>
    <div className="space-y-3">
      {error && <div className="rounded border border-[#ea001e] bg-[#fff1f1] p-2 text-sm text-[#8e030f]">{error}</div>}
      <div className="grid gap-3 md:grid-cols-2"><Field label="Direction"><select className={inputClass} value={direction} onChange={(event) => { setDirection(event.target.value); setDeliver(false); }}>{["Inbound", "Outbound", "System"].map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="Message Date"><input type="datetime-local" className={inputClass} value={sentAt} onChange={(event) => setSentAt(event.target.value)} /></Field></div>
      <Field label="Sender Name"><input className={inputClass} value={senderName} onChange={(event) => setSenderName(event.target.value)} /></Field>
      <Field label="Message" required><textarea className={cn(inputClass, "min-h-32")} value={body} onChange={(event) => setBody(event.target.value)} /></Field>
      {session.channel === "Email" && direction === "Outbound" && <label className="flex items-start gap-2 rounded border border-[#d8dde6] p-3 text-sm"><input type="checkbox" className="mt-1" checked={deliver} disabled={!capabilities.emailDelivery} onChange={(event) => setDeliver(event.target.checked)} /><span><span className="block font-semibold">Deliver through configured SendGrid account</span><span className="text-xs text-[#706e6b]">{capabilities.emailDelivery ? "When unchecked, this only records an externally sent message." : "SendGrid is not configured. This message can only be recorded."}</span></span></label>}
      {!(session.channel === "Email" && direction === "Outbound") && <div className="rounded bg-[#f3f3f3] p-3 text-xs text-[#706e6b]">Recording a message does not contact the participant or claim external delivery.</div>}
    </div>
  </DialogShell>;
}

export function MessagingSessionDetailPage({ initial, data, onEdit, onChanged, onDeleted, onToast }: { initial: RecordData; data: BootstrapData; onEdit: () => void; onChanged: (result: CommunicationsMutationResult) => void; onDeleted: (id: string) => void; onToast: (toast: Toast) => void }) {
  const [session, setSession] = useState(initial);
  const [capabilities, setCapabilities] = useState({ emailDelivery: false });
  const [messageOpen, setMessageOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { void jsonRequest(`/api/messaging-sessions/${requiredId(initial)}`).then((payload) => { setSession(payload.session as RecordData); setCapabilities(payload.capabilities as { emailDelivery: boolean }); }).catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load session.")); }, [initial]);
  const participants = Array.isArray(session.participants) ? session.participants as RecordData[] : [];
  const messages = Array.isArray(session.messages) ? session.messages as RecordData[] : [];
  function apply(result: CommunicationsMutationResult) { if (result.session) setSession(result.session); onChanged(result); }
  async function action(actionName: string) {
    try { const payload = await jsonRequest(`/api/messaging-sessions/${requiredId(session)}/actions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: actionName }) }); apply({ session: payload.session as RecordData, notifications: payload.notifications as RecordData[] | undefined }); onToast({ tone: "success", message: `Messaging session is now ${text((payload.session as RecordData).status)}.` }); }
    catch (actionError) { onToast({ tone: "error", message: actionError instanceof Error ? actionError.message : "Unable to update session." }); }
  }
  async function remove() {
    try { await jsonRequest(`/api/messaging-sessions/${requiredId(session)}`, { method: "DELETE" }); onDeleted(requiredId(session)); }
    catch (deleteError) { setConfirmDelete(false); onToast({ tone: "error", message: deleteError instanceof Error ? deleteError.message : "Unable to delete session." }); }
  }
  return <section className="space-y-3">
    <div className="rounded-lg border border-[#e4e7ec] bg-white p-4 shadow-card"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex gap-3"><MessageSquareText className="text-brand-600" /><div><div className="text-xs text-[#706e6b]">Messaging Session</div><h1 className="text-2xl font-semibold">{text(session.name)}</h1><div className="mt-2"><CommunicationsStatusBadge status={session.status} /></div></div></div><div className="flex flex-wrap gap-2">{session.status !== "Closed" && <button className={secondaryButton} onClick={onEdit}>Edit</button>}{session.status === "Open" && <button className={secondaryButton} onClick={() => void action("wait")}>Mark Waiting</button>}{session.status === "Waiting" && <button className={secondaryButton} onClick={() => void action("resume")}>Resume</button>}{session.status !== "Closed" && <button className={secondaryButton} onClick={() => void action("close")}><Square size={13} /> Close</button>}{session.status === "Closed" && <button className={secondaryButton} onClick={() => void action("reopen")}><RotateCcw size={13} /> Reopen</button>}{session.status !== "Closed" && <button className={primaryButton} onClick={() => setMessageOpen(true)}><Plus size={13} /> Record Message</button>}{session.status === "Open" && messages.length === 0 && <button className={dangerButton} onClick={() => setConfirmDelete(true)}><Trash2 size={13} /> Delete</button>}</div></div>{error && <div className="mt-3 rounded border border-[#ea001e] bg-[#fff1f1] p-2 text-sm text-[#8e030f]">{error}</div>}</div>
    <div className="grid gap-3 lg:grid-cols-3"><WorkspaceCard title="Session Details"><dl className="space-y-3 text-sm"><Detail label="Channel" value={session.channel} /><Detail label="Subject" value={session.subject} /><Detail label="Owner" value={data.users.find((user) => user.id === session.ownerId)?.name || session.ownerId} /><Detail label="Started" value={session.startedAt ? formatDateTime(text(session.startedAt)) : "-"} /><Detail label="Ended" value={session.endedAt ? formatDateTime(text(session.endedAt)) : "-"} /></dl></WorkspaceCard><WorkspaceCard title="Related Records"><dl className="space-y-3 text-sm"><DetailLink label="Account" value={text((session.account as RecordData | undefined)?.name)} href={session.accountId ? `/lightning/r/Account/${text(session.accountId)}/view` : ""} /><DetailLink label="Contact" value={session.contact ? contactLabel(session.contact as RecordData) : ""} href={session.contactId ? `/lightning/r/Contact/${text(session.contactId)}/view` : ""} /><Detail label="External ID" value={session.externalId} /></dl></WorkspaceCard><WorkspaceCard title={`Participants (${participants.length})`}><div className="space-y-2">{participants.map((participant) => <div key={requiredId(participant)} className="rounded border border-[#eef1f6] p-2 text-sm"><div className="font-semibold">{text(participant.name)}</div><div className="text-xs text-[#706e6b]">{text(participant.role)}{participant.address ? ` · ${text(participant.address)}` : ""}</div></div>)}{!participants.length && <div className="text-sm text-[#706e6b]">No participants recorded.</div>}</div></WorkspaceCard></div>
    <WorkspaceCard title={`Conversation (${messages.length})`}><div className="space-y-3">{messages.map((message) => <div key={requiredId(message)} className={cn("max-w-3xl rounded-lg border p-3", message.direction === "Outbound" ? "ml-auto border-brand-200 bg-brand-50" : message.direction === "Inbound" ? "border-[#d8dde6] bg-white" : "mx-auto bg-[#f3f3f3]")}><div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs"><span className="font-semibold">{text(message.senderName) || text(message.direction)}</span><span className="text-[#706e6b]">{formatDateTime(text(message.sentAt))} · {text(message.status)}</span></div><div className="whitespace-pre-wrap text-sm">{text(message.body)}</div></div>)}{!messages.length && <div className="rounded border border-dashed border-[#d8dde6] p-5 text-center text-sm text-[#706e6b]">No messages yet. Record inbound or externally exchanged messages to build the transcript.</div>}</div></WorkspaceCard>
    {messageOpen && <MessageModal session={session} capabilities={capabilities} onClose={() => setMessageOpen(false)} onSaved={(result) => { apply(result); onToast({ tone: "success", message: "Message recorded." }); }} />}
    {confirmDelete && <DialogShell title={`Delete ${text(session.name)}?`} onClose={() => setConfirmDelete(false)} footer={<><button className={secondaryButton} onClick={() => setConfirmDelete(false)}>Cancel</button><button className={dangerButton} onClick={() => void remove()}>Delete</button></>}><p className="text-sm text-[#706e6b]">Only an empty Open session can be deleted. This cannot be undone.</p></DialogShell>}
  </section>;
}

function Detail({ label, value }: { label: string; value: unknown }) { return <div><dt className="text-xs text-[#706e6b]">{label}</dt><dd>{text(value) || "-"}</dd></div>; }
function DetailLink({ label, value, href }: { label: string; value: unknown; href: string }) { return <div><dt className="text-xs text-[#706e6b]">{label}</dt><dd>{href && value ? <Link href={href} className="text-brand-700 hover:underline">{text(value)}</Link> : "-"}</dd></div>; }

function initialVideoParticipants(record: RecordData | undefined): ParticipantDraft[] {
  const participants = Array.isArray(record?.participants) ? record.participants as RecordData[] : [];
  return participants.map((participant) => ({ contactId: text(participant.contactId), userId: text(participant.userId), name: text(participant.name), email: text(participant.email), role: text(participant.role) || "Attendee" }));
}

export function VideoCallEditorModal({ data, initial, onClose, onSaved, onToast }: { data: BootstrapData; initial?: RecordData; onClose: () => void; onSaved: (result: CommunicationsMutationResult) => void; onToast: (toast: Toast) => void }) {
  const terminal = Boolean(initial && ["Completed", "Cancelled"].includes(text(initial.status)));
  const [values, setValues] = useState(() => ({ name: text(initial?.name), description: text(initial?.description), provider: text(initial?.provider) || "External Link", meetingUrl: text(initial?.meetingUrl), scheduledStartAt: toDateTimeInput(initial?.scheduledStartAt, 60), scheduledEndAt: toDateTimeInput(initial?.scheduledEndAt, 120), accountId: text(initial?.accountId), contactId: text(initial?.contactId), opportunityId: text(initial?.opportunityId), organizerId: text(initial?.organizerId) || data.user.id, recordingUrl: text(initial?.recordingUrl), notes: text(initial?.notes), notifyParticipants: false }));
  const [participants, setParticipants] = useState<ParticipantDraft[]>(() => initialVideoParticipants(initial));
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const initialSnapshot = useMemo(() => JSON.stringify({ values, participants }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = JSON.stringify({ values, participants }) !== initialSnapshot;
  function requestClose() { if (!dirty || window.confirm("Discard unsaved video-call changes?")) onClose(); }
  function updateParticipant(index: number, patch: Partial<ParticipantDraft>) { setParticipants((current) => current.map((participant, itemIndex) => itemIndex === index ? { ...participant, ...patch } : participant)); }
  function selectParticipant(index: number, key: "contactId" | "userId", id: string) { const source = key === "contactId" ? data.contacts.find((item) => item.id === id) : data.users.find((item) => item.id === id); updateParticipant(index, { contactId: key === "contactId" ? id : "", userId: key === "userId" ? id : "", name: source ? (key === "contactId" ? contactLabel(source as RecordData) : text(source.name)) : "", email: text(source?.email) }); }
  async function save() { if (!terminal && !values.name.trim()) { setError("Video call name is required."); return; } setSaving(true); setError(""); try { const payload = await jsonRequest(initial?.id ? `/api/video-calls/${requiredId(initial)}` : "/api/video-calls", { method: initial?.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(terminal ? { notes: values.notes, recordingUrl: values.recordingUrl } : { ...values, scheduledStartAt: new Date(values.scheduledStartAt).toISOString(), scheduledEndAt: new Date(values.scheduledEndAt).toISOString(), participants }) }); onSaved({ videoCall: payload.videoCall as RecordData, notifications: payload.notifications as RecordData[] | undefined }); onToast({ tone: "success", message: terminal ? "Video call notes updated." : initial?.id ? "Video call updated." : payload.invitation ? "Video call scheduled and invitations accepted for delivery." : "Video call scheduled." }); onClose(); } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Unable to save video call."); } finally { setSaving(false); } }
  if (terminal) return <DialogShell title={`Update ${text(initial?.name)}`} onClose={requestClose} footer={<><button className={secondaryButton} onClick={requestClose}>Cancel</button><button className={primaryButton} onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save"}</button></>}><div className="space-y-4">{error && <div className="rounded border border-[#ea001e] bg-[#fff1f1] p-2 text-sm text-[#8e030f]">{error}</div>}<div className="rounded border border-[#d8dde6] bg-[#f8f9fb] p-3 text-sm text-[#514f4d]">Completed and cancelled calls keep their schedule and participants immutable. You can add a recording link or update notes.</div><Field label="Recording URL"><input type="url" className={inputClass} placeholder="https://…" value={values.recordingUrl} onChange={(event) => setValues({ ...values, recordingUrl: event.target.value })} /></Field><Field label="Notes"><textarea className={cn(inputClass, "min-h-28")} value={values.notes} onChange={(event) => setValues({ ...values, notes: event.target.value })} /></Field></div></DialogShell>;
  return <DialogShell title={initial ? `Edit ${text(initial.name)}` : "New Video Call"} onClose={requestClose} wide footer={<><button className={secondaryButton} onClick={requestClose}>Cancel</button><button className={primaryButton} onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save"}</button></>}><div className="space-y-5">{error && <div className="rounded border border-[#ea001e] bg-[#fff1f1] p-2 text-sm text-[#8e030f]">{error}</div>}<div className="grid gap-4 md:grid-cols-2"><Field label="Video Call Name" required><input className={inputClass} value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} /></Field><Field label="Provider"><select className={inputClass} value={values.provider} onChange={(event) => setValues({ ...values, provider: event.target.value })}>{["External Link", "Zoom", "Google Meet", "Microsoft Teams", "Other"].map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="Start" required><input type="datetime-local" className={inputClass} value={values.scheduledStartAt} onChange={(event) => setValues({ ...values, scheduledStartAt: event.target.value })} /></Field><Field label="End" required><input type="datetime-local" className={inputClass} value={values.scheduledEndAt} onChange={(event) => setValues({ ...values, scheduledEndAt: event.target.value })} /></Field><Field label="Meeting URL"><input type="url" className={inputClass} placeholder="https://…" value={values.meetingUrl} onChange={(event) => setValues({ ...values, meetingUrl: event.target.value })} /></Field><Field label="Organizer"><select className={inputClass} value={values.organizerId} onChange={(event) => setValues({ ...values, organizerId: event.target.value })}>{data.users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></Field><Field label="Account"><select className={inputClass} value={values.accountId} onChange={(event) => setValues({ ...values, accountId: event.target.value })}><option value="">No account</option>{data.accounts.map((account) => <option key={requiredId(account)} value={requiredId(account)}>{text(account.name)}</option>)}</select></Field><Field label="Contact"><select className={inputClass} value={values.contactId} onChange={(event) => setValues({ ...values, contactId: event.target.value })}><option value="">No contact</option>{data.contacts.filter((contact) => !values.accountId || contact.accountId === values.accountId).map((contact) => <option key={requiredId(contact)} value={requiredId(contact)}>{contactLabel(contact)}</option>)}</select></Field><Field label="Opportunity"><select className={inputClass} value={values.opportunityId} onChange={(event) => setValues({ ...values, opportunityId: event.target.value })}><option value="">No opportunity</option>{data.opportunities.filter((opportunity) => !values.accountId || opportunity.accountId === values.accountId).map((opportunity) => <option key={requiredId(opportunity)} value={requiredId(opportunity)}>{text(opportunity.name)}</option>)}</select></Field><Field label="Recording URL"><input type="url" className={inputClass} placeholder="https://…" value={values.recordingUrl} onChange={(event) => setValues({ ...values, recordingUrl: event.target.value })} /></Field><div className="md:col-span-2"><Field label="Description"><textarea className={cn(inputClass, "min-h-20")} value={values.description} onChange={(event) => setValues({ ...values, description: event.target.value })} /></Field></div><div className="md:col-span-2"><Field label="Notes"><textarea className={cn(inputClass, "min-h-20")} value={values.notes} onChange={(event) => setValues({ ...values, notes: event.target.value })} /></Field></div></div><section><div className="mb-2 flex items-center justify-between"><h3 className="font-semibold">Participants</h3><button className={secondaryButton} onClick={() => setParticipants((current) => [...current, { contactId: "", userId: "", name: "", email: "", role: "Attendee" }])}><Plus size={13} /> Add Participant</button></div><div className="space-y-2">{participants.map((participant, index) => <div key={index} className="grid gap-2 rounded border border-[#d8dde6] p-3 md:grid-cols-[1fr_1fr_1fr_120px_auto]"><select className={inputClass} value={participant.contactId ? `contact:${participant.contactId}` : participant.userId ? `user:${participant.userId}` : ""} onChange={(event) => { const [kind, id] = event.target.value.split(":"); selectParticipant(index, kind === "user" ? "userId" : "contactId", id || ""); }}><option value="">Custom participant</option><optgroup label="Contacts">{data.contacts.map((contact) => <option key={requiredId(contact)} value={`contact:${requiredId(contact)}`}>{contactLabel(contact)}</option>)}</optgroup><optgroup label="Users">{data.users.map((user) => <option key={user.id} value={`user:${user.id}`}>{user.name}</option>)}</optgroup></select><input className={inputClass} placeholder="Name" value={participant.name} onChange={(event) => updateParticipant(index, { name: event.target.value })} /><input className={inputClass} placeholder="Email" value={participant.email || ""} onChange={(event) => updateParticipant(index, { email: event.target.value })} /><select className={inputClass} value={participant.role} onChange={(event) => updateParticipant(index, { role: event.target.value })}>{["Host", "Presenter", "Attendee", "Observer"].map((value) => <option key={value}>{value}</option>)}</select><button className={secondaryButton} onClick={() => setParticipants((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={13} /></button></div>)}</div>{!initial && <label className="mt-3 flex items-start gap-2 rounded border border-[#d8dde6] p-3 text-sm"><input type="checkbox" className="mt-1" checked={values.notifyParticipants} onChange={(event) => setValues({ ...values, notifyParticipants: event.target.checked })} /><span><span className="block font-semibold">Email invitations through configured SendGrid</span><span className="text-xs text-[#706e6b]">If delivery is not configured or no participant has a valid email, creation is rejected. Saving without this option only records the call.</span></span></label>}</section></div></DialogShell>;
}

export function VideoCallDetailPage({ initial, data, onEdit, onChanged, onDeleted, onToast }: { initial: RecordData; data: BootstrapData; onEdit: () => void; onChanged: (result: CommunicationsMutationResult) => void; onDeleted: (id: string) => void; onToast: (toast: Toast) => void }) {
  const [videoCall, setVideoCall] = useState<RecordData & { meetingUrl?: string; status?: string }>(initial); const [confirmDelete, setConfirmDelete] = useState(false); const [error, setError] = useState("");
  useEffect(() => { void jsonRequest(`/api/video-calls/${requiredId(initial)}`).then((payload) => setVideoCall(payload.videoCall as RecordData)).catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load video call.")); }, [initial]);
  const participants = Array.isArray(videoCall.participants) ? videoCall.participants as RecordData[] : [];
  function apply(result: CommunicationsMutationResult) { if (result.videoCall) setVideoCall(result.videoCall); onChanged(result); }
  async function action(actionName: string, values: Record<string, unknown> = {}) { try { const payload = await jsonRequest(`/api/video-calls/${requiredId(videoCall)}/actions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: actionName, ...values }) }); apply({ videoCall: payload.videoCall as RecordData, notifications: payload.notifications as RecordData[] | undefined }); onToast({ tone: "success", message: `Video call is now ${text((payload.videoCall as RecordData).status)}.` }); } catch (actionError) { onToast({ tone: "error", message: actionError instanceof Error ? actionError.message : "Unable to update video call." }); } }
  async function remove() { try { await jsonRequest(`/api/video-calls/${requiredId(videoCall)}`, { method: "DELETE" }); onDeleted(requiredId(videoCall)); } catch (deleteError) { setConfirmDelete(false); onToast({ tone: "error", message: deleteError instanceof Error ? deleteError.message : "Unable to delete video call." }); } }
  return <section className="space-y-3"><div className="rounded-lg border border-[#e4e7ec] bg-white p-4 shadow-card"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex gap-3"><Video className="text-brand-600" /><div><div className="text-xs text-[#706e6b]">Video Call</div><h1 className="text-2xl font-semibold">{text(videoCall.name)}</h1><div className="mt-2"><CommunicationsStatusBadge status={videoCall.status} /></div></div></div><div className="flex flex-wrap gap-2">{videoCall.meetingUrl && !["Completed", "Cancelled"].includes(text(videoCall.status)) && <a className={primaryButton} href={text(videoCall.meetingUrl)} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Join</a>}<button className={secondaryButton} onClick={onEdit}>{["Completed", "Cancelled"].includes(text(videoCall.status)) ? "Update Notes" : "Edit"}</button>{videoCall.status === "Scheduled" && <button className={primaryButton} onClick={() => void action("start")}><Play size={13} /> Start</button>}{videoCall.status === "In Progress" && <button className={primaryButton} onClick={() => void action("complete")}><CheckCircle2 size={13} /> Complete</button>}{videoCall.status === "Scheduled" && <button className={secondaryButton} onClick={() => void action("cancel")}>Cancel Call</button>}{videoCall.status === "Scheduled" && <button className={dangerButton} onClick={() => setConfirmDelete(true)}><Trash2 size={13} /> Delete</button>}</div></div>{error && <div className="mt-3 rounded border border-[#ea001e] bg-[#fff1f1] p-2 text-sm text-[#8e030f]">{error}</div>}</div><div className="grid gap-3 lg:grid-cols-3"><WorkspaceCard title="Schedule"><dl className="space-y-3 text-sm"><Detail label="Provider" value={videoCall.provider} /><Detail label="Starts" value={videoCall.scheduledStartAt ? formatDateTime(text(videoCall.scheduledStartAt)) : "-"} /><Detail label="Ends" value={videoCall.scheduledEndAt ? formatDateTime(text(videoCall.scheduledEndAt)) : "-"} /><Detail label="Actual Start" value={videoCall.startedAt ? formatDateTime(text(videoCall.startedAt)) : "-"} /><Detail label="Actual End" value={videoCall.endedAt ? formatDateTime(text(videoCall.endedAt)) : "-"} /></dl></WorkspaceCard><WorkspaceCard title="Related Records"><dl className="space-y-3 text-sm"><DetailLink label="Account" value={text((videoCall.account as RecordData | undefined)?.name)} href={videoCall.accountId ? `/lightning/r/Account/${text(videoCall.accountId)}/view` : ""} /><DetailLink label="Contact" value={videoCall.contact ? contactLabel(videoCall.contact as RecordData) : ""} href={videoCall.contactId ? `/lightning/r/Contact/${text(videoCall.contactId)}/view` : ""} /><DetailLink label="Opportunity" value={(videoCall.opportunity as RecordData | undefined)?.name} href={videoCall.opportunityId ? `/lightning/r/Opportunity/${text(videoCall.opportunityId)}/view` : ""} /><Detail label="Organizer" value={data.users.find((user) => user.id === videoCall.organizerId)?.name || videoCall.organizerId} /></dl></WorkspaceCard><WorkspaceCard title="Links"><dl className="space-y-3 text-sm"><div><dt className="text-xs text-[#706e6b]">Meeting</dt><dd>{videoCall.meetingUrl ? <a className="text-brand-700 hover:underline" href={text(videoCall.meetingUrl)} target="_blank" rel="noreferrer">Open meeting link</a> : "No meeting link added"}</dd></div><div><dt className="text-xs text-[#706e6b]">Recording</dt><dd>{videoCall.recordingUrl ? <a className="text-brand-700 hover:underline" href={text(videoCall.recordingUrl)} target="_blank" rel="noreferrer">Open recording</a> : "No recording linked"}</dd></div></dl></WorkspaceCard></div><div className="grid gap-3 lg:grid-cols-[1fr_2fr]"><WorkspaceCard title={`Participants (${participants.length})`}><div className="space-y-2">{participants.map((participant) => <div key={requiredId(participant)} className="rounded border border-[#eef1f6] p-2"><div className="flex items-start justify-between gap-2"><div><div className="font-semibold">{text(participant.name)}</div><div className="text-xs text-[#706e6b]">{text(participant.role)} · {text(participant.email) || "No email"}</div></div><select className="rounded border border-[#c9c9c9] px-2 py-1 text-xs" value={text(participant.attendance)} onChange={(event) => void action("attendance", { participantId: participant.id, attendance: event.target.value })}>{["Invited", "Accepted", "Declined", "Attended", "No Show"].map((value) => <option key={value}>{value}</option>)}</select></div></div>)}{!participants.length && <div className="text-sm text-[#706e6b]">No participants recorded.</div>}</div></WorkspaceCard><WorkspaceCard title="Description & Notes"><div className="space-y-4 text-sm"><div><div className="text-xs text-[#706e6b]">Description</div><div className="whitespace-pre-wrap">{text(videoCall.description) || "-"}</div></div><div><div className="text-xs text-[#706e6b]">Notes</div><div className="whitespace-pre-wrap">{text(videoCall.notes) || "-"}</div></div></div></WorkspaceCard></div>{confirmDelete && <DialogShell title={`Delete ${text(videoCall.name)}?`} onClose={() => setConfirmDelete(false)} footer={<><button className={secondaryButton} onClick={() => setConfirmDelete(false)}>Cancel</button><button className={dangerButton} onClick={() => void remove()}>Delete</button></>}><p className="text-sm text-[#706e6b]">Only a video call that has not started can be deleted. This cannot be undone.</p></DialogShell>}</section>;
}
