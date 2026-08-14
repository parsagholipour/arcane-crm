"use client";

import { Trash2 } from "lucide-react";
import { type FieldDefinition, type ScopedCrmData, type RecordData } from "@/lib/crm-types";
import { inputClass } from "@/features/crm/controls";
import { LookupField } from "@/features/crm/form-controls";
import { money, text } from "@/components/crm/record-details/primitives";
import { suggestedSalesPrice } from "@/components/crm/products/product-line-editor";
import { stagedLineId } from "@/components/crm/products/product-line-commit";
import { PRODUCT_LINE_SUBJECTS, type ProductLineSubjectKind } from "@/components/crm/products/product-line-subjects";

const productLookupField: FieldDefinition = {
  name: "productLineProductId",
  label: "Product",
  section: "Product Line",
  type: "lookup",
  lookupObject: "Product2"
};

function lineTotal(line: RecordData) {
  const quantity = Number(line.quantity);
  const unitPrice = Number(line.unitPrice);
  return Number.isFinite(quantity) && Number.isFinite(unitPrice) ? quantity * unitPrice : 0;
}

/**
 * Assign catalogue Products from inside the New/Edit record modal. Every change is staged in
 * local state and written by {@link commitProductLines} after the record saves, because a new
 * record has no id to hang lines off until then.
 */
export function ProductLinesField({
  subjectKind,
  lines,
  data,
  onChange
}: {
  subjectKind: ProductLineSubjectKind;
  lines: RecordData[];
  data: ScopedCrmData;
  onChange: (lines: RecordData[]) => void;
}) {
  const config = PRODUCT_LINE_SUBJECTS[subjectKind];
  // A screen that never loaded the catalogue still renders its record modal, so treat the
  // collections as optional rather than letting the whole form fail to mount.
  const catalogue = data.products ?? [];
  const priceBookEntries = data.priceBookEntries ?? [];
  const assigned = lines.map((line) => text(line.productId));
  const selectable = catalogue.filter((product) => product.active !== false && !assigned.includes(text(product.id)));
  const total = lines.reduce((sum, line) => sum + lineTotal(line), 0);

  function addProduct(productId: string) {
    if (!productId) return;
    const product = catalogue.find((item) => text(item.id) === productId);
    onChange([
      ...lines,
      {
        id: stagedLineId(),
        productId,
        quantity: "1",
        unitPrice: suggestedSalesPrice(product, priceBookEntries) || "0",
        description: text(product?.description),
        product: product ? { id: productId, name: text(product.name), productCode: text(product.productCode) } : null
      }
    ]);
  }

  function updateLine(lineId: string, patch: RecordData) {
    onChange(lines.map((line) => (text(line.id) === lineId ? { ...line, ...patch } : line)));
  }

  return (
    <fieldset className="mt-2 rounded border border-[#d8dde6] p-3">
      <legend className="px-1 text-xs font-semibold text-[#514f4d]">{config.cardTitle}</legend>
      {lines.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs text-[#706e6b]">
              <tr>
                <th className="py-1 pr-2 font-normal">Product</th>
                <th className="w-28 py-1 pr-2 text-right font-normal">Quantity</th>
                <th className="w-32 py-1 pr-2 text-right font-normal">Sales Price</th>
                <th className="w-28 py-1 pr-2 text-right font-normal">Total</th>
                <th className="w-10 py-1" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const lineId = text(line.id);
                const label = text((line.product as RecordData | undefined)?.name) || "Product";
                return (
                  <tr key={lineId} className="border-t border-[#eef1f6]">
                    <td className="py-1.5 pr-2">
                      <div className="font-semibold">{label}</div>
                      {text((line.product as RecordData | undefined)?.productCode) && (
                        <div className="text-xs text-[#706e6b]">
                          {text((line.product as RecordData | undefined)?.productCode)}
                        </div>
                      )}
                    </td>
                    <td className="py-1.5 pr-2">
                      <input
                        className={inputClass}
                        type="number"
                        min="0.0001"
                        step="0.0001"
                        aria-label={`Quantity for ${label}`}
                        value={text(line.quantity)}
                        onChange={(event) => updateLine(lineId, { quantity: event.target.value })}
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input
                        className={inputClass}
                        type="number"
                        min="0"
                        step="0.01"
                        aria-label={`Sales price for ${label}`}
                        value={text(line.unitPrice)}
                        onChange={(event) => updateLine(lineId, { unitPrice: event.target.value })}
                      />
                    </td>
                    <td className="py-1.5 pr-2 text-right font-semibold">{money(lineTotal(line))}</td>
                    <td className="py-1.5">
                      <button
                        type="button"
                        className="rounded border border-[#c9c9c9] p-1.5 text-brand-700 hover:bg-[#f3f3f3]"
                        aria-label={`Remove ${label}`}
                        onClick={() => onChange(lines.filter((item) => text(item.id) !== lineId))}
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-[#d8dde6]">
                <td className="py-1.5 pr-2 text-xs font-semibold text-[#514f4d]" colSpan={3}>
                  {config.totalLabel}
                </td>
                <td className="py-1.5 pr-2 text-right font-semibold">{money(total)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <div className="mt-2">
        <LookupField
          field={productLookupField}
          value=""
          data={{ ...data, products: selectable, priceBookEntries }}
          inlineSelection
          onChange={addProduct}
        />
        <p className="mt-1 text-xs text-[#706e6b]">
          {lines.length
            ? `Choose another Product to add it. ${config.cardTitle} save with the record.`
            : `Choose a Product to add it. ${config.cardTitle} save with the record.`}
        </p>
      </div>
    </fieldset>
  );
}
