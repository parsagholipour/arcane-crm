"use client";

import { CheckCircle2, ExternalLink, Play, Trash2, Video } from "lucide-react";
import { useEffect, useState } from "react";
import { type ScopedCrmData, type RecordData } from "@/lib/crm-types";
import { formatDateTime } from "@/lib/utils";
import { AsyncButton } from "@/components/crm/AsyncButton";
import {
  type CommunicationsMutationResult,
  type Toast,
  jsonRequest,
  requiredId,
  text,
  CommunicationsStatusBadge,
  primaryButton,
  secondaryButton,
  dangerButton,
  WorkspaceCard,
  Detail,
  DetailLink,
  contactLabel,
  DialogShell
} from "@/components/crm/communications/primitives";

export function VideoCallDetailPage({
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
  const [videoCall, setVideoCall] = useState<RecordData & { meetingUrl?: string; status?: string }>(initial);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    void jsonRequest(`/api/video-calls/${requiredId(initial)}`)
      .then((payload) => setVideoCall(payload.videoCall as RecordData))
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load video call."));
  }, [initial]);
  const participants = Array.isArray(videoCall.participants) ? (videoCall.participants as RecordData[]) : [];
  function apply(result: CommunicationsMutationResult) {
    if (result.videoCall) setVideoCall(result.videoCall);
    onChanged(result);
  }
  async function action(actionName: string, values: Record<string, unknown> = {}) {
    try {
      const payload = await jsonRequest(`/api/video-calls/${requiredId(videoCall)}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionName, ...values })
      });
      apply({
        videoCall: payload.videoCall as RecordData,
        notifications: payload.notifications as RecordData[] | undefined
      });
      onToast({ tone: "success", message: `Video call is now ${text((payload.videoCall as RecordData).status)}.` });
    } catch (actionError) {
      onToast({
        tone: "error",
        message: actionError instanceof Error ? actionError.message : "Unable to update video call."
      });
    }
  }
  async function remove() {
    try {
      await jsonRequest(`/api/video-calls/${requiredId(videoCall)}`, { method: "DELETE" });
      onDeleted(requiredId(videoCall));
    } catch (deleteError) {
      setConfirmDelete(false);
      onToast({
        tone: "error",
        message: deleteError instanceof Error ? deleteError.message : "Unable to delete video call."
      });
    }
  }
  return (
    <section className="space-y-3">
      <div className="rounded-lg border border-[#e4e7ec] bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex gap-3">
            <Video className="text-brand-600" />
            <div>
              <div className="text-xs text-[#706e6b]">Video Call</div>
              <h1 className="text-2xl font-semibold">{text(videoCall.name)}</h1>
              <div className="mt-2">
                <CommunicationsStatusBadge status={videoCall.status} />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {videoCall.meetingUrl && !["Completed", "Cancelled"].includes(text(videoCall.status)) && (
              <a className={primaryButton} href={text(videoCall.meetingUrl)} target="_blank" rel="noreferrer">
                <ExternalLink size={13} /> Join
              </a>
            )}
            <button className={secondaryButton} onClick={onEdit}>
              {["Completed", "Cancelled"].includes(text(videoCall.status)) ? "Update Notes" : "Edit"}
            </button>
            {videoCall.status === "Scheduled" && (
              <button className={primaryButton} onClick={() => void action("start")}>
                <Play size={13} /> Start
              </button>
            )}
            {videoCall.status === "In Progress" && (
              <button className={primaryButton} onClick={() => void action("complete")}>
                <CheckCircle2 size={13} /> Complete
              </button>
            )}
            {videoCall.status === "Scheduled" && (
              <button className={secondaryButton} onClick={() => void action("cancel")}>
                Cancel Call
              </button>
            )}
            {videoCall.status === "Scheduled" && (
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
        <WorkspaceCard title="Schedule">
          <dl className="space-y-3 text-sm">
            <Detail label="Provider" value={videoCall.provider} />
            <Detail
              label="Starts"
              value={videoCall.scheduledStartAt ? formatDateTime(text(videoCall.scheduledStartAt)) : "-"}
            />
            <Detail
              label="Ends"
              value={videoCall.scheduledEndAt ? formatDateTime(text(videoCall.scheduledEndAt)) : "-"}
            />
            <Detail
              label="Actual Start"
              value={videoCall.startedAt ? formatDateTime(text(videoCall.startedAt)) : "-"}
            />
            <Detail label="Actual End" value={videoCall.endedAt ? formatDateTime(text(videoCall.endedAt)) : "-"} />
          </dl>
        </WorkspaceCard>
        <WorkspaceCard title="Related Records">
          <dl className="space-y-3 text-sm">
            <DetailLink
              label="Account"
              value={text((videoCall.account as RecordData | undefined)?.name)}
              href={videoCall.accountId ? `/lightning/r/Account/${text(videoCall.accountId)}/view` : ""}
            />
            <DetailLink
              label="Contact"
              value={videoCall.contact ? contactLabel(videoCall.contact as RecordData) : ""}
              href={videoCall.contactId ? `/lightning/r/Contact/${text(videoCall.contactId)}/view` : ""}
            />
            <DetailLink
              label="Opportunity"
              value={(videoCall.opportunity as RecordData | undefined)?.name}
              href={videoCall.opportunityId ? `/lightning/r/Opportunity/${text(videoCall.opportunityId)}/view` : ""}
            />
            <Detail
              label="Organizer"
              value={data.users.find((user) => user.id === videoCall.organizerId)?.name || videoCall.organizerId}
            />
          </dl>
        </WorkspaceCard>
        <WorkspaceCard title="Links">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs text-[#706e6b]">Meeting</dt>
              <dd>
                {videoCall.meetingUrl ? (
                  <a
                    className="text-brand-700 hover:underline"
                    href={text(videoCall.meetingUrl)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open meeting link
                  </a>
                ) : (
                  "No meeting link added"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[#706e6b]">Recording</dt>
              <dd>
                {videoCall.recordingUrl ? (
                  <a
                    className="text-brand-700 hover:underline"
                    href={text(videoCall.recordingUrl)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open recording
                  </a>
                ) : (
                  "No recording linked"
                )}
              </dd>
            </div>
          </dl>
        </WorkspaceCard>
      </div>
      <div className="grid gap-3 lg:grid-cols-[1fr_2fr]">
        <WorkspaceCard title={`Participants (${participants.length})`}>
          <div className="space-y-2">
            {participants.map((participant) => (
              <div key={requiredId(participant)} className="rounded border border-[#eef1f6] p-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">{text(participant.name)}</div>
                    <div className="text-xs text-[#706e6b]">
                      {text(participant.role)} · {text(participant.email) || "No email"}
                    </div>
                  </div>
                  <select
                    className="rounded border border-[#c9c9c9] px-2 py-1 text-xs"
                    value={text(participant.attendance)}
                    onChange={(event) =>
                      void action("attendance", { participantId: participant.id, attendance: event.target.value })
                    }
                  >
                    {["Invited", "Accepted", "Declined", "Attended", "No Show"].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
            {!participants.length && <div className="text-sm text-[#706e6b]">No participants recorded.</div>}
          </div>
        </WorkspaceCard>
        <WorkspaceCard title="Description & Notes">
          <div className="space-y-4 text-sm">
            <div>
              <div className="text-xs text-[#706e6b]">Description</div>
              <div className="whitespace-pre-wrap">{text(videoCall.description) || "-"}</div>
            </div>
            <div>
              <div className="text-xs text-[#706e6b]">Notes</div>
              <div className="whitespace-pre-wrap">{text(videoCall.notes) || "-"}</div>
            </div>
          </div>
        </WorkspaceCard>
      </div>
      {confirmDelete && (
        <DialogShell
          title={`Delete ${text(videoCall.name)}?`}
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
          <p className="text-sm text-[#706e6b]">
            Only a video call that has not started can be deleted. This cannot be undone.
          </p>
        </DialogShell>
      )}
    </section>
  );
}
