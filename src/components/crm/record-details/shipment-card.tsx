"use client";

import { PackageSearch } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/utils";
import { carrierTrackingUrl, shipmentStatusLabel } from "@/lib/usps-status";
import { type RecordData, text, Card, Detail } from "@/components/crm/record-details/primitives";

const TONES: Record<string, string> = {
  Delivered: "bg-[#e5f7ec] text-[#194e31] border-[#b7e2c7]",
  OutForDelivery: "bg-[#e8f2fd] text-[#0b5cab] border-[#b6d6f5]",
  Alert: "bg-[#fdf2e0] text-[#8a5300] border-[#f0d9a8]",
  Returned: "bg-[#fdeaea] text-[#8e030f] border-[#f3c2c5]",
  Failed: "bg-[#fdeaea] text-[#8e030f] border-[#f3c2c5]"
};

export function TrackingStatusBadge({ status }: { status: string }) {
  if (!status) return null;
  const tone = TONES[status] ?? "bg-[#f3f3f3] text-[#514f4d] border-[#d8dde6]";
  return (
    <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${tone}`}>
      {shipmentStatusLabel(status)}
    </span>
  );
}

/**
 * Read-only view of the carrier status the poller keeps fresh. Rendered only when a
 * shipment is actually being tracked, so a courier-less record shows nothing.
 */
export function ShipmentCard({
  courier,
  trackingNumber,
  shipment
}: {
  courier: unknown;
  trackingNumber: unknown;
  shipment?: RecordData | null;
}) {
  const number = text(trackingNumber);
  if (!number) return null;
  const carrier = text(courier) || "Carrier";
  const carrierUrl = carrierTrackingUrl(carrier, number);
  const status = text(shipment?.status);

  return (
    <Card title="Shipment">
      <div className="flex flex-wrap items-center gap-3">
        <PackageSearch className="text-brand-600" size={18} />
        <span className="text-sm font-semibold">{carrier}</span>
        {carrierUrl ? (
          <a className="text-sm text-brand-700 hover:underline" href={carrierUrl} target="_blank" rel="noreferrer">
            {number}
          </a>
        ) : (
          <span className="text-sm">{number}</span>
        )}
        {status ? <TrackingStatusBadge status={status} /> : null}
      </div>
      {shipment ? (
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Detail
            label="Expected Delivery"
            value={shipment.expectedDeliveryAt ? formatDate(text(shipment.expectedDeliveryAt)) : ""}
          />
          <Detail label="Delivered" value={shipment.deliveredAt ? formatDateTime(text(shipment.deliveredAt)) : ""} />
          <Detail label="Last Scan" value={shipment.lastEventDescription} />
          <Detail
            label="Last Scan Time"
            value={shipment.lastEventAt ? formatDateTime(text(shipment.lastEventAt)) : ""}
          />
          <Detail label="Checked" value={shipment.lastPolledAt ? formatDateTime(text(shipment.lastPolledAt)) : ""} />
        </dl>
      ) : (
        <p className="mt-3 text-sm text-[#706e6b]">
          {carrier === "USPS"
            ? "Waiting for the first status check from USPS."
            : `${carrier} shipments are not checked automatically. Use the tracking link to see status.`}
        </p>
      )}
      {text(shipment?.statusSummary) && (
        <p className="mt-3 border-t border-[#eef1f6] pt-3 text-sm">{text(shipment?.statusSummary)}</p>
      )}
      {text(shipment?.lastError) && !text(shipment?.statusSummary) && (
        <p className="mt-3 border-t border-[#eef1f6] pt-3 text-sm text-[#706e6b]">{text(shipment?.lastError)}</p>
      )}
    </Card>
  );
}
