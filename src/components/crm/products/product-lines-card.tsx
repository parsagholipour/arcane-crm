"use client";

import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { type ScopedCrmData, type RecordData } from "@/lib/crm-types";
import { apiRequest } from "@/lib/api/client";
import { type ToastState } from "@/components/ui/crm-primitives";
import { type ScopedCrmDataUpdater } from "@/features/crm/shared-types";
import { Card, id, money, primary, secondary, text } from "@/components/crm/record-details/primitives";
import { ProductLineEditor } from "@/components/crm/products/product-line-editor";
import { PRODUCT_LINE_SUBJECTS, type ProductLineSubjectKind } from "@/components/crm/products/product-line-subjects";
import { AsyncButton } from "@/components/crm/AsyncButton";

function productLines(subject: RecordData, linesKey: string) {
  const lines = subject[linesKey];
  return Array.isArray(lines)
    ? (lines.filter((line) => Boolean(line) && typeof line === "object" && !Array.isArray(line)) as RecordData[])
    : [];
}

/**
 * The Products assigned to a record, priced and totalled. Opportunity Products and Lead Sample
 * Products differ only in copy and endpoint, both of which come from the subject config.
 */
export function ProductLinesCard({
  subjectKind,
  subject,
  data,
  readOnly = false,
  onDataChange,
  onToast
}: {
  subjectKind: ProductLineSubjectKind;
  subject: RecordData;
  data: ScopedCrmData;
  /** Converted Leads are frozen on the server, so the card hides its write actions too. */
  readOnly?: boolean;
  onDataChange: ScopedCrmDataUpdater;
  onToast: (toast: ToastState) => void;
}) {
  const config = PRODUCT_LINE_SUBJECTS[subjectKind];
  const [editor, setEditor] = useState<RecordData | true | null>(null);
  const lines = productLines(subject, config.linesKey);
  const total = lines.reduce((sum, line) => sum + Number(line.totalPrice ?? 0), 0);

  function writeLines(next: RecordData[]) {
    onDataChange((previous) => ({
      ...previous,
      [config.dataKey]: previous[config.dataKey].map((item) =>
        item.id === subject.id ? { ...item, [config.linesKey]: next } : item
      )
    }));
  }

  function saveLine(line: RecordData) {
    const exists = lines.some((item) => item.id === line.id);
    writeLines(exists ? lines.map((item) => (item.id === line.id ? line : item)) : [...lines, line]);
    setEditor(null);
    onToast({ tone: "success", message: exists ? config.updatedToast : config.addedToast });
  }

  async function removeLine(line: RecordData) {
    const productName = text((line.product as RecordData | undefined)?.name);
    if (!window.confirm(config.removeConfirm(productName || "this Product"))) return;
    try {
      await apiRequest(`${config.path(id(subject))}/${id(line)}`, { method: "DELETE" });
      writeLines(lines.filter((item) => item.id !== line.id));
      onToast({ tone: "success", message: config.removedToast });
    } catch (error) {
      onToast({
        tone: "error",
        message: error instanceof Error ? error.message : config.removeError
      });
    }
  }

  return (
    <Card
      title={`${config.cardTitle} (${lines.length})`}
      action={
        readOnly ? undefined : (
          <button className={primary} onClick={() => setEditor(true)}>
            <Plus size={13} /> {config.addLabel}
          </button>
        )
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
                {!readOnly && <th className="px-3 py-2 text-right">Actions</th>}
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
                    {!readOnly && (
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
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-[#d8dde6]">
                <td className="px-3 py-2 text-xs font-semibold text-[#514f4d]" colSpan={3}>
                  {config.totalLabel}
                </td>
                <td className="px-3 py-2 text-right font-semibold">{money(total)}</td>
                {!readOnly && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="rounded border border-dashed border-[#d8dde6] p-5 text-center text-sm text-[#706e6b]">
          {config.emptyBody}
        </div>
      )}
      {editor && (
        <ProductLineEditor
          subjectKind={subjectKind}
          subject={subject}
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
