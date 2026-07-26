"use client";

import { BookOpen, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { type ScopedCrmData, type RecordData } from "@/lib/crm-types";
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  type Toast,
  id,
  text,
  json,
  Header,
  Active,
  secondary,
  Card,
  Detail,
  primary,
  money,
  Empty
} from "@/components/crm/catalog/primitives";
import { PriceBookEditor, EntryEditor } from "@/components/crm/catalog/editors";

export function PriceBookDetailPage({
  priceBook,
  data,
  onDataChange,
  onDelete,
  onToast
}: {
  priceBook: RecordData;
  data: ScopedCrmData;
  onDataChange: (updater: (previous: ScopedCrmData) => ScopedCrmData) => void;
  onDelete: () => void;
  onToast: (toast: Toast) => void;
}) {
  const [edit, setEdit] = useState(false);
  const [entryModal, setEntryModal] = useState<RecordData | true | null>(null);
  const entries = data.priceBookEntries.filter((entry) => entry.priceBookId === priceBook.id);
  const stores = data.stores.filter((store) => store.priceBookId === priceBook.id);
  function saveBook(record: RecordData) {
    onDataChange((previous) => ({
      ...previous,
      priceBooks: previous.priceBooks.map((item) => (item.id === record.id ? { ...item, ...record } : item))
    }));
    setEdit(false);
    onToast({ tone: "success", message: "Price Book updated." });
  }
  function saveEntry(entry: RecordData) {
    onDataChange((previous) => ({
      ...previous,
      priceBookEntries: previous.priceBookEntries.some((item) => item.id === entry.id)
        ? previous.priceBookEntries.map((item) => (item.id === entry.id ? entry : item))
        : [entry, ...previous.priceBookEntries]
    }));
    setEntryModal(null);
    onToast({ tone: "success", message: "Price Book entry saved." });
  }
  async function deleteEntry(entry: RecordData) {
    if (!window.confirm(`Delete the ${text((entry.product as RecordData | undefined)?.name)} entry?`)) return;
    try {
      await json(`/api/price-books/${id(priceBook)}/entries/${id(entry)}`, { method: "DELETE" });
      onDataChange((previous) => ({
        ...previous,
        priceBookEntries: previous.priceBookEntries.filter((item) => item.id !== entry.id)
      }));
      onToast({ tone: "success", message: "Price Book entry deleted." });
    } catch (error) {
      onToast({ tone: "error", message: error instanceof Error ? error.message : "Unable to delete entry." });
    }
  }
  return (
    <section className="space-y-3">
      <Header
        icon={<BookOpen className="text-brand-600" />}
        eyebrow="Price Book"
        title={text(priceBook.name)}
        badge={<Active value={priceBook.active} />}
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
        <Card title="Price Book Details">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Detail label="Standard Price Book" value={priceBook.isStandard ? "Yes" : "No"} />
            <Detail label="Entries" value={entries.length} />
            <Detail label="Valid From" value={priceBook.validFrom ? formatDate(text(priceBook.validFrom)) : "-"} />
            <Detail label="Valid To" value={priceBook.validTo ? formatDate(text(priceBook.validTo)) : "-"} />
            <Detail label="Created" value={formatDateTime(text(priceBook.createdAt))} />
            <Detail label="Updated" value={formatDateTime(text(priceBook.updatedAt))} />
          </dl>
        </Card>
        <Card title="Description">
          <div className="whitespace-pre-wrap text-sm">{text(priceBook.description) || "No description."}</div>
        </Card>
      </div>
      <Card
        title={`Products (${entries.length})`}
        action={
          <button className={primary} onClick={() => setEntryModal(true)}>
            <Plus size={13} /> Add Product
          </button>
        }
      >
        {entries.length ? (
          <div className="overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#f3f3f3] text-xs">
                <tr>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2">List Price</th>
                  <th className="px-3 py-2">Currency</th>
                  <th className="px-3 py-2">State</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={id(entry)} className="border-t border-[#eef1f6]">
                    <td className="px-3 py-2">
                      <Link
                        className="font-semibold text-brand-700 hover:underline"
                        href={`/lightning/r/Product2/${text(entry.productId)}/view`}
                      >
                        {text((entry.product as RecordData | undefined)?.name)}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{money(entry.listPrice, text(entry.currency))}</td>
                    <td className="px-3 py-2">{text(entry.currency)}</td>
                    <td className="px-3 py-2">
                      <Active value={entry.active} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <button className={secondary} onClick={() => setEntryModal(entry)}>
                          Edit
                        </button>
                        <button className={secondary} onClick={() => void deleteEntry(entry)}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty value="Add active Products and prices before using this Price Book in a Store or Invoice." />
        )}
      </Card>
      <Card title={`Connected Stores (${stores.length})`}>
        {stores.map((store) => (
          <div key={id(store)} className="flex justify-between border-b border-[#eef1f6] py-2 text-sm last:border-0">
            <span>{text(store.name)}</span>
            <span>{text(store.status)}</span>
          </div>
        ))}
        {!stores.length && <Empty value="No commerce store uses this Price Book." />}
      </Card>
      {edit && <PriceBookEditor priceBook={priceBook} onClose={() => setEdit(false)} onSaved={saveBook} />}
      {entryModal && (
        <EntryEditor
          priceBook={priceBook}
          data={data}
          entry={entryModal === true ? undefined : entryModal}
          onClose={() => setEntryModal(null)}
          onSaved={saveEntry}
        />
      )}
    </section>
  );
}
