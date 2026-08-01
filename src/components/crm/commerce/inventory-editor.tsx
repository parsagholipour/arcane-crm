"use client";

import { useState } from "react";
import { type FieldDefinition, type ScopedCrmData } from "@/lib/crm-types";
import { AsyncButton } from "@/components/crm/AsyncButton";
import { LookupField } from "@/features/crm/form-controls";
import {
  type RecordData,
  type Mutation,
  text,
  id,
  json,
  Modal,
  secondary,
  primary,
  ErrorBox,
  Field,
  input
} from "@/components/crm/commerce/primitives";

const productLookupField: FieldDefinition = {
  name: "productId",
  label: "Product",
  section: "Inventory",
  type: "lookup",
  lookupObject: "Product2"
};

export function InventoryEditor({
  data,
  initial,
  initialStore,
  onClose,
  onSaved
}: {
  data: ScopedCrmData;
  initial?: RecordData;
  initialStore?: RecordData;
  onClose: () => void;
  onSaved: (result: Mutation) => void;
}) {
  const [values, setValues] = useState({
    storeId: text(initial?.storeId || initialStore?.id || data.stores[0]?.id),
    productId: text(initial?.productId),
    quantityOnHand: text(initial?.quantityOnHand || "0"),
    reorderPoint: text(initial?.reorderPoint || "0")
  });
  const [error, setError] = useState("");
  async function save() {
    try {
      const payload = await json(`/api/commerce/stores/${values.storeId}/inventory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values)
      });
      onSaved({ inventoryItem: payload.inventoryItem as RecordData });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update inventory.");
    }
  }
  return (
    <Modal
      title="Set Inventory"
      onClose={onClose}
      footer={
        <>
          <button className={secondary} onClick={onClose}>
            Cancel
          </button>
          <AsyncButton className={primary} onClick={() => save()}>
            Save
          </AsyncButton>
        </>
      }
    >
      <div className="space-y-3">
        {error && <ErrorBox value={error} />}
        <Field label="Store" required>
          <select
            className={input}
            disabled={Boolean(initial)}
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
        <Field label="Product" required>
          <LookupField
            field={productLookupField}
            disabled={Boolean(initial)}
            value={values.productId}
            data={data}
            inlineSelection
            onChange={(productId) => setValues({ ...values, productId })}
          />
        </Field>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Quantity on Hand">
            <input
              className={input}
              type="number"
              min="0"
              step="0.001"
              value={values.quantityOnHand}
              onChange={(event) => setValues({ ...values, quantityOnHand: event.target.value })}
            />
          </Field>
          <Field label="Reorder Point">
            <input
              className={input}
              type="number"
              min="0"
              step="0.001"
              value={values.reorderPoint}
              onChange={(event) => setValues({ ...values, reorderPoint: event.target.value })}
            />
          </Field>
        </div>
        {initial && (
          <div className="rounded bg-[#f8f9fb] p-3 text-xs text-[#706e6b]">
            Reserved: {text(initial.quantityReserved)}. On-hand quantity cannot be reduced below reserved stock.
          </div>
        )}
      </div>
    </Modal>
  );
}
