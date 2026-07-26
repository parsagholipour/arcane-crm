"use client";

import { Box, ShoppingCart, Store, Tag } from "lucide-react";
import { useState } from "react";
import type { ScopedCrmData } from "@/lib/crm-types";
import { type RecordData, text, type Mutation, id, json, type Toast } from "@/components/crm/commerce/primitives";

export function useCommerceWorkspace({
  data,
  onDataChange,
  onToast
}: {
  data: ScopedCrmData;
  onDataChange: (updater: (previous: ScopedCrmData) => ScopedCrmData) => void;
  onToast: (toast: Toast) => void;
}) {
  const [tab, setTab] = useState<"overview" | "stores" | "orders" | "inventory" | "promotions">("overview");
  const [modal, setModal] = useState<null | {
    type: "store" | "order" | "inventory" | "promotion" | "fulfill";
    record?: RecordData;
    store?: RecordData;
  }>(null);
  const [selectedOrder, setSelectedOrder] = useState<RecordData | null>(null);
  const activeStores = data.stores.filter((store) => store.status === "Active").length;
  const openOrders = data.commerceOrders.filter((order) => ["Draft", "Confirmed"].includes(text(order.status))).length;
  const lowStock = data.inventoryItems.filter(
    (item) => Number(item.quantityOnHand ?? 0) - Number(item.quantityReserved ?? 0) <= Number(item.reorderPoint ?? 0)
  ).length;
  function apply(result: Mutation) {
    onDataChange((previous) => {
      const upsert = (items: RecordData[], record?: RecordData) =>
        !record?.id
          ? items
          : items.some((item) => item.id === record.id)
            ? items.map((item) => (item.id === record.id ? { ...item, ...record } : item))
            : [record, ...items];
      const incoming = result.notifications ?? [];
      const incomingIds = new Set(incoming.map((item) => item.id));
      const inventoryUpdates = [
        ...(result.inventoryItems ?? []),
        ...(result.inventoryItem ? [result.inventoryItem] : [])
      ];
      const inventoryItems = inventoryUpdates.reduce((items, record) => upsert(items, record), previous.inventoryItems);
      return {
        ...previous,
        stores: upsert(previous.stores, result.store),
        commerceOrders: upsert(previous.commerceOrders, result.order),
        inventoryItems,
        commercePromotions: upsert(previous.commercePromotions, result.promotion),
        notifications: [...incoming, ...previous.notifications.filter((item) => !incomingIds.has(item.id))]
      };
    });
    if (result.order && selectedOrder?.id === result.order.id) setSelectedOrder(result.order);
  }
  async function action(url: string, body: RecordData, success: string) {
    try {
      const result = (await json(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      })) as Mutation;
      apply(result);
      onToast({ tone: "success", message: success });
    } catch (error) {
      onToast({ tone: "error", message: error instanceof Error ? error.message : "Action failed." });
    }
  }
  async function remove(kind: "store" | "order" | "promotion", record: RecordData, store?: RecordData) {
    if (
      !window.confirm(`Delete ${text(record.name || record.orderNumber || record.code)}? This action can't be undone.`)
    )
      return;
    const url =
      kind === "store"
        ? `/api/commerce/stores/${id(record)}`
        : kind === "order"
          ? `/api/commerce/orders/${id(record)}`
          : `/api/commerce/stores/${id(store!)}/promotions/${id(record)}`;
    try {
      await json(url, { method: "DELETE" });
      onDataChange((previous) => ({
        ...previous,
        stores: kind === "store" ? previous.stores.filter((item) => item.id !== record.id) : previous.stores,
        commerceOrders:
          kind === "order" ? previous.commerceOrders.filter((item) => item.id !== record.id) : previous.commerceOrders,
        commercePromotions:
          kind === "promotion"
            ? previous.commercePromotions.filter((item) => item.id !== record.id)
            : previous.commercePromotions
      }));
      if (selectedOrder?.id === record.id) setSelectedOrder(null);
      onToast({
        tone: "success",
        message: `${kind === "promotion" ? "Promotion" : kind === "order" ? "Order" : "Store"} deleted.`
      });
    } catch (error) {
      onToast({ tone: "error", message: error instanceof Error ? error.message : "Delete failed." });
    }
  }
  const cards = [
    { label: "Active Stores", value: activeStores, icon: Store, tab: "stores" as const },
    { label: "Open Orders", value: openOrders, icon: ShoppingCart, tab: "orders" as const },
    { label: "Low Stock", value: lowStock, icon: Box, tab: "inventory" as const },
    {
      label: "Active Promotions",
      value: data.commercePromotions.filter((promotion) => promotion.active).length,
      icon: Tag,
      tab: "promotions" as const
    }
  ];

  return {
    data,
    onToast,
    tab,
    setTab,
    modal,
    setModal,
    selectedOrder,
    setSelectedOrder,
    apply,
    action,
    remove,
    cards
  };
}

export type CommerceWorkspaceModel = ReturnType<typeof useCommerceWorkspace>;
export type CommerceWorkspaceProps = Parameters<typeof useCommerceWorkspace>[0];
