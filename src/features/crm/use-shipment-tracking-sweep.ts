"use client";

import { useEffect } from "react";
import { apiRequest } from "@/lib/api/client";
import { type RecordData } from "@/lib/crm-types";
import { type ScopedCrmDataUpdater } from "@/features/crm/shared-types";

const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

function recordId(record: RecordData) {
  return String(record.id ?? "");
}

/**
 * Refresh due USPS shipments while a shipment-aware screen is open, so tracking works
 * without waiting on the external scheduler. Delivery notifications are deduped server side,
 * which is what makes it safe to run this alongside the scheduled dispatch route.
 */
export function useShipmentTrackingSweep(enabled: boolean, onDataChange: ScopedCrmDataUpdater) {
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    async function sweep() {
      try {
        const payload = await apiRequest<RecordData>("/api/shipments/tracking", { method: "POST" });
        const notifications = Array.isArray(payload.notifications) ? (payload.notifications as RecordData[]) : [];
        if (!active || notifications.length === 0) return;
        const incoming = new Set(notifications.map(recordId));
        onDataChange((previous) => ({
          ...previous,
          notifications: [...notifications, ...previous.notifications.filter((item) => !incoming.has(recordId(item)))]
        }));
      } catch {
        // A failed sweep retries on the next tick.
      }
    }
    void sweep();
    const timer = setInterval(sweep, SWEEP_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [enabled, onDataChange]);
}
