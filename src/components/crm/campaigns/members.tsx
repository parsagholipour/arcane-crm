"use client";

import { useState } from "react";
import { type ScopedCrmData, type RecordData } from "@/lib/crm-types";
import { AsyncButton } from "@/components/crm/AsyncButton";
import {
  type CampaignMutationResult,
  jsonRequest,
  id,
  Modal,
  secondaryButton,
  primaryButton,
  Field,
  inputClass,
  contactName,
  text
} from "@/components/crm/campaigns/primitives";

export function AddMembersModal({
  campaign,
  data,
  onClose,
  onSaved
}: {
  campaign: RecordData;
  data: ScopedCrmData;
  onClose: () => void;
  onSaved: (result: CampaignMutationResult) => void;
}) {
  const [objectType, setObjectType] = useState("Contact");
  const [selected, setSelected] = useState<string[]>([]);
  const [status, setStatus] = useState("Sent");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const records = objectType === "Contact" ? data.contacts : data.leads;
  async function save() {
    setSaving(true);
    setError("");
    try {
      const payload = await jsonRequest(`/api/campaigns/${id(campaign)}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objectType, recordIds: selected, status })
      });
      onSaved({
        campaign: payload.campaign as RecordData,
        notifications: payload.notifications as RecordData[] | undefined
      });
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to add members.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal
      title="Add Campaign Members"
      onClose={onClose}
      wide
      footer={
        <>
          <button className={secondaryButton} onClick={onClose}>
            Cancel
          </button>
          <AsyncButton className={primaryButton} disabled={saving || !selected.length} onClick={() => save()}>
            {saving ? "Adding…" : `Add ${selected.length || ""} Member${selected.length === 1 ? "" : "s"}`}
          </AsyncButton>
        </>
      }
    >
      <div className="space-y-3">
        {error && (
          <div className="rounded border border-[#ea001e] bg-[#fff1f1] p-2 text-sm text-[#8e030f]">{error}</div>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Record Type">
            <select
              className={inputClass}
              value={objectType}
              onChange={(event) => {
                setObjectType(event.target.value);
                setSelected([]);
              }}
            >
              <option>Contact</option>
              <option>Lead</option>
            </select>
          </Field>
          <Field label="Initial Status">
            <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}>
              {["Sent", "Responded", "Registered", "Attended", "Converted", "Opted Out"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="max-h-80 overflow-auto rounded border border-[#d8dde6]">
          {records.map((record) => (
            <label
              key={id(record)}
              className="flex items-center gap-3 border-b border-[#eef1f6] p-3 text-sm last:border-0 hover:bg-brand-50"
            >
              <input
                type="checkbox"
                checked={selected.includes(id(record))}
                onChange={() =>
                  setSelected((current) =>
                    current.includes(id(record))
                      ? current.filter((item) => item !== id(record))
                      : [...current, id(record)]
                  )
                }
              />
              <span>
                <span className="block font-semibold">{contactName(record)}</span>
                <span className="text-xs text-[#706e6b]">
                  {text(record.email) || text(record.company) || text(record.accountName)}
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>
    </Modal>
  );
}
