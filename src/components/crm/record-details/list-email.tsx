"use client";

import { Mail, Trash2 } from "lucide-react";
import { type ScopedCrmData } from "@/lib/crm-types";
import { formatDateTime } from "@/lib/utils";
import {
  type RecordData,
  type Toast,
  id,
  name,
  json,
  text,
  Status,
  secondary,
  primary,
  danger,
  Card,
  Detail
} from "@/components/crm/record-details/primitives";

export function ListEmailDetailPage({
  email,
  data,
  onEdit,
  onDelete,
  onChanged,
  onToast
}: {
  email: RecordData;
  data: ScopedCrmData;
  onEdit: () => void;
  onDelete: () => void;
  onChanged: (record: RecordData) => void;
  onToast: (toast: Toast) => void;
}) {
  const recipients = (Array.isArray(email.recipients) ? email.recipients : [])
    .map(String)
    .map(
      (reference) =>
        data.contacts.find((item) => item.id === reference) ??
        data.leads.find((item) => item.id === reference) ??
        ({ id: reference, email: reference, name: reference } as RecordData)
    );
  const deliveries = data.emailDeliveries.filter(
    (item) => item.sourceType === "ListEmail" && item.sourceId === email.id
  ) as RecordData[];
  async function deliver() {
    if (
      !window.confirm(
        `Deliver this list email to ${recipients.length} resolved recipient record${recipients.length === 1 ? "" : "s"}?`
      )
    )
      return;
    try {
      const payload = await json(`/api/records/ListEmail/${id(email)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Sent" })
      });
      onChanged(payload.record as RecordData);
      onToast({ tone: "success", message: text(payload.message) || "List email accepted by the configured provider." });
    } catch (error) {
      onToast({ tone: "error", message: error instanceof Error ? error.message : "Unable to deliver email." });
    }
  }
  return (
    <section className="space-y-3">
      <div className="rounded-lg border border-[#e4e7ec] bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex gap-3">
            <Mail className="text-brand-600" />
            <div>
              <div className="text-xs text-[#706e6b]">List Email</div>
              <h1 className="text-2xl font-semibold">{text(email.subject) || "Untitled List Email"}</h1>
              <div className="mt-2">
                <Status value={email.status} />
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {email.status === "Draft" && (
              <button className={secondary} onClick={onEdit}>
                Edit
              </button>
            )}
            {email.status === "Draft" && data.emailDeliveryConfigured && (
              <button className={primary} onClick={() => void deliver()}>
                Deliver Email
              </button>
            )}
            {email.status === "Draft" && (
              <button className={danger} onClick={onDelete}>
                <Trash2 size={13} /> Delete
              </button>
            )}
          </div>
        </div>
        {email.status === "Draft" && !data.emailDeliveryConfigured && (
          <div className="mt-4 rounded border border-[#f1c40f] bg-[#fff7d6] p-3 text-sm text-[#5f4b00]">
            Email delivery is disabled until a verified SendGrid sender is configured. The CRM will not claim that this
            draft was sent.
          </div>
        )}
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-3">
          <Card title="Message">
            <div className="whitespace-pre-wrap text-sm leading-7">{text(email.body) || "No message body."}</div>
          </Card>
          <Card title={`Provider Delivery Tracking (${deliveries.length})`}>
            {deliveries.map((delivery) => (
              <div
                key={id(delivery)}
                className="grid gap-1 border-b border-[#eef1f6] py-3 text-sm last:border-0 sm:grid-cols-[minmax(0,1fr)_130px_170px]"
              >
                <div>
                  <div className="font-semibold">{text(delivery.recipient)}</div>
                  <div className="text-xs text-[#706e6b]">
                    {text(delivery.provider)} · {text(delivery.providerMessageId) || "Provider ID pending"}
                  </div>
                  {delivery.lastReason && (
                    <div className="mt-1 text-xs text-[#8e030f]">{text(delivery.lastReason)}</div>
                  )}
                </div>
                <Status value={delivery.status} />
                <div className="text-xs text-[#706e6b]">
                  {formatDateTime(text(delivery.lastEventAt || delivery.acceptedAt))}
                </div>
              </div>
            ))}
            {!deliveries.length && (
              <div className="text-sm text-[#706e6b]">No provider delivery has been attempted for this email.</div>
            )}
          </Card>
        </div>
        <div className="space-y-3">
          <Card title="Delivery Details">
            <dl className="space-y-3">
              <Detail label="Layout" value={email.layoutType} />
              <Detail label="Recipient Type" value={email.recipientType} />
              <Detail label="Recipients" value={recipients.length} />
              <Detail label="Sent" value={email.sentAt ? formatDateTime(text(email.sentAt)) : "-"} />
              <Detail label="Scheduled" value={email.scheduledAt ? formatDateTime(text(email.scheduledAt)) : "-"} />
            </dl>
          </Card>
          <Card title={`Recipients (${recipients.length})`}>
            {recipients.map((recipient) => (
              <div key={id(recipient)} className="border-b border-[#eef1f6] py-2 text-sm last:border-0">
                <div className="font-semibold">{name(recipient) || text(recipient.email)}</div>
                <div className="text-xs text-[#706e6b]">{text(recipient.email) || "No deliverable email"}</div>
              </div>
            ))}
            {!recipients.length && <div className="text-sm text-[#706e6b]">No recipients selected.</div>}
          </Card>
        </div>
      </div>
    </section>
  );
}
