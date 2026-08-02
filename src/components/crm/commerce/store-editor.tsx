"use client";

import { useMemo, useState } from "react";
import { type FieldDefinition, type ScopedCrmData } from "@/lib/crm-types";
import { cn, slugify } from "@/lib/utils";
import { AsyncButton } from "@/components/crm/AsyncButton";
import { LookupField } from "@/features/crm/form-controls";
import {
  type RecordData,
  type Mutation,
  text,
  json,
  id,
  Modal,
  secondary,
  primary,
  ErrorBox,
  Field,
  input
} from "@/components/crm/commerce/primitives";

const priceBookLookupField: FieldDefinition = {
  name: "priceBookId",
  label: "Price Book",
  section: "Store Details",
  type: "lookup",
  lookupObject: "Pricebook2"
};

export function StoreEditor({
  data,
  initial,
  onClose,
  onSaved
}: {
  data: ScopedCrmData;
  initial?: RecordData;
  onClose: () => void;
  onSaved: (result: Mutation) => void;
}) {
  const [values, setValues] = useState({
    name: text(initial?.name),
    slug: text(initial?.slug),
    currency: text(initial?.currency) || "USD",
    description: text(initial?.description),
    priceBookId: text(initial?.priceBookId)
  });
  const [slugManual, setSlugManual] = useState(Boolean(text(initial?.slug)));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const snapshot = useMemo(() => JSON.stringify(values), []); // eslint-disable-line react-hooks/exhaustive-deps
  function close() {
    if (snapshot === JSON.stringify(values) || window.confirm("Discard unsaved store changes?")) onClose();
  }
  async function save() {
    setSaving(true);
    setError("");
    try {
      const payload = await json(initial ? `/api/commerce/stores/${id(initial)}` : "/api/commerce/stores", {
        method: initial ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values)
      });
      onSaved(payload as Mutation);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save store.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal
      title={initial ? `Edit ${text(initial.name)}` : "New Store"}
      onClose={close}
      onEnterAction={save}
      footer={
        <>
          <button className={secondary} onClick={close}>
            Cancel
          </button>
          <AsyncButton className={primary} disabled={saving} onClick={() => save()}>
            {saving ? "Saving…" : "Save"}
          </AsyncButton>
        </>
      }
    >
      <div className="space-y-4">
        {error && <ErrorBox value={error} />}
        <Field label="Store Name" required>
          <input
            className={input}
            value={values.name}
            onChange={(event) => {
              const name = event.target.value;
              setValues({ ...values, name, slug: slugManual ? values.slug : slugify(name) });
            }}
          />
        </Field>
        <Field label="URL Slug">
          <input
            className={input}
            value={values.slug}
            placeholder="Generated from the name"
            onChange={(event) => {
              setSlugManual(true);
              setValues({ ...values, slug: slugify(event.target.value) });
            }}
          />
        </Field>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Currency">
            <select
              className={input}
              value={values.currency}
              onChange={(event) => setValues({ ...values, currency: event.target.value })}
            >
              {["USD", "AED", "EUR", "GBP"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </Field>
          <Field label="Price Book">
            <LookupField
              field={priceBookLookupField}
              value={values.priceBookId}
              data={data}
              options={data.priceBooks.map((book) => ({
                id: id(book),
                label: `${text(book.name)}${book.active ? "" : " (Inactive)"}`
              }))}
              inlineSelection
              onChange={(priceBookId) => setValues({ ...values, priceBookId })}
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
