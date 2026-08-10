import { OBJECT_DEFINITIONS } from "@/lib/crm-metadata";
import { recordTitle, routeForRecord } from "@/lib/crm-data";
import { type CrmObject, type RecordData } from "@/lib/crm-types";
import { apiRequest } from "@/lib/api/client";
import { formatCell } from "@/features/crm/form-model";
import { canRouteToRecord, requiredId } from "@/features/crm/record-model";
import { listSearchHref } from "@/features/crm/route-model";

export function recordDeleteUrl(object: CrmObject, id: string) {
  if (object === "Invoice") return `/api/invoices/${id}`;
  if (object === "MessagingSession") return `/api/messaging-sessions/${id}`;
  if (object === "VideoCall") return `/api/video-calls/${id}`;
  if (object === "Campaign") return `/api/campaigns/${id}`;
  return `/api/records/${object}/${id}`;
}

/**
 * Deletes each record on its own request so a record the server refuses (a converted lead, a
 * product still used by an invoice) doesn't hide the records that were deleted successfully.
 */
export async function deleteRecordsRequest(object: CrmObject, ids: string[]) {
  const results = await Promise.all(
    ids.map(async (id) => {
      try {
        await apiRequest<RecordData>(recordDeleteUrl(object, id), { method: "DELETE" });
        return { id, error: "" };
      } catch (error) {
        return { id, error: error instanceof Error ? error.message : "The record couldn't be deleted." };
      }
    })
  );
  return {
    deletedIds: results.filter((result) => !result.error).map((result) => result.id),
    errors: Array.from(new Set(results.filter((result) => result.error).map((result) => result.error)))
  };
}

export function notificationForSavedRecord(
  object: CrmObject,
  record: RecordData,
  isUpdate: boolean,
  values: RecordData,
  deliveryAccepted = false
) {
  const title = recordTitle(object, record);
  const href = canRouteToRecord(object) ? routeForRecord(object, requiredId(record)) : listSearchHref(object, title);
  const definition = OBJECT_DEFINITIONS[object];

  if (object === "ListEmail") {
    const status = String(record.status ?? values.status ?? "Draft");
    if (status === "Sent") {
      return {
        title: "List email sent",
        body: `${title} was sent to ${formatCell(record.recipientType) || "selected recipients"}.`,
        href,
        category: "Email"
      };
    }
    if (record.scheduledAt || status === "Scheduled") {
      return {
        title: "List email scheduled",
        body: `${title} is scheduled for ${formatCell(record.scheduledAt) || "delivery"}.`,
        href,
        category: "Email"
      };
    }
    return {
      title: "List email saved",
      body: `${title} was saved as ${status}.`,
      href,
      category: "Email"
    };
  }

  if (object === "Case" && values.status === "Closed") {
    return {
      title: "Case closed",
      body: `${title} was closed and moved out of active support work.`,
      href,
      category: "Workflow"
    };
  }

  if (object === "Case" && values.sendNotificationEmailToContact === true && deliveryAccepted) {
    return {
      title: "Case contact notified",
      body: `${title} was accepted for delivery to the related contact.`,
      href,
      category: "Workflow"
    };
  }

  if (object === "Opportunity" && values.stage) {
    return {
      title: "Opportunity stage updated",
      body: `${title} moved to ${String(values.stage)}.`,
      href,
      category: "Workflow"
    };
  }

  if (object === "Lead" && values.status) {
    return {
      title: "Lead status updated",
      body: `${title} moved to ${String(values.status)}.`,
      href,
      category: "Workflow"
    };
  }

  return {
    title: `${definition.label} ${isUpdate ? "updated" : "created"}`,
    body: `${title || definition.label} was ${isUpdate ? "updated" : "created"} in the workspace.`,
    href,
    category: "Records"
  };
}
