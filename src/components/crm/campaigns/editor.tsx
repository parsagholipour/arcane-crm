"use client";

import { useMemo, useState } from "react";
import { type FieldDefinition, type ScopedCrmData, type RecordData } from "@/lib/crm-types";
import { cn } from "@/lib/utils";
import { AsyncButton } from "@/components/crm/AsyncButton";
import { LookupField } from "@/features/crm/form-controls";
import {
  type CampaignMutationResult,
  type Toast,
  text,
  id,
  jsonRequest,
  Modal,
  secondaryButton,
  primaryButton,
  Field,
  inputClass
} from "@/components/crm/campaigns/primitives";

const parentCampaignLookupField: FieldDefinition = {
  name: "parentCampaignId",
  label: "Parent Campaign",
  section: "Campaign Details",
  type: "lookup",
  lookupObject: "Campaign"
};

export function CampaignEditorModal({
  data,
  initial,
  onClose,
  onSaved,
  onToast
}: {
  data: ScopedCrmData;
  initial?: RecordData;
  onClose: () => void;
  onSaved: (result: CampaignMutationResult) => void;
  onToast: (toast: Toast) => void;
}) {
  const [values, setValues] = useState(() => ({
    name: text(initial?.name),
    type: text(initial?.type) || "Email",
    ownerId: text(initial?.ownerId) || data.user.id,
    parentCampaignId: text(initial?.parentCampaignId),
    startDate: initial?.startDate ? text(initial.startDate).slice(0, 10) : "",
    endDate: initial?.endDate ? text(initial.endDate).slice(0, 10) : "",
    budgetedCost: text(initial?.budgetedCost),
    actualCost: text(initial?.actualCost),
    expectedRevenue: text(initial?.expectedRevenue),
    description: text(initial?.description)
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const snapshot = useMemo(() => JSON.stringify(values), []); // eslint-disable-line react-hooks/exhaustive-deps
  function requestClose() {
    if (JSON.stringify(values) === snapshot || window.confirm("Discard unsaved campaign changes?")) onClose();
  }
  async function save() {
    setSaving(true);
    setError("");
    try {
      const payload = await jsonRequest(initial?.id ? `/api/campaigns/${id(initial)}` : "/api/campaigns", {
        method: initial?.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values)
      });
      onSaved({
        campaign: payload.campaign as RecordData,
        notifications: payload.notifications as RecordData[] | undefined
      });
      onToast({ tone: "success", message: initial ? "Campaign updated." : "Campaign created." });
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save campaign.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal
      title={initial ? `Edit ${text(initial.name)}` : "New Campaign"}
      onClose={requestClose}
      onEnterAction={save}
      wide
      footer={
        <>
          <button className={secondaryButton} onClick={requestClose}>
            Cancel
          </button>
          <AsyncButton className={primaryButton} disabled={saving} onClick={() => save()}>
            {saving ? "Saving…" : "Save"}
          </AsyncButton>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded border border-[#ea001e] bg-[#fff1f1] p-2 text-sm text-[#8e030f]">{error}</div>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Campaign Name" required>
            <input
              className={inputClass}
              value={values.name}
              onChange={(event) => setValues({ ...values, name: event.target.value })}
            />
          </Field>
          <Field label="Type">
            <select
              className={inputClass}
              value={values.type}
              onChange={(event) => setValues({ ...values, type: event.target.value })}
            >
              {["Email", "Event", "Webinar", "Advertising", "Direct Mail", "Referral", "Other"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
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
          <Field label="Parent Campaign">
            <LookupField
              field={parentCampaignLookupField}
              value={values.parentCampaignId}
              data={{ ...data, campaigns: data.campaigns.filter((campaign) => campaign.id !== initial?.id) }}
              inlineSelection
              onChange={(parentCampaignId) => setValues({ ...values, parentCampaignId })}
            />
          </Field>
          <Field label="Start Date">
            <input
              type="date"
              className={inputClass}
              value={values.startDate}
              onChange={(event) => setValues({ ...values, startDate: event.target.value })}
            />
          </Field>
          <Field label="End Date">
            <input
              type="date"
              className={inputClass}
              value={values.endDate}
              onChange={(event) => setValues({ ...values, endDate: event.target.value })}
            />
          </Field>
          <Field label="Budgeted Cost">
            <input
              type="number"
              min="0"
              step="0.01"
              className={inputClass}
              value={values.budgetedCost}
              onChange={(event) => setValues({ ...values, budgetedCost: event.target.value })}
            />
          </Field>
          <Field label="Actual Cost">
            <input
              type="number"
              min="0"
              step="0.01"
              className={inputClass}
              value={values.actualCost}
              onChange={(event) => setValues({ ...values, actualCost: event.target.value })}
            />
          </Field>
          <Field label="Expected Revenue">
            <input
              type="number"
              min="0"
              step="0.01"
              className={inputClass}
              value={values.expectedRevenue}
              onChange={(event) => setValues({ ...values, expectedRevenue: event.target.value })}
            />
          </Field>
          <div className="md:col-span-2">
            <Field label="Description">
              <textarea
                className={cn(inputClass, "min-h-28")}
                value={values.description}
                onChange={(event) => setValues({ ...values, description: event.target.value })}
              />
            </Field>
          </div>
        </div>
      </div>
    </Modal>
  );
}
