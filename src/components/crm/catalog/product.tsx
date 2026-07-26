"use client";

import { Box, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { type ScopedCrmData, type RecordData } from "@/lib/crm-types";
import { formatDateTime } from "@/lib/utils";
import {
  type Toast,
  id,
  Header,
  text,
  Active,
  secondary,
  Card,
  Detail,
  money,
  Empty
} from "@/components/crm/catalog/primitives";
import { ProductEditor } from "@/components/crm/catalog/editors";

export function ProductDetailPage({
  product,
  data,
  onDataChange,
  onDelete,
  onToast
}: {
  product: RecordData;
  data: ScopedCrmData;
  onDataChange: (updater: (previous: ScopedCrmData) => ScopedCrmData) => void;
  onDelete: () => void;
  onToast: (toast: Toast) => void;
}) {
  const [edit, setEdit] = useState(false);
  const entries = data.priceBookEntries.filter((entry) => entry.productId === product.id);
  const inventory = data.inventoryItems.filter((item) => item.productId === product.id);
  const orderLines: RecordData[] = data.commerceOrders
    .flatMap((order) =>
      (Array.isArray(order.lines) ? (order.lines as RecordData[]) : []).map(
        (line) => ({ ...line, order }) as RecordData
      )
    )
    .filter((line) => line.productId === product.id);
  function saved(record: RecordData) {
    onDataChange((previous) => ({
      ...previous,
      products: previous.products.map((item) => (item.id === record.id ? { ...item, ...record } : item))
    }));
    setEdit(false);
    onToast({ tone: "success", message: "Product updated." });
  }
  return (
    <section className="space-y-3">
      <Header
        icon={<Box className="text-brand-600" />}
        eyebrow="Product"
        title={text(product.name)}
        badge={<Active value={product.active} />}
        actions={
          <>
            <button className={secondary} onClick={() => setEdit(true)}>
              Edit
            </button>
            <button className={secondary} onClick={onDelete}>
              <Trash2 size={13} /> Delete
            </button>
          </>
        }
      />
      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Product Details">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Detail label="Product Code" value={product.productCode} />
            <Detail label="SKU" value={product.sku} />
            <Detail label="Family" value={product.family} />
            <Detail label="Category" value={product.category} />
            <Detail label="Created" value={formatDateTime(text(product.createdAt))} />
            <Detail label="Updated" value={formatDateTime(text(product.updatedAt))} />
          </dl>
        </Card>
        <Card title="Description">
          <div className="whitespace-pre-wrap text-sm">{text(product.description) || "No description."}</div>
        </Card>
      </div>
      <Card title={`Price Book Entries (${entries.length})`}>
        {entries.length ? (
          <div className="overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#f3f3f3] text-xs">
                <tr>
                  <th className="px-3 py-2">Price Book</th>
                  <th className="px-3 py-2">List Price</th>
                  <th className="px-3 py-2">Currency</th>
                  <th className="px-3 py-2">State</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={id(entry)} className="border-t border-[#eef1f6]">
                    <td className="px-3 py-2">
                      <Link
                        className="font-semibold text-brand-700 hover:underline"
                        href={`/lightning/r/Pricebook2/${text(entry.priceBookId)}/view`}
                      >
                        {text((entry.priceBook as RecordData | undefined)?.name) ||
                          text(data.priceBooks.find((book) => book.id === entry.priceBookId)?.name)}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{money(entry.listPrice, text(entry.currency))}</td>
                    <td className="px-3 py-2">{text(entry.currency)}</td>
                    <td className="px-3 py-2">
                      <Active value={entry.active} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty value="This Product is not in a Price Book yet. Add it from a Price Book detail page." />
        )}
      </Card>
      <div className="grid gap-3 lg:grid-cols-2">
        <Card title={`Inventory (${inventory.length} stores)`}>
          {inventory.map((item) => (
            <div key={id(item)} className="flex justify-between border-b border-[#eef1f6] py-2 text-sm last:border-0">
              <span>
                {text((item.store as RecordData | undefined)?.name) ||
                  text(data.stores.find((store) => store.id === item.storeId)?.name)}
              </span>
              <span>
                {text(item.quantityOnHand)} on hand · {text(item.quantityReserved)} reserved
              </span>
            </div>
          ))}
          {!inventory.length && <Empty value="Inventory is not tracked for this Product." />}
        </Card>
        <Card title={`Order Usage (${orderLines.length})`}>
          {orderLines.slice(0, 8).map((line) => (
            <div key={id(line)} className="flex justify-between border-b border-[#eef1f6] py-2 text-sm last:border-0">
              <span>{text((line.order as RecordData).orderNumber)}</span>
              <span>
                {text(line.quantity)} × {money(line.unitPrice, text((line.order as RecordData).currency))}
              </span>
            </div>
          ))}
          {!orderLines.length && <Empty value="This Product has not been used on a commerce order." />}
        </Card>
      </div>
      {edit && <ProductEditor product={product} onClose={() => setEdit(false)} onSaved={saved} />}
    </section>
  );
}
