"use client";

import { useState } from "react";
import { FORM_DEFINITIONS } from "@/lib/crm-metadata";
import { type FieldDefinition, type ScopedCrmData, type RecordData } from "@/lib/crm-types";
import { AsyncButton } from "@/components/crm/AsyncButton";
import { text, json, id, Modal, secondary, primary } from "@/components/crm/catalog/primitives";
import { FormFields, LookupField, picklistOptionsForField } from "@/features/crm/form-controls";
import { buildInitialValues, validateFields } from "@/features/crm/form-model";

const productLookupField: FieldDefinition = {
  name: "productId",
  label: "Product",
  section: "Price Book Entry",
  type: "lookup",
  lookupObject: "Product2"
};

export function ProductEditor({
  product,
  data,
  onClose,
  onSaved
}: {
  product: RecordData;
  data: ScopedCrmData;
  onClose: () => void;
  onSaved: (record: RecordData) => void;
}) {
  const definition = FORM_DEFINITIONS.Product2;
  const fields = definition?.fields ?? [];
  const [values, setValues] = useState<RecordData>(() =>
    definition ? buildInitialValues(definition, product, data.user.id) : { ...product }
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  async function save() {
    const nextErrors = validateFields(fields, values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    try {
      const payload = await json(`/api/records/Product2/${id(product)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values)
      });
      onSaved(payload.record as RecordData);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save Product.");
    }
  }
  return (
    <Modal
      title={`Edit ${text(product.name)}`}
      onClose={onClose}
      onEnterAction={save}
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
        {error && (
          <div className="rounded border border-[#ea001e] bg-[#fff1f1] p-2 text-sm text-[#8e030f]">{error}</div>
        )}
        <FormFields
          fields={fields}
          values={values}
          errors={errors}
          data={data}
          onChange={(name, value) =>
            setValues((current) => {
              const next = { ...current, [name]: value };
              for (const field of fields) {
                if (field.dependsOn === name) {
                  const options = picklistOptionsForField(field, next);
                  const currentDependent = String(next[field.name] ?? "--None--");
                  if (!options.includes(currentDependent)) next[field.name] = "--None--";
                }
              }
              return next;
            })
          }
        />
      </div>
    </Modal>
  );
}

export function PriceBookEditor({
  priceBook,
  data,
  onClose,
  onSaved
}: {
  priceBook: RecordData;
  data: ScopedCrmData;
  onClose: () => void;
  onSaved: (record: RecordData) => void;
}) {
  const definition = FORM_DEFINITIONS.Pricebook2;
  const fields = definition?.fields ?? [];
  const [values, setValues] = useState<RecordData>(() =>
    definition ? buildInitialValues(definition, priceBook, data.user.id) : { ...priceBook }
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  async function save() {
    const nextErrors = validateFields(fields, values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    try {
      const payload = await json(`/api/records/Pricebook2/${id(priceBook)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values)
      });
      onSaved(payload.record as RecordData);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save Price Book.");
    }
  }
  return (
    <Modal
      title={`Edit ${text(priceBook.name)}`}
      onClose={onClose}
      onEnterAction={save}
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
        {error && (
          <div className="rounded border border-[#ea001e] bg-[#fff1f1] p-2 text-sm text-[#8e030f]">{error}</div>
        )}
        <FormFields
          fields={fields}
          values={values}
          errors={errors}
          data={data}
          onChange={(name, value) =>
            setValues((current) => {
              const next = { ...current, [name]: value };
              for (const field of fields) {
                if (field.dependsOn === name) {
                  const options = picklistOptionsForField(field, next);
                  const currentDependent = String(next[field.name] ?? "--None--");
                  if (!options.includes(currentDependent)) next[field.name] = "--None--";
                }
              }
              return next;
            })
          }
        />
      </div>
    </Modal>
  );
}

export function EntryEditor({
  priceBook,
  data,
  entry,
  onClose,
  onSaved
}: {
  priceBook: RecordData;
  data: ScopedCrmData;
  entry?: RecordData;
  onClose: () => void;
  onSaved: (record: RecordData) => void;
}) {
  const entryProduct = entry?.product as RecordData | undefined;
  const [values, setValues] = useState({
    productId: text(entry?.productId),
    listPrice: text(entry?.listPrice),
    currency: text(entry?.currency) || "USD",
    active: entry?.active !== false
  });
  const [error, setError] = useState("");
  async function save() {
    try {
      const payload = await json(
        entry ? `/api/price-books/${id(priceBook)}/entries/${id(entry)}` : `/api/price-books/${id(priceBook)}/entries`,
        {
          method: entry ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values)
        }
      );
      onSaved(payload.entry as RecordData);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save entry.");
    }
  }
  return (
    <Modal
      title={entry ? "Edit Price Book Entry" : "Add Product to Price Book"}
      onClose={onClose}
      onEnterAction={save}
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
        {error && (
          <div className="rounded border border-[#ea001e] bg-[#fff1f1] p-2 text-sm text-[#8e030f]">{error}</div>
        )}
        <div className="text-sm font-semibold text-[#3e3e3c]">Product</div>
        <LookupField
          field={productLookupField}
          disabled={Boolean(entry)}
          value={values.productId}
          selectedLabel={text(entryProduct?.name) || undefined}
          data={data}
          inlineSelection
          onChange={(productId) => setValues({ ...values, productId })}
        />
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">List Price</span>
            <input
              className="min-h-9 w-full rounded border border-[#c9c9c9] bg-white px-3 py-2 text-sm outline-none focus:border-[#0176d3] focus:ring-2 focus:ring-[#0176d3]/20"
              type="number"
              min="0"
              step="0.01"
              value={values.listPrice}
              onChange={(event) => setValues({ ...values, listPrice: event.target.value })}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Currency</span>
            <select
              className="min-h-9 w-full rounded border border-[#c9c9c9] bg-white px-3 py-2 text-sm outline-none focus:border-[#0176d3] focus:ring-2 focus:ring-[#0176d3]/20 disabled:bg-[#f3f3f3]"
              disabled={Boolean(entry)}
              value={values.currency}
              onChange={(event) => setValues({ ...values, currency: event.target.value })}
            >
              {Array.from(new Set(["USD", "AED", "EUR", "GBP", values.currency].filter(Boolean))).map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="mt-2 flex items-center gap-2 text-sm">
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
