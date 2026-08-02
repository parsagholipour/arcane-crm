"use client";

import { useState } from "react";
import { type FieldDefinition, type ScopedCrmData, type RecordData } from "@/lib/crm-types";
import { cn } from "@/lib/utils";
import { AsyncButton } from "@/components/crm/AsyncButton";
import { text, json, id, Modal, secondary, primary, Field, input } from "@/components/crm/catalog/primitives";
import { LookupField } from "@/features/crm/form-controls";

const productLookupField: FieldDefinition = {
  name: "productId",
  label: "Product",
  section: "Price Book Entry",
  type: "lookup",
  lookupObject: "Product2"
};

export function ProductEditor({
  product,
  onClose,
  onSaved
}: {
  product: RecordData;
  onClose: () => void;
  onSaved: (record: RecordData) => void;
}) {
  const [values, setValues] = useState({
    name: text(product.name),
    family: text(product.family),
    productCode: text(product.productCode),
    sku: text(product.sku),
    category: text(product.category),
    active: Boolean(product.active),
    description: text(product.description)
  });
  const [error, setError] = useState("");
  async function save() {
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
      <div className="grid gap-3 md:grid-cols-2">
        {error && (
          <div className="rounded border border-[#ea001e] bg-[#fff1f1] p-2 text-sm text-[#8e030f] md:col-span-2">
            {error}
          </div>
        )}
        <Field label="Name">
          <input
            className={input}
            value={values.name}
            onChange={(event) => setValues({ ...values, name: event.target.value })}
          />
        </Field>
        <Field label="Family">
          <input
            className={input}
            value={values.family}
            onChange={(event) => setValues({ ...values, family: event.target.value })}
          />
        </Field>
        <Field label="Product Code">
          <input
            className={input}
            value={values.productCode}
            onChange={(event) => setValues({ ...values, productCode: event.target.value })}
          />
        </Field>
        <Field label="SKU">
          <input
            className={input}
            value={values.sku}
            onChange={(event) => setValues({ ...values, sku: event.target.value })}
          />
        </Field>
        <Field label="Category">
          <input
            className={input}
            value={values.category}
            onChange={(event) => setValues({ ...values, category: event.target.value })}
          />
        </Field>
        <label className="mt-6 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={values.active}
            onChange={(event) => setValues({ ...values, active: event.target.checked })}
          />{" "}
          Active
        </label>
        <div className="md:col-span-2">
          <Field label="Description">
            <textarea
              className={cn(input, "min-h-24")}
              value={values.description}
              onChange={(event) => setValues({ ...values, description: event.target.value })}
            />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
export function PriceBookEditor({
  priceBook,
  onClose,
  onSaved
}: {
  priceBook: RecordData;
  onClose: () => void;
  onSaved: (record: RecordData) => void;
}) {
  const [values, setValues] = useState({
    name: text(priceBook.name),
    active: Boolean(priceBook.active),
    description: text(priceBook.description),
    validFrom: text(priceBook.validFrom).slice(0, 10),
    validTo: text(priceBook.validTo).slice(0, 10)
  });
  const [error, setError] = useState("");
  async function save() {
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
        <Field label="Name">
          <input
            className={input}
            value={values.name}
            onChange={(event) => setValues({ ...values, name: event.target.value })}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={values.active}
            onChange={(event) => setValues({ ...values, active: event.target.checked })}
          />{" "}
          Active
        </label>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Valid From">
            <input
              className={input}
              type="date"
              value={values.validFrom}
              onChange={(event) => setValues({ ...values, validFrom: event.target.value })}
            />
          </Field>
          <Field label="Valid To">
            <input
              className={input}
              type="date"
              value={values.validTo}
              onChange={(event) => setValues({ ...values, validTo: event.target.value })}
            />
          </Field>
        </div>
        <Field label="Description">
          <textarea
            className={cn(input, "min-h-24")}
            value={values.description}
            onChange={(event) => setValues({ ...values, description: event.target.value })}
          />
        </Field>
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
        <Field label="Product">
          <LookupField
            field={productLookupField}
            disabled={Boolean(entry)}
            value={values.productId}
            data={data}
            inlineSelection
            onChange={(productId) => setValues({ ...values, productId })}
          />
        </Field>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="List Price">
            <input
              className={input}
              type="number"
              min="0"
              step="0.01"
              value={values.listPrice}
              onChange={(event) => setValues({ ...values, listPrice: event.target.value })}
            />
          </Field>
          <Field label="Currency">
            <select
              className={input}
              disabled={Boolean(entry)}
              value={values.currency}
              onChange={(event) => setValues({ ...values, currency: event.target.value })}
            >
              {["USD", "AED", "EUR", "GBP"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
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
