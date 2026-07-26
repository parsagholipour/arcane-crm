"use client";

import { useState } from "react";
import { FORM_DEFINITIONS, PRODUCT_FAMILY } from "@/lib/crm-metadata";
import { recordTitle } from "@/lib/crm-data";
import { type ScopedCrmData, type CrmObject, type RecordData } from "@/lib/crm-types";
import { cn } from "@/lib/utils";
import { BaseDialog, Button } from "@/components/ui/crm-primitives";
import { FieldShell, inputClass, NativeSelect, RadixCheckbox } from "@/features/crm/controls";
import { FormFields, picklistOptionsForField } from "@/features/crm/form-controls";
import { buildInitialValues, recordDataShallowEqual, validateFields } from "@/features/crm/form-model";

export function UnsavedChangesDialog({
  onKeepEditing,
  onDiscard
}: {
  onKeepEditing: () => void;
  onDiscard: () => void;
}) {
  return (
    <BaseDialog
      open
      title="Discard changes?"
      onClose={onKeepEditing}
      footer={
        <>
          <Button onClick={onKeepEditing}>Keep Editing</Button>
          <Button variant="destructive" onClick={onDiscard}>
            Discard
          </Button>
        </>
      }
    >
      <p className="text-sm text-[#3e3e3c]">You have unsaved changes. Discard them and close this window?</p>
    </BaseDialog>
  );
}
export function useUnsavedChangesGuard(isDirty: boolean, onClose: () => void) {
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  function requestClose() {
    if (isDirty) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  }
  const discardDialog = confirmDiscard ? (
    <UnsavedChangesDialog onKeepEditing={() => setConfirmDiscard(false)} onDiscard={onClose} />
  ) : null;
  return { requestClose, discardDialog };
}
export function GenericRecordModal({
  mode,
  object,
  data,
  record,
  onClose,
  onSave
}: {
  mode: "new" | "edit";
  object: CrmObject;
  data: ScopedCrmData;
  record?: RecordData;
  onClose: () => void;
  onSave: (values: RecordData, stayOpen?: boolean) => Promise<boolean>;
}) {
  const definition = FORM_DEFINITIONS[object];
  const [initialValues, setInitialValues] = useState<RecordData>(() =>
    definition ? buildInitialValues(definition, record, data.user.id) : {}
  );
  const [values, setValues] = useState<RecordData>(() => initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isDirty = !recordDataShallowEqual(values, initialValues);
  const { requestClose, discardDialog } = useUnsavedChangesGuard(isDirty, onClose);

  if (!definition) return null;

  const formDefinition = definition;
  const title = mode === "edit" && record ? `Edit ${recordTitle(object, record)}` : formDefinition.title;

  async function submit(stayOpen = false) {
    const nextErrors = validateFields(formDefinition.fields, values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    const ok = await onSave(values, stayOpen);
    if (ok && stayOpen) {
      const nextInitialValues = buildInitialValues(formDefinition, undefined, data.user.id);
      setInitialValues(nextInitialValues);
      setValues(nextInitialValues);
      setErrors({});
    }
  }

  if (discardDialog) return discardDialog;

  return (
    <BaseDialog
      open
      title={title}
      onClose={requestClose}
      wide
      footer={
        <>
          <Button onClick={requestClose}>Cancel</Button>
          {mode === "new" && <Button onClick={() => submit(true)}>Save & New</Button>}
          <Button variant="primary" onClick={() => submit(false)}>
            Save
          </Button>
        </>
      }
    >
      <div className="mb-4 text-xs text-[#706e6b]">
        <span className="text-[#ba0517]">*</span> = Required Information
      </div>
      <FormFields
        fields={formDefinition.fields}
        values={values}
        errors={errors}
        data={data}
        onChange={(name, value) =>
          setValues((current) => {
            const next = { ...current, [name]: value };
            for (const field of formDefinition.fields) {
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
    </BaseDialog>
  );
}
export function ProductWizardModal({
  data,
  onClose,
  onSave
}: {
  data: ScopedCrmData;
  onClose: () => void;
  onSave: (values: RecordData) => Promise<boolean>;
}) {
  const [step, setStep] = useState(1);
  const [initialValues] = useState<RecordData>(() => ({
    active: false,
    family: "--None--",
    currency: "USD",
    createPriceBookEntry: true,
    priceBookId: data.priceBooks[0]?.id ?? "",
    priceBookName: data.priceBooks[0]?.name ?? "Standard Price Book",
    entryActive: true
  }));
  const [values, setValues] = useState<RecordData>(() => initialValues);
  const [error, setError] = useState("");
  const [entryError, setEntryError] = useState("");
  const isDirty = !recordDataShallowEqual(values, initialValues);
  const { requestClose, discardDialog } = useUnsavedChangesGuard(isDirty, onClose);
  async function finish() {
    if (values.createPriceBookEntry !== false && !values.listPrice) {
      setEntryError("Complete this field.");
      return;
    }
    setEntryError("");
    const ok = await onSave(values);
    if (ok) onClose();
  }
  if (discardDialog) return discardDialog;
  return (
    <BaseDialog
      open
      title="New Product"
      onClose={requestClose}
      wide
      footer={
        step === 1 ? (
          <>
            <Button onClick={requestClose}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!values.name) setError("Complete this field.");
                else {
                  setError("");
                  setStep(2);
                }
              }}
            >
              Next
            </Button>
          </>
        ) : (
          <>
            <Button onClick={() => setStep(1)}>Back</Button>
            <Button variant="primary" onClick={() => finish()}>
              Finish
            </Button>
          </>
        )
      }
    >
      <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
        <div className={cn("rounded border p-2", step === 1 ? "border-brand-500 bg-brand-50" : "border-[#d8dde6]")}>
          New Product - {step === 1 ? "Current Stage" : "Complete"}
        </div>
        <div className={cn("rounded border p-2", step === 2 ? "border-brand-500 bg-brand-50" : "border-[#d8dde6]")}>
          New Price Book Entry - {step === 2 ? "Current Stage" : "Stage Not Started"}
        </div>
      </div>
      <div className="mb-4 text-xs text-[#706e6b]">Progress: {step === 1 ? "0%" : "50%"}</div>
      {step === 1 ? (
        <div className="grid gap-3 md:grid-cols-2">
          <FieldShell label="Product Name" required error={error}>
            <input
              className={inputClass}
              value={String(values.name ?? "")}
              onChange={(event) => setValues({ ...values, name: event.target.value })}
            />
          </FieldShell>
          <FieldShell label="Product Family">
            <NativeSelect
              options={PRODUCT_FAMILY}
              value={String(values.family ?? "--None--")}
              onChange={(value) => setValues({ ...values, family: value })}
            />
          </FieldShell>
          <FieldShell label="Product Code">
            <input
              className={inputClass}
              value={String(values.productCode ?? "")}
              onChange={(event) => setValues({ ...values, productCode: event.target.value })}
            />
          </FieldShell>
          <FieldShell label="Product SKU">
            <input
              className={inputClass}
              value={String(values.sku ?? "")}
              onChange={(event) => setValues({ ...values, sku: event.target.value })}
            />
          </FieldShell>
          <FieldShell label="Active">
            <RadixCheckbox
              checked={Boolean(values.active)}
              onCheckedChange={(value) => setValues({ ...values, active: Boolean(value) })}
            />
          </FieldShell>
          <FieldShell label="Product Description">
            <textarea
              className={inputClass}
              value={String(values.description ?? "")}
              onChange={(event) => setValues({ ...values, description: event.target.value })}
            />
          </FieldShell>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <FieldShell label="Create Price Book Entry">
            <RadixCheckbox
              checked={values.createPriceBookEntry !== false}
              onCheckedChange={(value) => setValues({ ...values, createPriceBookEntry: Boolean(value) })}
            />
          </FieldShell>
          <FieldShell label="Price Book">
            <NativeSelect
              options={[
                ...(data.priceBooks.length
                  ? data.priceBooks.map((book) => String(book.name))
                  : ["Standard Price Book"]),
                "New Standard Price Book"
              ]}
              value={String(values.priceBookName ?? "Standard Price Book")}
              onChange={(value) => {
                const selected = data.priceBooks.find((book) => book.name === value);
                setValues({ ...values, priceBookName: value, priceBookId: selected?.id ?? "" });
              }}
            />
          </FieldShell>
          <FieldShell label="List Price" required={values.createPriceBookEntry !== false} error={entryError}>
            <input
              className={inputClass}
              type="number"
              min="0"
              step="0.01"
              value={String(values.listPrice ?? "")}
              onChange={(event) => setValues({ ...values, listPrice: event.target.value })}
            />
          </FieldShell>
          <FieldShell label="Currency">
            <NativeSelect
              options={["USD", "AED", "EUR", "GBP"]}
              value={String(values.currency ?? "USD")}
              onChange={(value) => setValues({ ...values, currency: value })}
            />
          </FieldShell>
          <FieldShell label="Active">
            <RadixCheckbox
              checked={Boolean(values.entryActive)}
              onCheckedChange={(value) => setValues({ ...values, entryActive: Boolean(value) })}
            />
          </FieldShell>
          <div className="rounded border border-[#d8dde6] bg-[#f8f8f8] p-3 text-sm text-[#706e6b] md:col-span-2">
            Finish creates the product and{" "}
            {values.createPriceBookEntry === false
              ? "skips price book entry creation."
              : "adds it to the selected price book."}
          </div>
        </div>
      )}
    </BaseDialog>
  );
}
