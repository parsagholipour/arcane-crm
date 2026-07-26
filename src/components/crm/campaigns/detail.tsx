"use client";

import { Archive, CheckCircle2, Megaphone, Plus, RotateCcw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { type ScopedCrmData, type RecordData } from "@/lib/crm-types";
import { formatDate, formatDateTime } from "@/lib/utils";
import { AsyncButton } from "@/components/crm/AsyncButton";
import {
  type CampaignMutationResult,
  id,
  type Toast,
  jsonRequest,
  text,
  CampaignStatusBadge,
  secondaryButton,
  primaryButton,
  dangerButton,
  Card,
  Detail,
  Modal
} from "@/components/crm/campaigns/primitives";
import { AddMembersModal } from "@/components/crm/campaigns/members";

export function CampaignDetailPage({
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
  onChanged: (result: CampaignMutationResult) => void;
  onDeleted: (id: string) => void;
  onToast: (toast: Toast) => void;
}) {
  const [campaign, setCampaign] = useState(initial);
  const [addMembers, setAddMembers] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    void jsonRequest(`/api/campaigns/${id(initial)}`)
      .then((payload) => setCampaign(payload.campaign as RecordData))
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load campaign."));
  }, [initial]);
  const members = Array.isArray(campaign.members) ? (campaign.members as RecordData[]) : [];
  const metrics = (campaign.metrics as RecordData | undefined) ?? {};
  function apply(result: CampaignMutationResult) {
    if (result.campaign) setCampaign(result.campaign);
    onChanged(result);
  }
  async function action(actionName: string) {
    try {
      const payload = await jsonRequest(`/api/campaigns/${id(campaign)}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionName })
      });
      apply({
        campaign: payload.campaign as RecordData,
        notifications: payload.notifications as RecordData[] | undefined
      });
      onToast({ tone: "success", message: `Campaign is now ${text((payload.campaign as RecordData).status)}.` });
    } catch (actionError) {
      onToast({
        tone: "error",
        message: actionError instanceof Error ? actionError.message : "Unable to update campaign."
      });
    }
  }
  async function updateMember(member: RecordData, status: string) {
    try {
      const payload = await jsonRequest(`/api/campaigns/${id(campaign)}/members/${id(member)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      apply({ campaign: payload.campaign as RecordData });
    } catch (updateError) {
      onToast({
        tone: "error",
        message: updateError instanceof Error ? updateError.message : "Unable to update member."
      });
    }
  }
  async function removeMember(member: RecordData) {
    if (!window.confirm(`Remove ${text(member.name)} from this campaign?`)) return;
    try {
      const payload = await jsonRequest(`/api/campaigns/${id(campaign)}/members/${id(member)}`, { method: "DELETE" });
      apply({ campaign: payload.campaign as RecordData });
    } catch (removeError) {
      onToast({
        tone: "error",
        message: removeError instanceof Error ? removeError.message : "Unable to remove member."
      });
    }
  }
  async function remove() {
    try {
      await jsonRequest(`/api/campaigns/${id(campaign)}`, { method: "DELETE" });
      onDeleted(id(campaign));
    } catch (deleteError) {
      setConfirmDelete(false);
      onToast({
        tone: "error",
        message: deleteError instanceof Error ? deleteError.message : "Unable to delete campaign."
      });
    }
  }
  return (
    <section className="space-y-3">
      <div className="rounded-lg border border-[#e4e7ec] bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex gap-3">
            <Megaphone className="text-brand-600" />
            <div>
              <div className="text-xs text-[#706e6b]">Campaign</div>
              <h1 className="text-2xl font-semibold">{text(campaign.name)}</h1>
              <div className="mt-2">
                <CampaignStatusBadge status={campaign.status} />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {campaign.status !== "Archived" && (
              <button className={secondaryButton} onClick={onEdit}>
                Edit
              </button>
            )}
            {campaign.status !== "Archived" && (
              <button className={primaryButton} onClick={() => setAddMembers(true)}>
                <Plus size={13} /> Add Members
              </button>
            )}
            {campaign.status === "Planned" && (
              <button className={primaryButton} onClick={() => void action("activate")}>
                Activate
              </button>
            )}
            {campaign.status === "In Progress" && (
              <button className={primaryButton} onClick={() => void action("complete")}>
                <CheckCircle2 size={13} /> Complete
              </button>
            )}
            {campaign.status === "Completed" && (
              <button className={secondaryButton} onClick={() => void action("reopen")}>
                <RotateCcw size={13} /> Reopen
              </button>
            )}
            {campaign.status !== "Archived" && (
              <button className={secondaryButton} onClick={() => void action("archive")}>
                <Archive size={13} /> Archive
              </button>
            )}
            {campaign.status === "Archived" && (
              <button className={secondaryButton} onClick={() => void action("restore")}>
                <RotateCcw size={13} /> Restore
              </button>
            )}
            {campaign.status === "Planned" && !members.length && (
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
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Members", metrics.memberCount ?? members.length],
          ["Responded", metrics.respondedCount ?? 0],
          ["Response Rate", `${metrics.responseRate ?? 0}%`],
          ["Converted", metrics.convertedCount ?? 0]
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-lg border border-[#e4e7ec] bg-white p-4 shadow-card">
            <div className="text-xs text-[#706e6b]">{String(label)}</div>
            <div className="mt-1 text-2xl font-semibold">{String(value)}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Campaign Details">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Detail label="Type" value={campaign.type} />
            <Detail
              label="Owner"
              value={data.users.find((user) => user.id === campaign.ownerId)?.name || campaign.ownerId}
            />
            <Detail label="Start" value={campaign.startDate ? formatDate(text(campaign.startDate)) : "-"} />
            <Detail label="End" value={campaign.endDate ? formatDate(text(campaign.endDate)) : "-"} />
            <Detail label="Budgeted Cost" value={campaign.budgetedCost} />
            <Detail label="Actual Cost" value={campaign.actualCost} />
            <Detail label="Expected Revenue" value={campaign.expectedRevenue} />
            <Detail label="Parent Campaign" value={(campaign.parentCampaign as RecordData | undefined)?.name} />
          </dl>
        </Card>
        <Card title="Description">
          <div className="whitespace-pre-wrap text-sm">{text(campaign.description) || "No description."}</div>
        </Card>
      </div>
      <Card title={`Campaign Members (${members.length})`}>
        {members.length ? (
          <div className="overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#f3f3f3] text-xs">
                <tr>
                  <th className="px-3 py-2">Member</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Context</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Responded</th>
                  <th className="px-3 py-2">Updated</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={id(member)} className="border-t border-[#eef1f6]">
                    <td className="px-3 py-2">
                      <Link
                        className="font-semibold text-brand-700 hover:underline"
                        href={
                          member.objectType === "Contact"
                            ? `/lightning/r/Contact/${text(member.recordId)}/view`
                            : `/lightning/r/Lead/${text(member.recordId)}/view`
                        }
                      >
                        {text(member.name)}
                      </Link>
                      <div className="text-xs text-[#706e6b]">{text(member.email)}</div>
                    </td>
                    <td className="px-3 py-2">{text(member.objectType)}</td>
                    <td className="px-3 py-2">{text(member.context) || "-"}</td>
                    <td className="px-3 py-2">
                      <select
                        className="rounded border border-[#c9c9c9] px-2 py-1 text-xs"
                        value={text(member.status)}
                        onChange={(event) => void updateMember(member, event.target.value)}
                      >
                        {["Sent", "Responded", "Registered", "Attended", "Converted", "Opted Out"].map((value) => (
                          <option key={value}>{value}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">{member.responded ? "Yes" : "No"}</td>
                    <td className="px-3 py-2">{formatDateTime(text(member.updatedAt))}</td>
                    <td className="px-3 py-2">
                      <button
                        className={secondaryButton}
                        disabled={campaign.status === "Archived"}
                        onClick={() => void removeMember(member)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded border border-dashed border-[#d8dde6] p-5 text-center text-sm text-[#706e6b]">
            No members yet. Add Leads or Contacts to begin measuring response.
          </div>
        )}
      </Card>
      {addMembers && (
        <AddMembersModal
          campaign={campaign}
          data={data}
          onClose={() => setAddMembers(false)}
          onSaved={(result) => {
            apply(result);
            onToast({ tone: "success", message: "Campaign members added." });
          }}
        />
      )}
      {confirmDelete && (
        <Modal
          title={`Delete ${text(campaign.name)}?`}
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
            Only an empty Planned campaign without child campaigns can be deleted.
          </p>
        </Modal>
      )}
    </section>
  );
}
