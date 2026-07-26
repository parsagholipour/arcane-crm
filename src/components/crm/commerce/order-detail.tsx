"use client";

import { CheckCircle2, PackageCheck, Trash2, Truck } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  type RecordData,
  records,
  Modal,
  text,
  secondary,
  Badge,
  primary,
  danger,
  id,
  Metric,
  money,
  Panel,
  Empty
} from "@/components/crm/commerce/primitives";

export function OrderDetail({
  order,
  onClose,
  onEdit,
  onFulfill,
  onAction,
  onDelete
}: {
  order: RecordData;
  onClose: () => void;
  onEdit: () => void;
  onFulfill: () => void;
  onAction: (action: string, payload?: RecordData) => void;
  onDelete: () => void;
}) {
  const lines = records(order.lines);
  const fulfillments = records(order.fulfillments);
  return (
    <Modal
      title={text(order.orderNumber)}
      onClose={onClose}
      wide
      footer={
        <button className={secondary} onClick={onClose}>
          Close
        </button>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Badge value={order.status} />
            <div className="mt-2 text-sm text-[#706e6b]">
              {text((order.store as RecordData | undefined)?.name)} ·{" "}
              {text((order.account as RecordData | undefined)?.name)} · {formatDate(text(order.orderDate))}
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {order.status === "Draft" && (
              <>
                <button className={secondary} onClick={onEdit}>
                  Edit
                </button>
                <button
                  className={primary}
                  onClick={() =>
                    window.confirm("Confirm this order and reserve tracked inventory? No payment will be processed.") &&
                    onAction("confirm")
                  }
                >
                  <CheckCircle2 size={13} /> Confirm
                </button>
                <button className={danger} onClick={onDelete}>
                  <Trash2 size={13} /> Delete
                </button>
              </>
            )}
            {order.status === "Confirmed" && (
              <>
                <button className={primary} onClick={onFulfill}>
                  <PackageCheck size={13} /> Fulfill
                </button>
                <button
                  className={secondary}
                  onClick={() =>
                    window.confirm("Cancel this order and release reserved inventory?") && onAction("cancel")
                  }
                >
                  Cancel
                </button>
              </>
            )}
            {order.status === "Fulfilled" && fulfillments.some((item) => item.status === "Shipped") && (
              <button
                className={primary}
                onClick={() =>
                  onAction("deliver", { fulfillmentId: id(fulfillments.find((item) => item.status === "Shipped")!) })
                }
              >
                <Truck size={13} /> Mark Delivered
              </button>
            )}
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <Metric label="Subtotal" value={money(order.subtotal, text(order.currency))} />
          <Metric label="Discounts" value={money(order.discountTotal, text(order.currency))} />
          <Metric label="Tax" value={money(order.taxTotal, text(order.currency))} />
          <Metric label="Total" value={money(order.total, text(order.currency))} />
        </div>
        <Panel title="Order Lines">
          <div className="overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#f3f3f3] text-xs">
                <tr>
                  {["Product", "Description", "Quantity", "Fulfilled", "Unit Price", "Discount", "Tax", "Total"].map(
                    (label) => (
                      <th key={label} className="px-3 py-2">
                        {label}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={id(line)} className="border-t border-[#eef1f6]">
                    <td className="px-3 py-2 font-semibold">{text((line.product as RecordData | undefined)?.name)}</td>
                    <td className="px-3 py-2">{text(line.description)}</td>
                    <td className="px-3 py-2">{text(line.quantity)}</td>
                    <td className="px-3 py-2">{text(line.fulfilledQuantity)}</td>
                    <td className="px-3 py-2">{money(line.unitPrice, text(order.currency))}</td>
                    <td className="px-3 py-2">{money(line.discountAmount, text(order.currency))}</td>
                    <td className="px-3 py-2">{money(line.taxAmount, text(order.currency))}</td>
                    <td className="px-3 py-2">{money(line.lineTotal, text(order.currency))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <div className="grid gap-3 md:grid-cols-2">
          <Panel title="Shipping">
            <div className="whitespace-pre-line text-sm">
              {[
                order.shippingName,
                order.shippingStreet,
                [order.shippingCity, order.shippingState, order.shippingPostalCode].filter(Boolean).join(" "),
                order.shippingCountry
              ]
                .filter(Boolean)
                .join("\n") || "No shipping address."}
            </div>
          </Panel>
          <Panel title="Order Information">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-[#706e6b]">PO Number</dt>
                <dd>{text(order.purchaseOrderNumber) || "-"}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#706e6b]">Fulfillment</dt>
                <dd>{text(order.fulfillmentStatus)}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#706e6b]">Created</dt>
                <dd>{formatDateTime(text(order.createdAt))}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#706e6b]">Updated</dt>
                <dd>{formatDateTime(text(order.updatedAt))}</dd>
              </div>
            </dl>
          </Panel>
        </div>
        <Panel title="Fulfillment History">
          {fulfillments.map((fulfillment) => (
            <div
              key={id(fulfillment)}
              className="flex items-center justify-between border-b border-[#eef1f6] py-2 text-sm last:border-0"
            >
              <span>
                <span className="font-semibold">{text(fulfillment.fulfillmentNumber)}</span>
                <span className="ml-2 text-[#706e6b]">
                  {text(fulfillment.carrier)} {text(fulfillment.trackingNumber)}
                </span>
              </span>
              <Badge value={fulfillment.status} />
            </div>
          ))}
          {!fulfillments.length && <Empty text="No fulfillment events have been recorded." />}
        </Panel>
        {order.notes && (
          <Panel title="Notes">
            <div className="whitespace-pre-wrap text-sm">{text(order.notes)}</div>
          </Panel>
        )}
      </div>
    </Modal>
  );
}
