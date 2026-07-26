"use client";

import { BriefcaseBusiness, CheckCircle2, CircleHelp, Trash2, UserRound } from "lucide-react";
import Link from "next/link";
import { type ScopedCrmData } from "@/lib/crm-types";
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  type RecordData,
  id,
  name,
  text,
  money,
  Status,
  primary,
  secondary,
  danger,
  Card,
  Detail
} from "@/components/crm/record-details/primitives";

export function SalesRecordDetailPage({
  object,
  record,
  data,
  onEdit,
  onDelete,
  onChangeOwner,
  onWorkflow
}: {
  object: "Lead" | "Opportunity" | "Case";
  record: RecordData;
  data: ScopedCrmData;
  onEdit: () => void;
  onDelete: () => void;
  onChangeOwner: () => void;
  onWorkflow: (action: string) => void;
}) {
  const account = data.accounts.find((item) => item.id === record.accountId);
  const contact = data.contacts.find((item) => item.id === record.contactId);
  const owner = data.users.find((item) => item.id === record.ownerId);
  const title =
    object === "Lead"
      ? name(record)
      : object === "Case"
        ? text(record.caseNumber || record.subject)
        : text(record.name);
  const Icon = object === "Lead" ? UserRound : object === "Opportunity" ? BriefcaseBusiness : CircleHelp;
  const convertedAccount = data.accounts.find((item) => item.id === record.convertedAccountId);
  const convertedContact = data.contacts.find((item) => item.id === record.convertedContactId);
  const convertedOpportunity = data.opportunities.find((item) => item.id === record.convertedOpportunityId);
  const converted = Boolean(record.convertedAt);
  const details: Array<[string, unknown, string?]> =
    object === "Lead"
      ? [
          ["Company", record.company],
          ["Title", record.title],
          ["Email", record.email],
          ["Phone", record.phone],
          ["Lead Source", record.leadSource],
          ["Rating", record.rating],
          ["Industry", record.industry],
          ["Annual Revenue", record.annualRevenue ? money(record.annualRevenue) : ""],
          ["Owner", owner?.name],
          ["Conversion Date", record.convertedAt ? formatDateTime(text(record.convertedAt)) : ""],
          [
            "Converted Account",
            convertedAccount?.name,
            convertedAccount ? `/lightning/r/Account/${id(convertedAccount)}/view` : undefined
          ],
          [
            "Converted Contact",
            name(convertedContact),
            convertedContact ? `/lightning/r/Contact/${id(convertedContact)}/view` : undefined
          ],
          [
            "Converted Opportunity",
            convertedOpportunity?.name,
            convertedOpportunity ? `/lightning/r/Opportunity/${id(convertedOpportunity)}/view` : undefined
          ]
        ]
      : object === "Opportunity"
        ? [
            ["Account", account?.name, account ? `/lightning/r/Account/${id(account)}/view` : undefined],
            ["Contact", name(contact), contact ? `/lightning/r/Contact/${id(contact)}/view` : undefined],
            ["Close Date", record.closeDate ? formatDate(text(record.closeDate)) : ""],
            ["Amount", record.amount ? money(record.amount) : ""],
            [
              "Probability",
              record.probability === null || record.probability === undefined ? "" : `${text(record.probability)}%`
            ],
            ["Forecast Category", record.forecastCategory],
            ["Next Step", record.nextStep],
            ["Owner", owner?.name]
          ]
        : [
            ["Subject", record.subject],
            ["Account", account?.name, account ? `/lightning/r/Account/${id(account)}/view` : undefined],
            ["Contact", name(contact), contact ? `/lightning/r/Contact/${id(contact)}/view` : undefined],
            ["Origin", record.origin],
            ["Priority", record.priority],
            ["Opened", record.openedAt ? formatDateTime(text(record.openedAt)) : ""],
            ["Closed", record.closedAt ? formatDateTime(text(record.closedAt)) : ""],
            ["Owner", owner?.name]
          ];
  const related =
    object === "Opportunity"
      ? data.invoices.filter((invoice) => invoice.opportunityId === record.id)
      : object === "Case"
        ? []
        : data.campaignMembers.filter((member) => member.objectType === "Lead" && member.recordId === record.id);
  const activities = [...data.tasks, ...data.emailActivities, ...data.callActivities, ...data.events]
    .filter((item) => item.relatedRecordId === record.id || item.nameRecordId === record.id)
    .sort((left, right) =>
      text(right.createdAt || right.startAt || right.sentAt).localeCompare(
        text(left.createdAt || left.startAt || left.sentAt)
      )
    );
  return (
    <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-3">
        <div className="rounded-lg border border-[#e4e7ec] bg-white p-4 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex gap-3">
              <Icon className="text-brand-600" />
              <div>
                <div className="text-xs text-[#706e6b]">{object}</div>
                <h1 className="text-2xl font-semibold">{title}</h1>
                <div className="mt-2">
                  <Status value={record.status || record.stage} />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {object === "Lead" && !converted && (
                <button className={primary} onClick={() => onWorkflow("Convert Lead")}>
                  <CheckCircle2 size={13} /> Convert
                </button>
              )}
              {!(object === "Lead" && converted) && (
                <button className={secondary} onClick={onEdit}>
                  Edit
                </button>
              )}
              {!(object === "Lead" && converted) && (
                <button className={secondary} onClick={onChangeOwner}>
                  Change Owner
                </button>
              )}
              {!(object === "Lead" && converted) && (
                <button className={danger} onClick={onDelete}>
                  <Trash2 size={13} /> Delete
                </button>
              )}
            </div>
          </div>
          {object === "Lead" && converted && (
            <div className="mt-3 rounded border border-[#d8dde6] bg-[#f8f9fb] p-3 text-sm text-[#514f4d]">
              Converted Leads are read-only. Continue work from the linked Account, Contact, or Opportunity.
            </div>
          )}
        </div>
        <Card title={`${object} Details`}>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {details.map(([label, value, href]) => (
              <Detail key={label} label={label} value={value} href={href} />
            ))}
          </dl>
          {record.description && (
            <div className="mt-4 border-t border-[#eef1f6] pt-4">
              <div className="text-xs text-[#706e6b]">Description</div>
              <div className="mt-1 whitespace-pre-wrap text-sm">{text(record.description)}</div>
            </div>
          )}
        </Card>
        <Card
          title={
            object === "Opportunity"
              ? `Related Invoices (${related.length})`
              : object === "Lead"
                ? `Campaign Memberships (${related.length})`
                : "Related Records"
          }
        >
          {related.map((item) =>
            object === "Opportunity" ? (
              <Link
                key={id(item)}
                className="flex justify-between border-b border-[#eef1f6] py-2 text-sm text-brand-700 hover:underline"
                href={`/lightning/r/Invoice/${id(item)}/view`}
              >
                <span>{text(item.invoiceNumber)}</span>
                <span>{money(item.total)}</span>
              </Link>
            ) : (
              <div key={id(item)} className="border-b border-[#eef1f6] py-2 text-sm">
                {text(item.status)}
              </div>
            )
          )}
          {!related.length && (
            <div className="rounded border border-dashed border-[#d8dde6] p-5 text-center text-sm text-[#706e6b]">
              No related records yet.
            </div>
          )}
        </Card>
      </div>
      <Card title={`Activity (${activities.length})`}>
        {activities.slice(0, 12).map((activity) => (
          <div key={id(activity)} className="border-b border-[#eef1f6] py-3 text-sm last:border-0">
            <div className="font-semibold">
              {text(activity.subject || activity.notes || activity.body || "Activity")}
            </div>
            <div className="text-xs text-[#706e6b]">
              {formatDateTime(text(activity.createdAt || activity.startAt || activity.sentAt || activity.completedAt))}
            </div>
          </div>
        ))}
        {!activities.length && (
          <div className="text-sm text-[#706e6b]">No activity has been recorded for this {object.toLowerCase()}.</div>
        )}
      </Card>
    </section>
  );
}
