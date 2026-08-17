import "server-only";

import { after } from "next/server";
import {
  enqueueAndLoadLeadEvent,
  enqueueLeadWebhookEvent,
  attemptLeadWebhookDelivery
} from "@/lib/public-api/webhook-delivery";
import { serializeDeletedLead, type PublicLeadDeleted } from "@/lib/public-api/lead-serialize";

function scheduleLeadWebhookDelivery(deliveryId: string) {
  try {
    after(() => {
      void attemptLeadWebhookDelivery(deliveryId);
    });
  } catch {
    void attemptLeadWebhookDelivery(deliveryId);
  }
}

async function emit(run: () => Promise<string | null>) {
  try {
    const deliveryId = await run();
    if (deliveryId) scheduleLeadWebhookDelivery(deliveryId);
  } catch (error) {
    console.error("[lead-webhook] enqueue failed", error);
  }
}

export function emitLeadCreated(organizationId: string, leadId: string) {
  return emit(() => enqueueAndLoadLeadEvent(organizationId, "lead.created", leadId));
}

export function emitLeadUpdated(organizationId: string, leadId: string) {
  return emit(() => enqueueAndLoadLeadEvent(organizationId, "lead.updated", leadId));
}

export function emitLeadConverted(organizationId: string, leadId: string) {
  return emit(() => enqueueAndLoadLeadEvent(organizationId, "lead.converted", leadId));
}

export function emitLeadDeleted(
  organizationId: string,
  lead: Pick<PublicLeadDeleted, "id" | "firstName" | "lastName" | "company" | "email">
) {
  const data = serializeDeletedLead(lead);
  return emit(() =>
    enqueueLeadWebhookEvent({
      organizationId,
      event: "lead.deleted",
      leadId: lead.id,
      data
    })
  );
}
