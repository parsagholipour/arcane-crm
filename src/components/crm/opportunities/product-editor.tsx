"use client";

import { useState } from "react";
import { type FieldDefinition, type ScopedCrmData, type RecordData } from "@/lib/crm-types";
import { ApiError, apiRequest, jsonBody } from "@/lib/api/client";
import { BaseDialog, Button } from "@/components/ui/crm-primitives";
import { FieldShell, inputClass } from "@/features/crm/controls";
import { LookupField } from "@/features/crm/form-controls";
import { id, money, text } from "@/components/crm/record-details/primitives";

const productLookupField: FieldDefinition = {
  name: "productId",
  label: "Product",
  section: "Opportunity Product",
  type: "lookup",
  lookupObject: "Product2"
};

function dateAllowsPrice(value: unknown, boundary: "from" | "to", now: number) {
  if (!value) return true;
  const timestamp = new Date(String(value)).getTime();
  if (!Number.isFinite(timestamp)) return false;
  return boundary === "from" ? timestamp <= now : timestamp >= now;
}

/** Active USD price from the standard valid price book, falling back to the catalogue price. */
export function suggestedSalesPrice(product: RecordData | undefined, entries: RecordData[], now = Date.now()) {
  const productId = text(product?.id);
  const candidates = entries
    .filter((entry) => {
      const priceBook = entry.priceBook as RecordData | undefined;
      return (
        text(entry.productId) === productId &&
        entry.active === true &&
        text(entry.currency || "USD").toUpperCase() === "USD" &&
        text(entry.listPrice) !== "" &&
        priceBook?.active === true &&
        dateAllowsPrice(priceBook.validFrom, "from", now) &&
        dateAllowsPrice(priceBook.validTo, "to", now)
      );
    })
    .sort((left, right) => {
      const leftBook = left.priceBook as RecordData | undefined;
      const rightBook = right.priceBook as RecordData | undefined;
      const standardDifference = Number(rightBook?.isStandard === true) - Number(leftBook?.isStandard === true);
      if (standardDifference) return standardDifference;
      return text(left.id).localeCompare(text(right.id));
    });
  const candidate = text(candidates[0]?.listPrice) || text(product?.price);
  return candidate && Number.isFinite(Number(candidate)) && Number(candidate) >= 0 ? candidate : "";
}

export function OpportunityProductEditor({
  opportunity,
  line,
  assignedProductIds,
  data,
  onClose,
  onSaved
}: {
  opportunity: RecordData;
  line?: RecordData;
  assignedProductIds: string[];
  data: ScopedCrmData;
  onClose: () => void;
  onSaved: (line: RecordData) => void;
}) {
  const linkedProduct = line?.product as RecordData | undefined;
  const [values, setValues] = useState({
    productId: text(line?.productId),
    quantity: text(line?.quantity) || "1",
    unitPrice: text(line?.unitPrice),
    description: text(line?.description)
  });
  const [priceTouched, setPriceTouched] = useState(Boolean(line));
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Editing keeps its own Product; adding hides inactive items and anything already assigned.
  const selectable = data.products.filter(
    (product) => product.active !== false && !assignedProductIds.includes(text(product.id))
  );
  const selectedProduct = data.products.find((product) => text(product.id) === values.productId);
  const quantity = Number(values.quantity);
  const unitPrice = Number(values.unitPrice);
  const preview = Number.isFinite(quantity) && Number.isFinite(unitPrice) ? quantity * unitPrice : 0;

  function chooseProduct(productId: string) {
    const product = data.products.find((item) => text(item.id) === productId);
    setFieldErrors({});
    setValues((current) => ({
      ...current,
      productId,
      unitPrice: priceTouched ? current.unitPrice : suggestedSalesPrice(product, data.priceBookEntries),
      description: current.description || text(product?.description)
    }));
  }

  async function save() {
    setError("");
    const nextFieldErrors: Record<string, string> = {};
    if (!line && !values.productId) nextFieldErrors.productId = "Choose a Product.";
    if (!values.quantity.trim()) nextFieldErrors.quantity = "Quantity must be a valid number.";
    if (!values.unitPrice.trim()) nextFieldErrors.unitPrice = "Sales price must be a valid number.";
    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length) return;

    try {
      const payload = await apiRequest<{ product: RecordData }>(
        line
          ? `/api/opportunities/${id(opportunity)}/products/${id(line)}`
          : `/api/opportunities/${id(opportunity)}/products`,
        {
          method: line ? "PATCH" : "POST",
          body: jsonBody({
            ...(line ? {} : { productId: values.productId }),
            quantity: values.quantity,
            unitPrice: values.unitPrice,
            description: values.description
          })
        }
      );
      onSaved(payload.product);
    } catch (saveError) {
      if (saveError instanceof ApiError && saveError.fieldErrors) setFieldErrors(saveError.fieldErrors);
      setError(saveError instanceof Error ? saveError.message : "Unable to save the Opportunity Product.");
    }
  }

  return (
    <BaseDialog
      open
      title={line ? `Edit ${text(linkedProduct?.name) || "Opportunity Product"}` : "Add Product to Opportunity"}
      onClose={onClose}
      onEnterAction={save}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => save()}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error && (
          <div className="rounded border border-[#ea001e] bg-[#fff1f1] p-2 text-sm text-[#8e030f]">{error}</div>
        )}
        <FieldShell label="Product" required error={fieldErrors.productId}>
          <LookupField
            field={productLookupField}
            value={values.productId}
            selectedLabel={text(linkedProduct?.name) || undefined}
            disabled={Boolean(line)}
            error={Boolean(fieldErrors.productId)}
            data={{ ...data, products: selectable }}
            inlineSelection
            onChange={chooseProduct}
          />
        </FieldShell>
        <div className="grid gap-3 md:grid-cols-2">
          <FieldShell label="Quantity" required error={fieldErrors.quantity}>
            <input
              className={inputClass}
              type="number"
              min="0.0001"
              max="99999999999999.9999"
              step="0.0001"
              value={values.quantity}
              onChange={(event) => setValues({ ...values, quantity: event.target.value })}
            />
          </FieldShell>
          <FieldShell label="Sales Price" required error={fieldErrors.unitPrice}>
            <input
              className={inputClass}
              type="number"
              min="0"
              max="9999999999999999.99"
              step="0.01"
              value={values.unitPrice}
              onChange={(event) => {
                setPriceTouched(true);
                setValues({ ...values, unitPrice: event.target.value });
              }}
            />
          </FieldShell>
        </div>
        <FieldShell label="Line Description">
          <textarea
            className={`${inputClass} min-h-20 resize-y`}
            value={values.description}
            onChange={(event) => setValues({ ...values, description: event.target.value })}
          />
        </FieldShell>
        <div className="flex items-center justify-between rounded bg-[#f8f9fb] px-3 py-2 text-sm">
          <span className="text-[#706e6b]">
            {selectedProduct || linkedProduct ? "Total Price" : "Total Price after a Product is chosen"}
          </span>
          <span className="font-semibold">{money(preview)}</span>
        </div>
      </div>
    </BaseDialog>
  );
}
