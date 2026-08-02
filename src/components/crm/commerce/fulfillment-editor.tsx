"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { COURIER } from "@/lib/crm-metadata/options";
import { AsyncButton } from "@/components/crm/AsyncButton";
import {
  type RecordData,
  type Mutation,
  json,
  id,
  Modal,
  text,
  secondary,
  primary,
  ErrorBox,
  Field,
  input
} from "@/components/crm/commerce/primitives";

export function FulfillmentEditor({
  order,
  onClose,
  onSaved
}: {
  order: RecordData;
  onClose: () => void;
  onSaved: (result: Mutation) => void;
}) {
  const [values, setValues] = useState({ status: "Shipped", carrier: "", trackingNumber: "", notes: "" });
  const [error, setError] = useState("");
  async function save() {
    try {
      const payload = await json(`/api/commerce/orders/${id(order)}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "fulfill", ...values })
      });
      onSaved(payload as Mutation);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to record fulfillment.");
    }
  }
  return (
    <Modal
      title={`Fulfill ${text(order.orderNumber)}`}
      onClose={onClose}
      onEnterAction={save}
      footer={
        <>
          <button className={secondary} onClick={onClose}>
            Cancel
          </button>
          <AsyncButton className={primary} onClick={() => save()}>
            Record Fulfillment
          </AsyncButton>
        </>
      }
    >
      <div className="space-y-3">
        {error && <ErrorBox value={error} />}
        <p className="text-sm text-[#706e6b]">
          This records an external packing or shipment event for all remaining quantities. USPS tracking numbers are
          checked automatically, and you are notified when the package is delivered.
        </p>
        <Field label="Fulfillment State">
          <select
            className={input}
            value={values.status}
            onChange={(event) => setValues({ ...values, status: event.target.value })}
          >
            <option>Packed</option>
            <option>Shipped</option>
          </select>
        </Field>
        <Field label="Carrier">
          <select
            className={input}
            value={values.carrier}
            onChange={(event) => setValues({ ...values, carrier: event.target.value })}
          >
            {COURIER.map((courier) => (
              <option key={courier} value={courier === "--None--" ? "" : courier}>
                {courier}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tracking Number">
          <input
            className={input}
            value={values.trackingNumber}
            onChange={(event) => setValues({ ...values, trackingNumber: event.target.value })}
          />
        </Field>
        <Field label="Notes">
          <textarea
            className={cn(input, "min-h-20")}
            value={values.notes}
            onChange={(event) => setValues({ ...values, notes: event.target.value })}
          />
        </Field>
      </div>
    </Modal>
  );
}
