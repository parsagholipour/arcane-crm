import { CURRENT_USER } from "@/lib/crm-metadata";
import { prisma } from "@/lib/prisma";
import type { CrmObject, RecordData } from "@/lib/crm-types";
import { NextRequest, NextResponse } from "next/server";

type Params = Promise<{ object: string; id: string }>;

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, context: { params: Params }) {
  const { object, id } = await context.params;
  if (!isCrmObject(object)) {
    return NextResponse.json({ error: "Unknown object." }, { status: 404 });
  }
  const payload = normalizePayload(await request.json());

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ record: { ...payload, id, updatedAt: new Date().toISOString(), updatedById: CURRENT_USER.id } });
  }

  try {
    const record = await updateRecord(object, id, payload);
    return NextResponse.json({ record: JSON.parse(JSON.stringify(record)) });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unable to update record." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: { params: Params }) {
  const { object, id } = await context.params;
  if (!isCrmObject(object)) {
    return NextResponse.json({ error: "Unknown object." }, { status: 404 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: true });
  }

  try {
    await deleteRecord(object, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unable to delete record." }, { status: 500 });
  }
}

function isCrmObject(value: string): value is CrmObject {
  return ["Account", "Contact", "Lead", "Opportunity", "Product2", "Pricebook2", "Event", "Case", "QuickText", "Knowledge__kav", "ListEmail"].includes(value);
}

function normalizePayload(payload: RecordData) {
  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => {
      if (value === "--None--" || value === "") return [key, null];
      return [key, value];
    })
  ) as RecordData;
}

async function updateRecord(object: CrmObject, id: string, payload: RecordData) {
  switch (object) {
    case "Account":
      return prisma.account.update({
        where: { id },
        data: {
          name: payload.name ? String(payload.name) : undefined,
          website: payload.website as string | null | undefined,
          type: payload.type as string | null | undefined,
          description: payload.description as string | null | undefined,
          parentAccountId: payload.parentAccountId as string | null | undefined,
          phone: payload.phone as string | null | undefined,
          billingCountry: payload.billingCountry as string | null | undefined,
          billingStreet: payload.billingStreet as string | null | undefined,
          billingPostalCode: payload.billingPostalCode as string | null | undefined,
          billingCity: payload.billingCity as string | null | undefined,
          billingState: payload.billingState as string | null | undefined,
          shippingCountry: payload.shippingCountry as string | null | undefined,
          shippingStreet: payload.shippingStreet as string | null | undefined,
          shippingPostalCode: payload.shippingPostalCode as string | null | undefined,
          shippingCity: payload.shippingCity as string | null | undefined,
          shippingState: payload.shippingState as string | null | undefined,
          updatedById: CURRENT_USER.id
        }
      });
    case "Contact":
      return prisma.contact.update({
        where: { id },
        data: {
          salutation: payload.salutation as string | null | undefined,
          firstName: payload.firstName as string | null | undefined,
          lastName: payload.lastName ? String(payload.lastName) : undefined,
          accountId: payload.accountId ? String(payload.accountId) : undefined,
          title: payload.title as string | null | undefined,
          reportsToContactId: payload.reportsToContactId as string | null | undefined,
          description: payload.description as string | null | undefined,
          phone: payload.phone as string | null | undefined,
          email: payload.email as string | null | undefined,
          mailingCountry: payload.mailingCountry as string | null | undefined,
          mailingStreet: payload.mailingStreet as string | null | undefined,
          mailingPostalCode: payload.mailingPostalCode as string | null | undefined,
          mailingCity: payload.mailingCity as string | null | undefined,
          mailingState: payload.mailingState as string | null | undefined,
          updatedById: CURRENT_USER.id
        }
      });
    case "Lead":
      return prisma.lead.update({
        where: { id },
        data: {
          status: payload.status ? String(payload.status) : undefined,
          salutation: payload.salutation as string | null | undefined,
          firstName: payload.firstName as string | null | undefined,
          lastName: payload.lastName ? String(payload.lastName) : undefined,
          company: payload.company ? String(payload.company) : undefined,
          title: payload.title as string | null | undefined,
          website: payload.website as string | null | undefined,
          description: payload.description as string | null | undefined,
          ownerId: payload.ownerId ? String(payload.ownerId) : undefined,
          rating: payload.rating as string | null | undefined,
          phone: payload.phone as string | null | undefined,
          email: payload.email as string | null | undefined,
          country: payload.country as string | null | undefined,
          street: payload.street as string | null | undefined,
          postalCode: payload.postalCode as string | null | undefined,
          city: payload.city as string | null | undefined,
          state: payload.state as string | null | undefined,
          numberOfEmployees: payload.numberOfEmployees === undefined ? undefined : payload.numberOfEmployees === null ? null : Number(payload.numberOfEmployees),
          annualRevenue: payload.annualRevenue === undefined ? undefined : payload.annualRevenue === null ? null : String(payload.annualRevenue),
          leadSource: payload.leadSource as string | null | undefined,
          industry: payload.industry as string | null | undefined,
          updatedById: CURRENT_USER.id
        }
      });
    case "Opportunity":
      return prisma.opportunity.update({
        where: { id },
        data: {
          name: payload.name ? String(payload.name) : undefined,
          accountId: payload.accountId ? String(payload.accountId) : undefined,
          contactId: payload.contactId as string | null | undefined,
          closeDate: payload.closeDate ? new Date(String(payload.closeDate)) : undefined,
          amount: payload.amount === undefined ? undefined : payload.amount === null ? null : String(payload.amount),
          description: payload.description as string | null | undefined,
          ownerId: payload.ownerId ? String(payload.ownerId) : undefined,
          stage: payload.stage ? String(payload.stage) : undefined,
          probability: payload.probability === undefined ? undefined : payload.probability === null ? null : Number(payload.probability),
          forecastCategory: payload.forecastCategory ? String(payload.forecastCategory) : undefined,
          nextStep: payload.nextStep as string | null | undefined,
          updatedById: CURRENT_USER.id
        }
      });
    case "Case":
      return prisma.caseRecord.update({
        where: { id },
        data: {
          status: payload.status ? String(payload.status) : undefined,
          origin: payload.origin as string | null | undefined,
          priority: payload.priority ? String(payload.priority) : undefined,
          ownerId: payload.ownerId ? String(payload.ownerId) : undefined,
          contactId: payload.contactId as string | null | undefined,
          accountId: payload.accountId as string | null | undefined,
          subject: payload.subject as string | null | undefined,
          description: payload.description as string | null | undefined,
          sendNotificationEmailToContact: payload.sendNotificationEmailToContact === undefined ? undefined : Boolean(payload.sendNotificationEmailToContact),
          closedAt: payload.status === "Closed" ? new Date() : undefined,
          updatedById: CURRENT_USER.id
        }
      });
    case "Product2":
      return prisma.product.update({
        where: { id },
        data: {
          name: payload.name ? String(payload.name) : undefined,
          family: payload.family as string | null | undefined,
          productCode: payload.productCode as string | null | undefined,
          sku: payload.sku as string | null | undefined,
          active: payload.active === undefined ? undefined : Boolean(payload.active),
          description: payload.description as string | null | undefined
        }
      });
    case "Pricebook2":
      return prisma.priceBook.update({
        where: { id },
        data: {
          name: payload.name ? String(payload.name) : undefined,
          active: payload.active === undefined ? undefined : Boolean(payload.active),
          description: payload.description as string | null | undefined,
          isStandard: payload.isStandard === undefined ? undefined : Boolean(payload.isStandard),
          validFrom: payload.validFrom ? new Date(String(payload.validFrom)) : payload.validFrom === null ? null : undefined,
          validTo: payload.validTo ? new Date(String(payload.validTo)) : payload.validTo === null ? null : undefined
        }
      });
    case "Event":
      return prisma.event.update({
        where: { id },
        data: {
          subject: payload.subject ? String(payload.subject) : undefined,
          description: payload.description as string | null | undefined,
          startAt: payload.startAt ? new Date(String(payload.startAt)) : undefined,
          endAt: payload.endAt ? new Date(String(payload.endAt)) : undefined,
          attendeeIds: Array.isArray(payload.attendeeIds) ? payload.attendeeIds.map(String) : undefined,
          nameObjectType: payload.nameObjectType as string | null | undefined,
          nameRecordId: payload.nameRecordId as string | null | undefined,
          relatedObjectType: payload.relatedObjectType as string | null | undefined,
          relatedRecordId: payload.relatedRecordId as string | null | undefined,
          assignedToId: payload.assignedToId ? String(payload.assignedToId) : undefined,
          location: payload.location as string | null | undefined,
          showTimeAs: payload.showTimeAs ? String(payload.showTimeAs) : undefined,
          allDay: payload.allDay === undefined ? undefined : Boolean(payload.allDay),
          private: payload.private === undefined ? undefined : Boolean(payload.private)
        }
      });
    case "QuickText":
      return prisma.quickText.update({
        where: { id },
        data: {
          name: payload.name ? String(payload.name) : undefined,
          message: payload.message ? String(payload.message) : undefined,
          folderId: payload.folderId as string | null | undefined,
          category: payload.category ? String(payload.category) : undefined,
          channels: Array.isArray(payload.channels) ? payload.channels.map(String) : undefined,
          mergeFields: Array.isArray(payload.mergeFields) ? payload.mergeFields.map(String) : undefined
        }
      });
    case "ListEmail": {
      const listEmailStatus = payload.status ? String(payload.status) : undefined;
      return prisma.listEmail.update({
        where: { id },
        data: {
          layoutType: payload.layoutType ? String(payload.layoutType) : undefined,
          subject: payload.subject as string | null | undefined,
          body: payload.body as string | null | undefined,
          recipientType: payload.recipientType as string | null | undefined,
          recipients: Array.isArray(payload.recipients) ? payload.recipients.map(String) : undefined,
          status: listEmailStatus,
          sentAt: listEmailStatus === "Sent" ? new Date() : undefined,
          scheduledAt: payload.scheduledAt ? new Date(String(payload.scheduledAt)) : payload.scheduledAt === null ? null : undefined
        }
      });
    }
    case "Knowledge__kav":
      return prisma.knowledgeArticle.update({
        where: { id },
        data: {
          title: payload.title ? String(payload.title) : undefined,
          urlName: payload.urlName ? String(payload.urlName) : undefined,
          summary: payload.summary as string | null | undefined,
          bodyRichText: payload.bodyRichText as string | null | undefined,
          visibleInInternalApp: payload.visibleInInternalApp === undefined ? undefined : Boolean(payload.visibleInInternalApp),
          visibleToCustomer: payload.visibleToCustomer === undefined ? undefined : Boolean(payload.visibleToCustomer),
          updatedById: CURRENT_USER.id
        }
      });
    default:
      throw new Error(`Update is not supported for ${object}`);
  }
}

async function deleteRecord(object: CrmObject, id: string) {
  switch (object) {
    case "Account":
      return prisma.account.delete({ where: { id } });
    case "Contact":
      return prisma.contact.delete({ where: { id } });
    case "Lead":
      return prisma.lead.delete({ where: { id } });
    case "Opportunity":
      return prisma.opportunity.delete({ where: { id } });
    case "Case":
      return prisma.caseRecord.delete({ where: { id } });
    case "Product2":
      return prisma.product.delete({ where: { id } });
    case "Pricebook2":
      return prisma.priceBook.delete({ where: { id } });
    case "Event":
      return prisma.event.delete({ where: { id } });
    case "QuickText":
      return prisma.quickText.delete({ where: { id } });
    case "Knowledge__kav":
      return prisma.knowledgeArticle.delete({ where: { id } });
    case "ListEmail":
      return prisma.listEmail.delete({ where: { id } });
    default:
      throw new Error(`Delete is not supported for ${object}`);
  }
}
