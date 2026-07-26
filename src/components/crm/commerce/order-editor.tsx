"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { type ScopedCrmData } from "@/lib/crm-types";
import { cn } from "@/lib/utils";
import { AsyncButton } from "@/components/crm/AsyncButton";
import {
  type RecordData,
  type Mutation,
  records,
  text,
  id,
  json,
  Modal,
  secondary,
  primary,
  ErrorBox,
  Field,
  input,
  contactName,
  Panel,
  Empty,
  money
} from "@/components/crm/commerce/primitives";

export type OrderLineDraft = {
  productId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discountAmount: string;
  taxRate: string;
};
export function OrderEditor({
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
  const initialLines = records(initial?.lines).map((line) => ({
    productId: text(line.productId),
    description: text(line.description),
    quantity: text(line.quantity),
    unitPrice: text(line.unitPrice),
    discountAmount: text(line.discountAmount),
    taxRate: text(line.taxRate)
  }));
  const [values, setValues] = useState({
    storeId: text(initial?.storeId) || text(data.stores.find((store) => store.status === "Active")?.id),
    accountId: text(initial?.accountId),
    contactId: text(initial?.contactId),
    purchaseOrderNumber: text(initial?.purchaseOrderNumber),
    promotionCode: text(
      records(initial?.promotions)[0]?.promotion ? (records(initial?.promotions)[0].promotion as RecordData).code : ""
    ),
    shippingTotal: text(initial?.shippingTotal) || "0",
    shippingName: text(initial?.shippingName),
    shippingStreet: text(initial?.shippingStreet),
    shippingCity: text(initial?.shippingCity),
    shippingState: text(initial?.shippingState),
    shippingPostalCode: text(initial?.shippingPostalCode),
    shippingCountry: text(initial?.shippingCountry),
    notes: text(initial?.notes)
  });
  const [lines, setLines] = useState<OrderLineDraft[]>(initialLines.length ? initialLines : []);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const snapshot = useMemo(() => JSON.stringify({ values, lines }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const store = data.stores.find((item) => item.id === values.storeId);
  const contacts = data.contacts.filter((contact) => !values.accountId || contact.accountId === values.accountId);
  const entries = data.priceBookEntries.filter(
    (entry) => !store?.priceBookId || entry.priceBookId === store.priceBookId
  );
  function close() {
    if (snapshot === JSON.stringify({ values, lines }) || window.confirm("Discard unsaved order changes?")) onClose();
  }
  function updateLine(index: number, patch: Partial<OrderLineDraft>) {
    setLines((current) => current.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)));
  }
  function chooseProduct(index: number, productId: string) {
    const product = data.products.find((item) => item.id === productId);
    const entry = entries.find((item) => item.productId === productId && item.active);
    updateLine(index, {
      productId,
      description: text(product?.description || product?.name),
      unitPrice: text(entry?.listPrice || "0")
    });
  }
  const preview = lines.reduce(
    (totals, line) => {
      const subtotal = Math.max(0, Number(line.quantity || 0) * Number(line.unitPrice || 0));
      const discount = Math.min(subtotal, Math.max(0, Number(line.discountAmount || 0)));
      const tax = ((subtotal - discount) * Math.max(0, Number(line.taxRate || 0))) / 100;
      return {
        subtotal: totals.subtotal + subtotal,
        discount: totals.discount + discount,
        tax: totals.tax + tax,
        total: totals.total + subtotal - discount + tax
      };
    },
    { subtotal: 0, discount: 0, tax: 0, total: Number(values.shippingTotal || 0) }
  );
  async function save() {
    setSaving(true);
    setError("");
    try {
      const payload = await json(initial ? `/api/commerce/orders/${id(initial)}` : "/api/commerce/orders", {
        method: initial ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, currency: store?.currency || "USD", lineItems: lines })
      });
      onSaved(initial ? { order: payload.order as RecordData } : (payload as Mutation));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save order.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal
      title={initial ? `Edit ${text(initial.orderNumber)}` : "New Draft Order"}
      onClose={close}
      wide
      footer={
        <>
          <button className={secondary} onClick={close}>
            Cancel
          </button>
          <AsyncButton className={primary} disabled={saving} onClick={() => save()}>
            {saving ? "Saving…" : "Save Draft"}
          </AsyncButton>
        </>
      }
    >
      <div className="space-y-4">
        {error && <ErrorBox value={error} />}
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Store" required>
            <select
              className={input}
              value={values.storeId}
              onChange={(event) => setValues({ ...values, storeId: event.target.value })}
            >
              <option value="">Choose Store</option>
              {data.stores
                .filter((item) => item.status !== "Archived")
                .map((item) => (
                  <option key={id(item)} value={id(item)}>
                    {text(item.name)} ({text(item.status)})
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Account" required>
            <select
              className={input}
              value={values.accountId}
              onChange={(event) => setValues({ ...values, accountId: event.target.value, contactId: "" })}
            >
              <option value="">Choose Account</option>
              {data.accounts.map((account) => (
                <option key={id(account)} value={id(account)}>
                  {text(account.name)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Contact">
            <select
              className={input}
              value={values.contactId}
              onChange={(event) => setValues({ ...values, contactId: event.target.value })}
            >
              <option value="">No Contact</option>
              {contacts.map((contact) => (
                <option key={id(contact)} value={id(contact)}>
                  {contactName(contact)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Purchase Order Number">
            <input
              className={input}
              value={values.purchaseOrderNumber}
              onChange={(event) => setValues({ ...values, purchaseOrderNumber: event.target.value })}
            />
          </Field>
          <Field label="Promotion Code">
            <input
              className={input}
              value={values.promotionCode}
              onChange={(event) => setValues({ ...values, promotionCode: event.target.value.toUpperCase() })}
            />
          </Field>
          <Field label="Shipping Total">
            <input
              className={input}
              type="number"
              min="0"
              step="0.01"
              value={values.shippingTotal}
              onChange={(event) => setValues({ ...values, shippingTotal: event.target.value })}
            />
          </Field>
        </div>
        <Panel
          title="Line Items"
          action={
            <button
              className={secondary}
              onClick={() =>
                setLines((current) => [
                  ...current,
                  { productId: "", description: "", quantity: "1", unitPrice: "0", discountAmount: "0", taxRate: "0" }
                ])
              }
            >
              <Plus size={12} /> Add Line
            </button>
          }
        >
          <div className="space-y-3">
            {lines.map((line, index) => (
              <div
                key={index}
                className="grid gap-2 rounded border border-[#d8dde6] p-3 md:grid-cols-[1.4fr_2fr_.7fr_.8fr_.8fr_.7fr_auto]"
              >
                <Field label="Product">
                  <select
                    className={input}
                    value={line.productId}
                    onChange={(event) => chooseProduct(index, event.target.value)}
                  >
                    <option value="">Choose Product</option>
                    {data.products.map((product) => (
                      <option key={id(product)} value={id(product)}>
                        {text(product.name)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Description">
                  <input
                    className={input}
                    value={line.description}
                    onChange={(event) => updateLine(index, { description: event.target.value })}
                  />
                </Field>
                <Field label="Qty">
                  <input
                    className={input}
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={line.quantity}
                    onChange={(event) => updateLine(index, { quantity: event.target.value })}
                  />
                </Field>
                <Field label="Unit Price">
                  <input
                    className={input}
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unitPrice}
                    onChange={(event) => updateLine(index, { unitPrice: event.target.value })}
                  />
                </Field>
                <Field label="Discount">
                  <input
                    className={input}
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.discountAmount}
                    onChange={(event) => updateLine(index, { discountAmount: event.target.value })}
                  />
                </Field>
                <Field label="Tax %">
                  <input
                    className={input}
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={line.taxRate}
                    onChange={(event) => updateLine(index, { taxRate: event.target.value })}
                  />
                </Field>
                <button
                  aria-label="Remove line"
                  className="mt-6 rounded p-2 text-[#ba0517] hover:bg-[#fff1f1]"
                  onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {!lines.length && (
              <Empty text="You may save an incomplete Draft. At least one valid line is required before confirmation." />
            )}
          </div>
        </Panel>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Shipping Name">
              <input
                className={input}
                value={values.shippingName}
                onChange={(event) => setValues({ ...values, shippingName: event.target.value })}
              />
            </Field>
            <Field label="Street">
              <input
                className={input}
                value={values.shippingStreet}
                onChange={(event) => setValues({ ...values, shippingStreet: event.target.value })}
              />
            </Field>
            <Field label="City">
              <input
                className={input}
                value={values.shippingCity}
                onChange={(event) => setValues({ ...values, shippingCity: event.target.value })}
              />
            </Field>
            <Field label="State">
              <input
                className={input}
                value={values.shippingState}
                onChange={(event) => setValues({ ...values, shippingState: event.target.value })}
              />
            </Field>
            <Field label="Postal Code">
              <input
                className={input}
                value={values.shippingPostalCode}
                onChange={(event) => setValues({ ...values, shippingPostalCode: event.target.value })}
              />
            </Field>
            <Field label="Country">
              <input
                className={input}
                value={values.shippingCountry}
                onChange={(event) => setValues({ ...values, shippingCountry: event.target.value })}
              />
            </Field>
          </div>
          <div>
            <Field label="Notes">
              <textarea
                className={cn(input, "min-h-24")}
                value={values.notes}
                onChange={(event) => setValues({ ...values, notes: event.target.value })}
              />
            </Field>
            <div className="mt-3 rounded bg-[#f8f9fb] p-3 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{money(preview.subtotal, text(store?.currency) || "USD")}</span>
              </div>
              <div className="flex justify-between">
                <span>Line discounts</span>
                <span>-{money(preview.discount, text(store?.currency) || "USD")}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax</span>
                <span>{money(preview.tax, text(store?.currency) || "USD")}</span>
              </div>
              <div className="mt-2 flex justify-between border-t pt-2 font-semibold">
                <span>Preview total</span>
                <span>{money(preview.total, text(store?.currency) || "USD")}</span>
              </div>
              <div className="mt-1 text-xs text-[#706e6b]">
                Promotion validation and final totals are calculated by the server.
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
