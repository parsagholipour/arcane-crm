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
  const poAppProductId = text(product.poAppProductId);
  // decorateScopedData surfaces the primary price book entry's currency on the product row.
  const currency = text(product.currency) || "USD";
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
        badge={
          <span className="flex items-center gap-2">
            <Active value={product.active} />
            {poAppProductId && (
              <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-800">
                Synced from PO App
              </span>
            )}
          </span>
        }
        actions={
          <>
            <button className={secondary} onClick={() => setEdit(true)}>
              Edit
            </button>
            {!poAppProductId && (
              <button className={secondary} onClick={onDelete}>
                <Trash2 size={13} /> Delete
              </button>
            )}
          </>
        }
      />
      {poAppProductId && (
        <p className="rounded border border-[#9ac3e8] bg-[#eef4ff] px-3 py-2 text-sm">
          This Product is kept in step with PO App. Name, SKU, pricing, and stock are overwritten on the next sync;
          Family, Category, and Active stay local. Deleting it upstream deactivates it here.
        </p>
      )}
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
      {poAppProductId && (
        <Card title="PO App Catalogue">
          <dl className="grid grid-cols-2 gap-3 text-sm lg:grid-cols-4">
            <Detail label="UPC / GTIN" value={product.upcGtin} />
            <Detail label="Cost" value={money(product.cost, currency)} />
            <Detail label="Price" value={money(product.price, currency)} />
            <Detail label="MSRP" value={money(product.msrp, currency)} />
            <Detail label="MAP" value={money(product.mapPrice, currency)} />
            <Detail label="Stock Count" value={product.stockCount} />
            <Detail label="Units Per Carton" value={product.quantityPerCarton} />
            <Detail label="Minimum Order Pieces" value={product.minimumOrderPieces} />
            <Detail label="Editing Status" value={product.editingStatus} />
            <Detail label="Verified" value={product.verified ? "Yes" : "No"} />
            <Detail label="Type" value={product.productType} />
            <Detail label="Collection" value={product.collectionName} />
            <Detail label="Manufacturer" value={product.manufacturerName} />
            <Detail label="Manufacturer Region" value={product.manufacturerRegion} />
            <Detail label="Order By" value={formatDateTime(text(product.orderByDate))} />
            <Detail label="Last Synced" value={formatDateTime(text(product.poAppSyncedAt))} />
          </dl>
        </Card>
      )}
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
      {edit && <ProductEditor product={product} data={data} onClose={() => setEdit(false)} onSaved={saved} />}
    </section>
  );
}
