import "server-only";

import { Prisma } from "@prisma/client";
import { calculateInvoiceTotals, InvoiceInputError, money, type InvoiceLineInput } from "@/lib/invoice-calculations";
import { prisma } from "@/lib/prisma";
import type { RecordData } from "@/lib/crm-types";

export const INVOICE_STATUSES = ["Draft", "Sent", "Partially Paid", "Paid", "Overdue", "Void"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const invoiceInclude = {
  account: true,
  opportunity: true,
  lineItems: { include: { product: true }, orderBy: [{ displayOrder: "asc" as const }, { createdAt: "asc" as const }] },
  payments: { orderBy: [{ paymentDate: "desc" as const }, { createdAt: "desc" as const }] }
} satisfies Prisma.InvoiceInclude;

export class InvoiceDomainError extends Error {
  constructor(message: string, readonly status: 400 | 404 | 409 = 400, readonly field?: string) {
    super(message);
    this.name = "InvoiceDomainError";
  }
}

type Transaction = Prisma.TransactionClient;
type ExistingInvoice = Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }>;

function hasOwn(value: RecordData, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function valueFrom(payload: RecordData, key: string, fallback?: unknown) {
  return hasOwn(payload, key) ? payload[key] : fallback;
}

function optionalText(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value).trim();
  return text || null;
}

function requiredText(value: unknown, label: string) {
  const text = optionalText(value);
  if (!text) throw new InvoiceDomainError(`${label} is required.`, 400, label);
  return text;
}

function parseDate(value: unknown, label: string, fallback?: Date) {
  if ((value === null || value === undefined || value === "") && fallback) return new Date(fallback);
  const parsed = new Date(String(value ?? ""));
  if (Number.isNaN(parsed.getTime())) throw new InvoiceDomainError(`${label} must be a valid date.`, 400, label);
  return parsed;
}

function startOfTodayUtc() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function defaultDueDate(issueDate: Date) {
  const dueDate = new Date(issueDate);
  dueDate.setUTCDate(dueDate.getUTCDate() + 30);
  return dueDate;
}

function isPastDue(dueDate: Date) {
  return dueDate < startOfTodayUtc();
}

function toLineInput(line: RecordData, index: number, product?: { name: string; description: string | null }, defaultUnitPrice?: Prisma.Decimal | null): InvoiceLineInput {
  return {
    productId: optionalText(line.productId),
    description: optionalText(line.description) ?? product?.description ?? product?.name ?? "",
    quantity: valueFrom(line, "quantity", 1) as Prisma.Decimal.Value,
    unitPrice: valueFrom(line, "unitPrice", defaultUnitPrice ?? 0) as Prisma.Decimal.Value,
    discountAmount: valueFrom(line, "discountAmount", 0) as Prisma.Decimal.Value,
    taxRate: valueFrom(line, "taxRate", 0) as Prisma.Decimal.Value,
    displayOrder: Number.isInteger(Number(line.displayOrder)) ? Number(line.displayOrder) : index
  };
}

async function prepareAggregate(tx: Transaction, organizationId: string, payload: RecordData, existing?: ExistingInvoice) {
  const accountId = requiredText(valueFrom(payload, "accountId", existing?.accountId), "Account");
  const account = await tx.account.findFirst({ where: { id: accountId, organizationId } });
  if (!account) throw new InvoiceDomainError("The selected Account was not found in this organization.", 404, "accountId");

  const opportunityId = optionalText(valueFrom(payload, "opportunityId", existing?.opportunityId));
  if (opportunityId) {
    const opportunity = await tx.opportunity.findFirst({ where: { id: opportunityId, organizationId } });
    if (!opportunity) throw new InvoiceDomainError("The selected Opportunity was not found in this organization.", 404, "opportunityId");
    if (opportunity.accountId !== accountId) throw new InvoiceDomainError("The selected Opportunity must belong to the invoice Account.", 400, "opportunityId");
  }

  const issueDateFallback = existing?.issueDate ?? new Date();
  const issueDate = parseDate(valueFrom(payload, "issueDate", issueDateFallback), "Issue date", issueDateFallback);
  const dueDateFallback = existing?.dueDate ?? defaultDueDate(issueDate);
  const dueDate = parseDate(valueFrom(payload, "dueDate", dueDateFallback), "Due date", dueDateFallback);
  if (dueDate < issueDate) throw new InvoiceDomainError("Due date cannot precede issue date.", 400, "dueDate");

  const currency = requiredText(valueFrom(payload, "currency", existing?.currency ?? "USD"), "Currency").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new InvoiceDomainError("Currency must be a three-letter ISO code.", 400, "currency");

  const rawLines = hasOwn(payload, "lineItems")
    ? payload.lineItems
    : existing?.lineItems.map((line) => ({
        productId: line.productId,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountAmount: line.discountAmount,
        taxRate: line.taxRate,
        displayOrder: line.displayOrder
      })) ?? [];
  if (!Array.isArray(rawLines)) throw new InvoiceDomainError("Line items must be an array.", 400, "lineItems");
  const normalizedLines = rawLines.map((line, index) => {
    if (!line || typeof line !== "object" || Array.isArray(line)) throw new InvoiceDomainError(`Line ${index + 1} is invalid.`, 400, `lineItems.${index}`);
    return line as RecordData;
  });

  const productIds = Array.from(new Set(normalizedLines.map((line) => optionalText(line.productId)).filter((id): id is string => Boolean(id))));
  const products = productIds.length ? await tx.product.findMany({ where: { organizationId, id: { in: productIds } } }) : [];
  if (products.length !== productIds.length) throw new InvoiceDomainError("One or more selected Products were not found in this organization.", 404, "lineItems.productId");
  const productsById = new Map(products.map((product) => [product.id, product]));

  const priceEntries = productIds.length
    ? await tx.priceBookEntry.findMany({
        where: { organizationId, productId: { in: productIds }, active: true, currency, priceBook: { active: true } },
        include: { priceBook: true }
      })
    : [];
  priceEntries.sort((left, right) => Number(right.priceBook.isStandard) - Number(left.priceBook.isStandard));
  const pricesByProductId = new Map<string, Prisma.Decimal>();
  priceEntries.forEach((entry) => {
    if (entry.listPrice && !pricesByProductId.has(entry.productId)) pricesByProductId.set(entry.productId, entry.listPrice);
  });

  let calculated;
  try {
    calculated = calculateInvoiceTotals(normalizedLines.map((line, index) => {
      const productId = optionalText(line.productId);
      return toLineInput(line, index, productId ? productsById.get(productId) : undefined, productId ? pricesByProductId.get(productId) : undefined);
    }));
  } catch (error) {
    if (error instanceof InvoiceInputError) throw new InvoiceDomainError(error.message, 400, error.field);
    throw error;
  }

  return {
    header: {
      accountId,
      opportunityId,
      issueDate,
      dueDate,
      currency,
      purchaseOrderNumber: optionalText(valueFrom(payload, "purchaseOrderNumber", existing?.purchaseOrderNumber)),
      billingName: optionalText(valueFrom(payload, "billingName", existing?.billingName)) ?? account.name,
      billingStreet: optionalText(valueFrom(payload, "billingStreet", existing?.billingStreet ?? account.billingStreet)),
      billingCity: optionalText(valueFrom(payload, "billingCity", existing?.billingCity ?? account.billingCity)),
      billingState: optionalText(valueFrom(payload, "billingState", existing?.billingState ?? account.billingState)),
      billingPostalCode: optionalText(valueFrom(payload, "billingPostalCode", existing?.billingPostalCode ?? account.billingPostalCode)),
      billingCountry: optionalText(valueFrom(payload, "billingCountry", existing?.billingCountry ?? account.billingCountry)),
      notes: optionalText(valueFrom(payload, "notes", existing?.notes)),
      terms: optionalText(valueFrom(payload, "terms", existing?.terms))
    },
    calculated
  };
}

async function allocateInvoiceNumber(tx: Transaction, organizationId: string) {
  const rows = await tx.$queryRaw<Array<{ allocatedNumber: number }>>(Prisma.sql`
    INSERT INTO "InvoiceNumberSequence" ("organizationId", "nextNumber", "updatedAt")
    VALUES (${organizationId}, 2, CURRENT_TIMESTAMP)
    ON CONFLICT ("organizationId") DO UPDATE
      SET "nextNumber" = "InvoiceNumberSequence"."nextNumber" + 1,
          "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "nextNumber" - 1 AS "allocatedNumber"
  `);
  const allocated = Number(rows[0]?.allocatedNumber);
  if (!Number.isInteger(allocated) || allocated < 1) throw new InvoiceDomainError("Unable to allocate an invoice number.", 409);
  return `INV-${String(allocated).padStart(6, "0")}`;
}

async function createNotification(tx: Transaction, values: { organizationId: string; userId: string; title: string; body: string; invoiceId: string }) {
  return tx.notification.create({
    data: {
      organizationId: values.organizationId,
      userId: values.userId,
      title: values.title,
      body: values.body,
      href: `/lightning/r/Invoice/${values.invoiceId}/view`,
      category: "Invoices"
    }
  });
}

export async function markPastDueInvoices(organizationId: string, userId: string) {
  const candidates = await prisma.invoice.findMany({
    where: { organizationId, status: { in: ["Sent", "Partially Paid"] }, dueDate: { lt: startOfTodayUtc() } },
    select: { id: true, invoiceNumber: true }
  });
  if (candidates.length === 0) return [];

  return prisma.$transaction(async (tx) => {
    const notifications = [];
    for (const candidate of candidates) {
      const updated = await tx.invoice.updateMany({
        where: { id: candidate.id, organizationId, status: { in: ["Sent", "Partially Paid"] }, dueDate: { lt: startOfTodayUtc() } },
        data: { status: "Overdue" }
      });
      if (updated.count) {
        notifications.push(await createNotification(tx, {
          organizationId,
          userId,
          invoiceId: candidate.id,
          title: "Invoice overdue",
          body: `${candidate.invoiceNumber} is past its due date.`
        }));
      }
    }
    return notifications;
  });
}

export async function listInvoices(organizationId: string, userId: string) {
  await markPastDueInvoices(organizationId, userId);
  return prisma.invoice.findMany({ where: { organizationId }, include: invoiceInclude, orderBy: { updatedAt: "desc" } });
}

export async function getInvoice(organizationId: string, userId: string, id: string) {
  await markPastDueInvoices(organizationId, userId);
  const invoice = await prisma.invoice.findFirst({ where: { id, organizationId }, include: invoiceInclude });
  if (!invoice) throw new InvoiceDomainError("Invoice not found.", 404);
  await prisma.globalSearchRecent.upsert({
    where: { organizationId_userId_href: { organizationId, userId, href: `/lightning/r/Invoice/${id}/view` } },
    update: { label: invoice.invoiceNumber, context: "Invoice", category: "Record", query: null, updatedAt: new Date() },
    create: { organizationId, userId, label: invoice.invoiceNumber, context: "Invoice", href: `/lightning/r/Invoice/${id}/view`, category: "Record" }
  });
  return invoice;
}

export async function createInvoice(organizationId: string, userId: string, payload: RecordData) {
  return prisma.$transaction(async (tx) => {
    const { header, calculated } = await prepareAggregate(tx, organizationId, payload);
    const invoiceNumber = await allocateInvoiceNumber(tx, organizationId);
    const invoice = await tx.invoice.create({
      data: {
        organizationId,
        invoiceNumber,
        ...header,
        status: "Draft",
        subtotal: calculated.subtotal,
        discountTotal: calculated.discountTotal,
        taxTotal: calculated.taxTotal,
        total: calculated.total,
        amountPaid: 0,
        balanceDue: calculated.total,
        createdById: userId,
        lineItems: { create: calculated.lineItems }
      },
      include: invoiceInclude
    });
    const notification = await createNotification(tx, {
      organizationId,
      userId,
      invoiceId: invoice.id,
      title: "Invoice created",
      body: `${invoice.invoiceNumber} was created as a draft.`
    });
    return { invoice, notifications: [notification] };
  });
}

export async function updateInvoice(organizationId: string, userId: string, id: string, payload: RecordData) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.invoice.findFirst({ where: { id, organizationId }, include: invoiceInclude });
    if (!existing) throw new InvoiceDomainError("Invoice not found.", 404);
    if (existing.status !== "Draft") throw new InvoiceDomainError("Only Draft invoices can be edited.", 409);
    const { header, calculated } = await prepareAggregate(tx, organizationId, payload, existing);

    if (hasOwn(payload, "lineItems")) {
      await tx.invoiceLineItem.deleteMany({ where: { invoiceId: id } });
      if (calculated.lineItems.length) await tx.invoiceLineItem.createMany({ data: calculated.lineItems.map((line) => ({ invoiceId: id, ...line })) });
    }
    const invoice = await tx.invoice.update({
      where: { id },
      data: {
        ...header,
        subtotal: calculated.subtotal,
        discountTotal: calculated.discountTotal,
        taxTotal: calculated.taxTotal,
        total: calculated.total,
        amountPaid: 0,
        balanceDue: calculated.total
      },
      include: invoiceInclude
    });
    return { invoice, notifications: [] };
  });
}

export async function deleteDraftInvoice(organizationId: string, id: string) {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({ where: { id, organizationId }, include: { payments: { select: { id: true } } } });
    if (!invoice) throw new InvoiceDomainError("Invoice not found.", 404);
    if (invoice.status !== "Draft") throw new InvoiceDomainError("Only Draft invoices can be deleted.", 409);
    if (invoice.payments.length) throw new InvoiceDomainError("An invoice with payment history cannot be deleted.", 409);
    await tx.invoiceLineItem.deleteMany({ where: { invoiceId: id } });
    await tx.invoice.delete({ where: { id } });
    return invoice;
  });
}

export async function performInvoiceAction(organizationId: string, userId: string, id: string, action: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Invoice" WHERE "id" = ${id} AND "organizationId" = ${organizationId} FOR UPDATE`);
    const existing = await tx.invoice.findFirst({ where: { id, organizationId }, include: invoiceInclude });
    if (!existing) throw new InvoiceDomainError("Invoice not found.", 404);

    let status: InvoiceStatus;
    let title: string;
    let body: string;
    let timestamps: Pick<Prisma.InvoiceUpdateInput, "sentAt" | "voidedAt"> = {};
    if (action === "mark-sent") {
      if (existing.status !== "Draft") throw new InvoiceDomainError("Only a Draft invoice can be marked Sent.", 409);
      if (!existing.lineItems.length) throw new InvoiceDomainError("Add at least one valid line item before marking the invoice Sent.", 400, "lineItems");
      status = "Sent";
      timestamps = { sentAt: new Date() };
      title = "Invoice sent";
      body = `${existing.invoiceNumber} was marked as sent after external delivery.`;
    } else if (action === "mark-overdue") {
      if (!["Sent", "Partially Paid"].includes(existing.status) || !isPastDue(existing.dueDate)) {
        throw new InvoiceDomainError("Only a past-due Sent or Partially Paid invoice can be marked Overdue.", 409);
      }
      status = "Overdue";
      title = "Invoice overdue";
      body = `${existing.invoiceNumber} was marked overdue.`;
    } else if (action === "void") {
      if (!["Sent", "Partially Paid", "Overdue"].includes(existing.status)) throw new InvoiceDomainError("Only an outstanding invoice can be voided.", 409);
      if (existing.payments.length || existing.amountPaid.gt(0)) throw new InvoiceDomainError("Invoices with payments cannot be voided without a reversal mechanism.", 409);
      status = "Void";
      timestamps = { voidedAt: new Date() };
      title = "Invoice voided";
      body = `${existing.invoiceNumber} was voided.`;
    } else {
      throw new InvoiceDomainError("Unknown invoice action.", 400, "action");
    }

    const invoice = await tx.invoice.update({ where: { id }, data: { status, ...timestamps }, include: invoiceInclude });
    const notification = await createNotification(tx, { organizationId, userId, invoiceId: id, title, body });
    return { invoice, notifications: [notification] };
  });
}

export async function markInvoiceSentAfterDelivery(organizationId: string, userId: string, id: string, recipientEmail: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Invoice" WHERE "id" = ${id} AND "organizationId" = ${organizationId} FOR UPDATE`);
    const existing = await tx.invoice.findFirst({ where: { id, organizationId }, include: invoiceInclude });
    if (!existing) throw new InvoiceDomainError("Invoice not found.", 404);
    if (existing.status !== "Draft") throw new InvoiceDomainError("Only a Draft invoice can be sent.", 409);
    if (!existing.lineItems.length) throw new InvoiceDomainError("Add at least one valid line item before sending the invoice.", 400, "lineItems");
    const invoice = await tx.invoice.update({
      where: { id },
      data: { status: "Sent", sentAt: new Date() },
      include: invoiceInclude
    });
    const notification = await createNotification(tx, {
      organizationId,
      userId,
      invoiceId: id,
      title: "Invoice sent",
      body: `${existing.invoiceNumber} was accepted for delivery to ${recipientEmail}.`
    });
    return { invoice, notifications: [notification] };
  });
}

export async function recordInvoicePayment(organizationId: string, userId: string, id: string, payload: RecordData) {
  let amount: Prisma.Decimal;
  try {
    amount = money(new Prisma.Decimal(String(payload.amount ?? "")));
  } catch {
    throw new InvoiceDomainError("Payment amount must be a valid number.", 400, "amount");
  }
  if (amount.lte(0)) throw new InvoiceDomainError("Payment amount must be greater than zero.", 400, "amount");
  const paymentDate = parseDate(payload.paymentDate, "Payment date");
  const paymentMethod = requiredText(payload.paymentMethod, "Payment method");

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Invoice" WHERE "id" = ${id} AND "organizationId" = ${organizationId} FOR UPDATE`);
    const existing = await tx.invoice.findFirst({ where: { id, organizationId }, include: invoiceInclude });
    if (!existing) throw new InvoiceDomainError("Invoice not found.", 404);
    if (!["Sent", "Partially Paid", "Overdue"].includes(existing.status)) {
      throw new InvoiceDomainError("Payments can only be recorded against Sent, Partially Paid, or Overdue invoices.", 409);
    }
    const currentPaid = money(existing.payments.reduce((sum, payment) => sum.plus(payment.amount), new Prisma.Decimal(0)));
    const outstanding = money(existing.total.minus(currentPaid));
    if (amount.gt(outstanding)) throw new InvoiceDomainError(`Payment cannot exceed the outstanding balance of ${outstanding.toFixed(2)} ${existing.currency}.`, 400, "amount");

    await tx.invoicePayment.create({
      data: {
        invoiceId: id,
        amount,
        paymentDate,
        paymentMethod,
        referenceNumber: optionalText(payload.referenceNumber),
        notes: optionalText(payload.notes),
        recordedById: userId
      }
    });
    const amountPaid = money(currentPaid.plus(amount));
    const balanceDue = money(existing.total.minus(amountPaid));
    const paid = balanceDue.eq(0);
    const status: InvoiceStatus = paid ? "Paid" : isPastDue(existing.dueDate) ? "Overdue" : "Partially Paid";
    const invoice = await tx.invoice.update({
      where: { id },
      data: { amountPaid, balanceDue, status, paidAt: paid ? new Date() : null },
      include: invoiceInclude
    });
    const notifications = [await createNotification(tx, {
      organizationId,
      userId,
      invoiceId: id,
      title: "Invoice payment recorded",
      body: `${amount.toFixed(2)} ${existing.currency} was recorded against ${existing.invoiceNumber}.`
    })];
    if (paid) notifications.push(await createNotification(tx, {
      organizationId,
      userId,
      invoiceId: id,
      title: "Invoice paid",
      body: `${existing.invoiceNumber} is paid in full.`
    }));
    return { invoice, notifications };
  });
}
