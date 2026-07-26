"use client";

import { Archive, Plus, RotateCcw, Trash2 } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import {
  type RecordData,
  text,
  id,
  json,
  secondary,
  primary,
  Panel,
  Badge,
  money,
  Empty,
  Metric
} from "@/components/crm/commerce/primitives";
import { OrderDetail } from "@/components/crm/commerce/order-detail";
import { StoreEditor } from "@/components/crm/commerce/store-editor";
import { OrderEditor } from "@/components/crm/commerce/order-editor";
import { InventoryEditor } from "@/components/crm/commerce/inventory-editor";
import { PromotionEditor } from "@/components/crm/commerce/promotion-editor";
import { FulfillmentEditor } from "@/components/crm/commerce/fulfillment-editor";
import { type CommerceWorkspaceModel } from "@/components/crm/commerce/workspace-controller";

export function CommerceWorkspaceView({ model }: { model: CommerceWorkspaceModel }) {
  const { data, onToast, tab, setTab, modal, setModal, selectedOrder, setSelectedOrder, apply, action, remove, cards } =
    model;

  return (
    <section className="space-y-3">
      <div className="rounded-lg border border-[#e4e7ec] bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs text-[#706e6b]">Commerce</div>
            <h1 className="text-2xl font-semibold">Sales Commerce Workspace</h1>
            <p className="mt-1 text-sm text-[#706e6b]">
              Manage catalog-backed orders, inventory, promotions, and fulfillment. Payments are recorded outside this
              CRM.
            </p>
          </div>
          <div className="flex gap-2">
            <button className={secondary} onClick={() => setModal({ type: "store" })}>
              <Plus size={13} /> New Store
            </button>
            <button className={primary} onClick={() => setModal({ type: "order" })}>
              <Plus size={13} /> New Order
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-1 border-t border-[#eef1f6] pt-3">
          {(["overview", "stores", "orders", "inventory", "promotions"] as const).map((value) => (
            <button
              key={value}
              className={cn(
                "rounded px-3 py-2 text-xs font-semibold capitalize",
                tab === value ? "bg-brand-50 text-brand-800" : "text-[#514f4d] hover:bg-[#f3f3f3]"
              )}
              onClick={() => setTab(value)}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
      {tab === "overview" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => (
              <button
                key={card.label}
                className="rounded-lg border border-[#e4e7ec] bg-white p-4 text-left shadow-card hover:border-brand-400"
                onClick={() => setTab(card.tab)}
              >
                <card.icon size={20} className="text-brand-600" />
                <div className="mt-3 text-2xl font-semibold">{card.value}</div>
                <div className="text-xs text-[#706e6b]">{card.label}</div>
              </button>
            ))}
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <Panel title="Recent Orders">
              {data.commerceOrders.slice(0, 5).map((order) => (
                <button
                  key={id(order)}
                  className="flex w-full items-center justify-between border-b border-[#eef1f6] py-3 text-left last:border-0"
                  onClick={() => setSelectedOrder(order)}
                >
                  <span>
                    <span className="block font-semibold text-brand-700">{text(order.orderNumber)}</span>
                    <span className="text-xs text-[#706e6b]">
                      {text((order.account as RecordData | undefined)?.name || order.accountName)} ·{" "}
                      {formatDate(text(order.orderDate))}
                    </span>
                  </span>
                  <span className="text-right">
                    <Badge value={order.status} />
                    <span className="mt-1 block text-xs">{money(order.total, text(order.currency) || "USD")}</span>
                  </span>
                </button>
              ))}
              {!data.commerceOrders.length && <Empty text="No orders yet. Create a Draft order to begin." />}
            </Panel>
            <Panel title="Store Readiness">
              {data.stores.map((store) => (
                <button
                  key={id(store)}
                  className="flex w-full items-center justify-between border-b border-[#eef1f6] py-3 text-left last:border-0"
                  onClick={() => setTab("stores")}
                >
                  <span>
                    <span className="block font-semibold">{text(store.name)}</span>
                    <span className="text-xs text-[#706e6b]">
                      {text((store.priceBook as RecordData | undefined)?.name) || "No Price Book"} ·{" "}
                      {text(store.currency)}
                    </span>
                  </span>
                  <Badge value={store.status} />
                </button>
              ))}
              {!data.stores.length && <Empty text="No stores yet. Create one and connect an active Price Book." />}
            </Panel>
          </div>
        </>
      )}
      {tab === "stores" && (
        <Panel
          title="Stores"
          action={
            <button className={primary} onClick={() => setModal({ type: "store" })}>
              <Plus size={13} /> New Store
            </button>
          }
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.stores.map((store) => (
              <div key={id(store)} className="rounded border border-[#d8dde6] p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold">{text(store.name)}</div>
                    <div className="text-xs text-[#706e6b]">
                      /{text(store.slug)} · {text(store.currency)}
                    </div>
                  </div>
                  <Badge value={store.status} />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <Metric
                    label="Orders"
                    value={
                      (store._count as RecordData | undefined)?.orders ??
                      data.commerceOrders.filter((order) => order.storeId === store.id).length
                    }
                  />
                  <Metric
                    label="Inventory"
                    value={
                      (store._count as RecordData | undefined)?.inventoryItems ??
                      data.inventoryItems.filter((item) => item.storeId === store.id).length
                    }
                  />
                  <Metric
                    label="Promos"
                    value={
                      (store._count as RecordData | undefined)?.promotions ??
                      data.commercePromotions.filter((item) => item.storeId === store.id).length
                    }
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  <button className={secondary} onClick={() => setModal({ type: "store", record: store })}>
                    Edit
                  </button>
                  {store.status === "Draft" && (
                    <button
                      className={primary}
                      onClick={() =>
                        void action(
                          `/api/commerce/stores/${id(store)}/actions`,
                          { action: "activate" },
                          "Store activated."
                        )
                      }
                    >
                      Activate
                    </button>
                  )}
                  {store.status !== "Archived" && (
                    <button
                      className={secondary}
                      onClick={() =>
                        void action(
                          `/api/commerce/stores/${id(store)}/actions`,
                          { action: "archive" },
                          "Store archived."
                        )
                      }
                    >
                      <Archive size={12} />
                    </button>
                  )}
                  {store.status === "Archived" && (
                    <button
                      className={secondary}
                      onClick={() =>
                        void action(
                          `/api/commerce/stores/${id(store)}/actions`,
                          { action: "restore" },
                          "Store restored as Draft."
                        )
                      }
                    >
                      <RotateCcw size={12} />
                    </button>
                  )}
                  {store.status === "Draft" && (
                    <button className={secondary} onClick={() => void remove("store", store)}>
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {!data.stores.length && <Empty text="Create a store, connect a Price Book, then activate it." />}
          </div>
        </Panel>
      )}
      {tab === "orders" && (
        <Panel
          title="Orders"
          action={
            <button className={primary} onClick={() => setModal({ type: "order" })}>
              <Plus size={13} /> New Order
            </button>
          }
        >
          <div className="overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#f3f3f3] text-xs">
                <tr>
                  {["Order", "Store", "Account", "Date", "Status", "Fulfillment", "Total"].map((label) => (
                    <th key={label} className="px-3 py-2">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.commerceOrders.map((order) => (
                  <tr
                    key={id(order)}
                    className="cursor-pointer border-t border-[#eef1f6] hover:bg-brand-50"
                    onClick={() => setSelectedOrder(order)}
                  >
                    <td className="px-3 py-2 font-semibold text-brand-700">{text(order.orderNumber)}</td>
                    <td className="px-3 py-2">{text((order.store as RecordData | undefined)?.name)}</td>
                    <td className="px-3 py-2">{text((order.account as RecordData | undefined)?.name)}</td>
                    <td className="px-3 py-2">{formatDate(text(order.orderDate))}</td>
                    <td className="px-3 py-2">
                      <Badge value={order.status} />
                    </td>
                    <td className="px-3 py-2">{text(order.fulfillmentStatus)}</td>
                    <td className="px-3 py-2">{money(order.total, text(order.currency))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.commerceOrders.length && (
              <Empty text="No orders yet. Draft orders can be edited or deleted before confirmation." />
            )}
          </div>
        </Panel>
      )}
      {tab === "inventory" && (
        <Panel
          title="Inventory"
          action={
            <button className={primary} onClick={() => setModal({ type: "inventory" })}>
              <Plus size={13} /> Set Inventory
            </button>
          }
        >
          <div className="overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#f3f3f3] text-xs">
                <tr>
                  {["Product", "Store", "On Hand", "Reserved", "Available", "Reorder Point", "State", "Action"].map(
                    (label) => (
                      <th key={label} className="px-3 py-2">
                        {label}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {data.inventoryItems.map((item) => {
                  const available = Number(item.quantityOnHand ?? 0) - Number(item.quantityReserved ?? 0);
                  const low = available <= Number(item.reorderPoint ?? 0);
                  return (
                    <tr key={id(item)} className="border-t border-[#eef1f6]">
                      <td className="px-3 py-2 font-semibold">
                        {text((item.product as RecordData | undefined)?.name)}
                      </td>
                      <td className="px-3 py-2">
                        {text((item.store as RecordData | undefined)?.name) ||
                          text(data.stores.find((store) => store.id === item.storeId)?.name)}
                      </td>
                      <td className="px-3 py-2">{text(item.quantityOnHand)}</td>
                      <td className="px-3 py-2">{text(item.quantityReserved)}</td>
                      <td className="px-3 py-2">{available}</td>
                      <td className="px-3 py-2">{text(item.reorderPoint)}</td>
                      <td className="px-3 py-2">
                        <span className={low ? "font-semibold text-[#ba0517]" : "text-[#2e844a]"}>
                          {low ? "Low stock" : "In stock"}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <button
                          className={secondary}
                          onClick={() =>
                            setModal({
                              type: "inventory",
                              record: item,
                              store: data.stores.find((store) => store.id === item.storeId)
                            })
                          }
                        >
                          Adjust
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!data.inventoryItems.length && (
              <Empty text="Inventory is optional. Add quantities to enforce reservation checks when orders are confirmed." />
            )}
          </div>
        </Panel>
      )}
      {tab === "promotions" && (
        <Panel
          title="Promotions"
          action={
            <button className={primary} onClick={() => setModal({ type: "promotion" })}>
              <Plus size={13} /> New Promotion
            </button>
          }
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.commercePromotions.map((promotion) => (
              <div key={id(promotion)} className="rounded border border-[#d8dde6] p-4">
                <div className="flex justify-between">
                  <div>
                    <div className="font-semibold">{text(promotion.name)}</div>
                    <code className="text-xs text-brand-700">{text(promotion.code)}</code>
                  </div>
                  <Badge value={promotion.active ? "Active" : "Inactive"} />
                </div>
                <div className="mt-3 text-sm">
                  {text(promotion.type)}:{" "}
                  {promotion.type === "Percentage"
                    ? `${text(promotion.value)}%`
                    : money(
                        promotion.value,
                        text(data.stores.find((store) => store.id === promotion.storeId)?.currency)
                      )}
                </div>
                <div className="mt-1 text-xs text-[#706e6b]">
                  Used {text(promotion.redemptionCount || 0)}
                  {promotion.maxRedemptions ? ` of ${text(promotion.maxRedemptions)}` : " times"}
                </div>
                <div className="mt-3 flex gap-1">
                  <button
                    className={secondary}
                    onClick={() =>
                      void json(`/api/commerce/stores/${text(promotion.storeId)}/promotions/${id(promotion)}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ active: !promotion.active })
                      })
                        .then((payload) => {
                          apply({ promotion: payload.promotion as RecordData });
                          onToast({
                            tone: "success",
                            message: promotion.active ? "Promotion deactivated." : "Promotion activated."
                          });
                        })
                        .catch((error) => onToast({ tone: "error", message: error.message }))
                    }
                  >
                    {promotion.active ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    className={secondary}
                    onClick={() =>
                      void remove(
                        "promotion",
                        promotion,
                        data.stores.find((store) => store.id === promotion.storeId)
                      )
                    }
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
            {!data.commercePromotions.length && (
              <Empty text="Create codes for percentage or fixed-amount order discounts." />
            )}
          </div>
        </Panel>
      )}
      {selectedOrder && (
        <OrderDetail
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onEdit={() => {
            setModal({ type: "order", record: selectedOrder });
            setSelectedOrder(null);
          }}
          onFulfill={() => setModal({ type: "fulfill", record: selectedOrder })}
          onAction={(actionName, payload = {}) =>
            void action(
              `/api/commerce/orders/${id(selectedOrder)}/actions`,
              { action: actionName, ...payload },
              actionName === "confirm" ? "Order confirmed. No payment was processed." : `Order ${actionName} recorded.`
            )
          }
          onDelete={() => void remove("order", selectedOrder)}
        />
      )}
      {modal?.type === "store" && (
        <StoreEditor
          data={data}
          initial={modal.record}
          onClose={() => setModal(null)}
          onSaved={(result) => {
            apply(result);
            setModal(null);
            onToast({ tone: "success", message: modal.record ? "Store updated." : "Store created." });
          }}
        />
      )}
      {modal?.type === "order" && (
        <OrderEditor
          data={data}
          initial={modal.record}
          onClose={() => setModal(null)}
          onSaved={(result) => {
            apply(result);
            setModal(null);
            onToast({ tone: "success", message: modal.record ? "Order updated." : "Draft order created." });
          }}
        />
      )}
      {modal?.type === "inventory" && (
        <InventoryEditor
          data={data}
          initial={modal.record}
          initialStore={modal.store}
          onClose={() => setModal(null)}
          onSaved={(result) => {
            apply(result);
            setModal(null);
            onToast({ tone: "success", message: "Inventory updated." });
          }}
        />
      )}
      {modal?.type === "promotion" && (
        <PromotionEditor
          data={data}
          onClose={() => setModal(null)}
          onSaved={(result) => {
            apply(result);
            setModal(null);
            onToast({ tone: "success", message: "Promotion created." });
          }}
        />
      )}
      {modal?.type === "fulfill" && modal.record && (
        <FulfillmentEditor
          order={modal.record}
          onClose={() => setModal(null)}
          onSaved={(result) => {
            apply(result);
            setModal(null);
            onToast({ tone: "success", message: "Fulfillment recorded. No carrier transaction was performed." });
          }}
        />
      )}
    </section>
  );
}
