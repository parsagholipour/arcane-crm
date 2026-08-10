"use client";

import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { type ScopedCrmData, type RecordData } from "@/lib/crm-types";
import { apiRequest } from "@/lib/api/client";
import { type ToastState } from "@/components/ui/crm-primitives";
import { type ScopedCrmDataUpdater } from "@/features/crm/shared-types";
import { Card, id, money, primary, secondary, text } from "@/components/crm/record-details/primitives";
import { OpportunityProductEditor } from "@/components/crm/opportunities/product-editor";
import { AsyncButton } from "@/components/crm/AsyncButton";

function opportunityProductLines(opportunity: RecordData) {
  return Array.isArray(opportunity.products)
    ? (opportunity.products.filter(
        (line) => Boolean(line) && typeof line === "object" && !Array.isArray(line)
      ) as RecordData[])
    : [];
}

export function OpportunityProductsCard({
  opportunity,
  data,
  onDataChange,
  onToast
}: {
  opportunity: RecordData;
  data: ScopedCrmData;
  onDataChange: ScopedCrmDataUpdater;
  onToast: (toast: ToastState) => void;
}) {
  const [editor, setEditor] = useState<RecordData | true | null>(null);
  const lines = opportunityProductLines(opportunity);
  const total = lines.reduce((sum, line) => sum + Number(line.totalPrice ?? 0), 0);

  function writeLines(next: RecordData[]) {
    onDataChange((previous) => ({
      ...previous,
      opportunities: previous.opportunities.map((item) =>
        item.id === opportunity.id ? { ...item, products: next } : item
      )
    }));
  }

  function saveLine(line: RecordData) {
    const exists = lines.some((item) => item.id === line.id);
    writeLines(exists ? lines.map((item) => (item.id === line.id ? line : item)) : [...lines, line]);
    setEditor(null);
    onToast({ tone: "success", message: exists ? "Opportunity Product updated." : "Product assigned." });
  }

  async function removeLine(line: RecordData) {
    const productName = text((line.product as RecordData | undefined)?.name);
    if (!window.confirm(`Remove ${productName || "this Product"} from the Opportunity?`)) return;
    try {
      await apiRequest(`/api/opportunities/${id(opportunity)}/products/${id(line)}`, { method: "DELETE" });
      writeLines(lines.filter((item) => item.id !== line.id));
      onToast({ tone: "success", message: "Product removed." });
    } catch (error) {
      onToast({
        tone: "error",
        message: error instanceof Error ? error.message : "The Product could not be removed."
      });
    }
  }

  return (
    <Card
      title={`Products (${lines.length})`}
      action={
        <button className={primary} onClick={() => setEditor(true)}>
          <Plus size={13} /> Add Product
        </button>
      }
    >
      {lines.length ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#f3f3f3] text-xs text-[#514f4d]">
              <tr>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2 text-right">Quantity</th>
                <th className="px-3 py-2 text-right">Sales Price</th>
                <th className="px-3 py-2 text-right">Total Price</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const product = line.product as RecordData | undefined;
                return (
                  <tr key={id(line)} className="border-t border-[#eef1f6] align-top">
                    <td className="px-3 py-2">
                      <Link
                        className="font-semibold text-brand-700 hover:underline"
                        href={`/lightning/r/Product2/${text(line.productId)}/view`}
                      >
                        {text(product?.name) || "Product"}
                      </Link>
                      {text(product?.productCode) && (
                        <div className="text-xs text-[#706e6b]">{text(product?.productCode)}</div>
                      )}
                      {text(line.description) && (
                        <div className="mt-1 whitespace-pre-wrap text-xs text-[#706e6b]">{text(line.description)}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">{Number(line.quantity ?? 0).toLocaleString("en-US")}</td>
                    <td className="px-3 py-2 text-right">{money(line.unitPrice)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{money(line.totalPrice)}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <button className={secondary} onClick={() => setEditor(line)}>
                          Edit
                        </button>
                        <AsyncButton
                          className={secondary}
                          aria-label={`Remove ${text(product?.name) || "Product"}`}
                          onClick={() => removeLine(line)}
                        >
                          <Trash2 size={12} />
                        </AsyncButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-[#d8dde6]">
                <td className="px-3 py-2 text-xs font-semibold text-[#514f4d]" colSpan={3}>
                  Total Product Amount
                </td>
                <td className="px-3 py-2 text-right font-semibold">{money(total)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="rounded border border-dashed border-[#d8dde6] p-5 text-center text-sm text-[#706e6b]">
          No Products are assigned yet. Choose Add Product to quote catalogue items on this Opportunity.
        </div>
      )}
      {editor && (
        <OpportunityProductEditor
          opportunity={opportunity}
          line={editor === true ? undefined : editor}
          assignedProductIds={lines.map((item) => text(item.productId))}
          data={data}
          onClose={() => setEditor(null)}
          onSaved={saveLine}
        />
      )}
    </Card>
  );
}
