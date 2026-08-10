import "server-only";

import { AppAuthorizationError } from "@/lib/authorization-errors";
import { campaignInclude } from "@/lib/campaigns";
import type { GenericRecord, RecordDetail } from "@/lib/api/contracts";
import { invoiceInclude } from "@/lib/invoices";
import { opportunityProductInclude, opportunityProductOrder } from "@/lib/opportunity-products";
import { prisma } from "@/lib/prisma";
import type { CrmObject } from "@/lib/crm-types";

type DetailDelegate = {
  findFirst(arguments_: Record<string, unknown>): Promise<GenericRecord | null>;
};

const storedFileMetadataSelect = {
  id: true,
  organizationId: true,
  name: true,
  size: true,
  contentType: true,
  checksum: true,
  relatedObjectType: true,
  relatedRecordId: true,
  uploadedById: true,
  uploadedAt: true
} as const;

function delegate(value: unknown): DetailDelegate {
  return value as DetailDelegate;
}

function recordDelegate(object: CrmObject) {
  switch (object) {
    case "Account":
      return { delegate: delegate(prisma.account) };
    case "Contact":
      return { delegate: delegate(prisma.contact), include: { account: true } };
    case "Lead":
      return { delegate: delegate(prisma.lead) };
    case "Opportunity":
      return {
        delegate: delegate(prisma.opportunity),
        include: {
          account: true,
          contact: true,
          products: { include: opportunityProductInclude, orderBy: opportunityProductOrder }
        }
      };
    case "Product2":
      return { delegate: delegate(prisma.product), include: { entries: { include: { priceBook: true } } } };
    case "Pricebook2":
      return { delegate: delegate(prisma.priceBook), include: { entries: { include: { product: true } } } };
    case "Event":
      return { delegate: delegate(prisma.event), include: { calendarSource: true } };
    case "Case":
      return { delegate: delegate(prisma.caseRecord), include: { account: true, contact: true } };
    case "QuickText":
      return { delegate: delegate(prisma.quickText), include: { folder: true } };
    case "MessagingSession":
      return {
        delegate: delegate(prisma.messagingSession),
        include: { account: true, contact: true, participants: true, messages: true }
      };
    case "Knowledge__kav":
      return { delegate: delegate(prisma.knowledgeArticle), include: { feedback: true } };
    case "ListEmail":
      return { delegate: delegate(prisma.listEmail) };
    case "Campaign":
      return { delegate: delegate(prisma.campaign), include: campaignInclude };
    case "Invoice":
      return {
        delegate: delegate(prisma.invoice),
        include: invoiceInclude
      };
    case "VideoCall":
      return {
        delegate: delegate(prisma.videoCall),
        include: { account: true, contact: true, opportunity: true, participants: true }
      };
  }
}

async function accountRelated(organizationId: string, id: string) {
  const relationship = { organizationId, relatedObjectType: "Account", relatedRecordId: id };
  const [contacts, opportunities, cases, partners, files, attachments, tasks, emails, calls, events] =
    await Promise.all([
      prisma.contact.findMany({ where: { organizationId, accountId: id }, orderBy: { updatedAt: "desc" } }),
      prisma.opportunity.findMany({
        where: { organizationId, accountId: id },
        orderBy: { updatedAt: "desc" }
      }),
      prisma.caseRecord.findMany({ where: { organizationId, accountId: id }, orderBy: { updatedAt: "desc" } }),
      prisma.partner.findMany({ where: { organizationId, accountId: id } }),
      prisma.fileRecord.findMany({
        where: relationship,
        select: storedFileMetadataSelect,
        orderBy: { uploadedAt: "desc" }
      }),
      prisma.attachmentRecord.findMany({
        where: relationship,
        select: storedFileMetadataSelect,
        orderBy: { uploadedAt: "desc" }
      }),
      prisma.task.findMany({ where: relationship, orderBy: { updatedAt: "desc" } }),
      prisma.emailActivity.findMany({ where: relationship, orderBy: { sentAt: "desc" } }),
      prisma.callActivity.findMany({ where: relationship, orderBy: { completedAt: "desc" } }),
      prisma.event.findMany({ where: relationship, orderBy: { startAt: "desc" } })
    ]);
  return { contacts, opportunities, cases, partners, files, attachments, tasks, emails, calls, events };
}

async function contactRelated(organizationId: string, id: string) {
  const relationship = { organizationId, relatedObjectType: "Contact", relatedRecordId: id };
  const [opportunities, cases, files, attachments, tasks, emails, calls, events] = await Promise.all([
    prisma.opportunity.findMany({
      where: { organizationId, contactId: id },
      orderBy: { updatedAt: "desc" }
    }),
    prisma.caseRecord.findMany({ where: { organizationId, contactId: id }, orderBy: { updatedAt: "desc" } }),
    prisma.fileRecord.findMany({
      where: relationship,
      select: storedFileMetadataSelect,
      orderBy: { uploadedAt: "desc" }
    }),
    prisma.attachmentRecord.findMany({
      where: relationship,
      select: storedFileMetadataSelect,
      orderBy: { uploadedAt: "desc" }
    }),
    prisma.task.findMany({ where: relationship, orderBy: { updatedAt: "desc" } }),
    prisma.emailActivity.findMany({ where: relationship, orderBy: { sentAt: "desc" } }),
    prisma.callActivity.findMany({ where: relationship, orderBy: { completedAt: "desc" } }),
    prisma.event.findMany({ where: relationship, orderBy: { startAt: "desc" } })
  ]);
  return { opportunities, cases, files, attachments, tasks, emails, calls, events };
}

export async function getRecordDetail(
  organizationId: string,
  object: CrmObject,
  id: string
): Promise<RecordDetail<GenericRecord, Record<string, unknown>>> {
  const config = recordDelegate(object);
  const record = await config.delegate.findFirst({
    where: { id, organizationId },
    ...(config.include ? { include: config.include } : {})
  });
  if (!record) throw new AppAuthorizationError("Record not found.", 404);

  const related =
    object === "Account"
      ? await accountRelated(organizationId, id)
      : object === "Contact"
        ? await contactRelated(organizationId, id)
        : {};
  // Carry live carrier status alongside the record so the detail page can render it without
  // a second round trip.
  const shipment =
    object === "Opportunity"
      ? await prisma.shipmentTracking.findUnique({
          where: { organizationId_subjectType_subjectId: { organizationId, subjectType: "Opportunity", subjectId: id } }
        })
      : null;
  return JSON.parse(JSON.stringify({ record: shipment ? { ...record, shipment } : record, related })) as RecordDetail<
    GenericRecord,
    Record<string, unknown>
  >;
}
