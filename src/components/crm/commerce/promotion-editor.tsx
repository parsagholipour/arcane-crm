"use client";

import { useState } from "react";
import { type ScopedCrmData } from "@/lib/crm-types";
import { AsyncButton } from "@/components/crm/AsyncButton";
import {
  type Mutation,
  text,
  id,
  json,
  type RecordData,
  Modal,
  secondary,
  primary,
  ErrorBox,
  Field,
  input
} from "@/components/crm/commerce/primitives";

export function PromotionEditor({
  data,
  onClose,
  onSaved
}: {
  data: ScopedCrmData;
  onClose: () => void;
  onSaved: (result: Mutation) => void;
}) {
  const [values, setValues] = useState({
    storeId: text(data.stores[0]?.id),
    name: "",
    code: "",
    type: "Percentage",
    value: "10",
    minimumOrderAmount: "",
    startsAt: "",
    endsAt: "",
    maxRedemptions: "",
    active: true
  });
  const [error, setError] = useState("");
  async function save() {
    try {
      const payload = await json(`/api/commerce/stores/${values.storeId}/promotions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values)
      });
      onSaved({ promotion: payload.promotion as RecordData });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to create promotion.");
    }
  }
  return (
    <Modal
      title="New Promotion"
      onClose={onClose}
      footer={
        <>
          <button className={secondary} onClick={onClose}>
            Cancel
          </button>
          <AsyncButton className={primary} onClick={() => save()}>
            Create
          </AsyncButton>
        </>
      }
    >
      <div className="space-y-3">
        {error && <ErrorBox value={error} />}
        <Field label="Store" required>
          <select
            className={input}
            value={values.storeId}
            onChange={(event) => setValues({ ...values, storeId: event.target.value })}
          >
            {data.stores.map((store) => (
              <option key={id(store)} value={id(store)}>
                {text(store.name)}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Promotion Name" required>
            <input
              className={input}
              value={values.name}
              onChange={(event) => setValues({ ...values, name: event.target.value })}
            />
          </Field>
          <Field label="Code" required>
            <input
              className={input}
              value={values.code}
              onChange={(event) => setValues({ ...values, code: event.target.value.toUpperCase() })}
            />
          </Field>
          <Field label="Type">
            <select
              className={input}
              value={values.type}
              onChange={(event) => setValues({ ...values, type: event.target.value })}
            >
              <option>Percentage</option>
              <option>Fixed Amount</option>
            </select>
          </Field>
          <Field label="Value">
            <input
              className={input}
              type="number"
              min="0.01"
              step="0.01"
              value={values.value}
              onChange={(event) => setValues({ ...values, value: event.target.value })}
            />
          </Field>
          <Field label="Minimum Order">
            <input
              className={input}
              type="number"
              min="0"
              step="0.01"
              value={values.minimumOrderAmount}
              onChange={(event) => setValues({ ...values, minimumOrderAmount: event.target.value })}
            />
          </Field>
          <Field label="Maximum Redemptions">
            <input
              className={input}
              type="number"
              min="1"
              step="1"
              value={values.maxRedemptions}
              onChange={(event) => setValues({ ...values, maxRedemptions: event.target.value })}
            />
          </Field>
          <Field label="Starts">
            <input
              className={input}
              type="date"
              value={values.startsAt}
              onChange={(event) => setValues({ ...values, startsAt: event.target.value })}
            />
          </Field>
          <Field label="Ends">
            <input
              className={input}
              type="date"
              value={values.endsAt}
              onChange={(event) => setValues({ ...values, endsAt: event.target.value })}
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={values.active}
            onChange={(event) => setValues({ ...values, active: event.target.checked })}
          />{" "}
          Active
        </label>
      </div>
    </Modal>
  );
}
