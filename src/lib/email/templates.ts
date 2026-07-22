import type { Prisma } from "@prisma/client";
import type { invoiceInclude } from "@/lib/invoices";

function text(value: unknown) {
  return String(value ?? "").trim();
}

function escapeHtml(value: unknown) {
  return text(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);
}

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(value));
}

function formatMoney(value: unknown, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(value ?? 0));
}

export function caseNotificationTemplate(input: {
  organizationName: string;
  caseNumber: string;
  status: string;
  subject?: string | null;
  description?: string | null;
}) {
  const subject = `Case ${input.caseNumber}: ${text(input.subject) || "Support case created"}`;
  const lines = [
    `${input.organizationName} created or updated your support case.`,
    "",
    `Case: ${input.caseNumber}`,
    `Status: ${input.status}`,
    ...(text(input.subject) ? [`Subject: ${text(input.subject)}`] : []),
    ...(text(input.description) ? ["", text(input.description)] : [])
  ];
  return { subject, text: lines.join("\n") };
}

type InvoiceDocument = Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }>;

export function invoiceEmailTemplate(invoice: InvoiceDocument, organizationName: string) {
  const total = formatMoney(invoice.total, invoice.currency);
  const dueDate = formatDate(invoice.dueDate);
  const subject = `Invoice ${invoice.invoiceNumber} from ${organizationName}`;
  const plainText = [
    `Hello ${invoice.billingName},`,
    "",
    `Please find invoice ${invoice.invoiceNumber} attached.`,
    `Total: ${total}`,
    `Due date: ${dueDate}`,
    "",
    text(invoice.terms),
    "",
    organizationName
  ].filter((line, index, lines) => line || (index > 0 && lines[index - 1] !== "")).join("\n");
  const html = `<p>Hello ${escapeHtml(invoice.billingName)},</p><p>Please find invoice <strong>${escapeHtml(invoice.invoiceNumber)}</strong> attached.</p><p><strong>Total:</strong> ${escapeHtml(total)}<br><strong>Due date:</strong> ${escapeHtml(dueDate)}</p>${invoice.terms ? `<p>${escapeHtml(invoice.terms).replace(/\n/g, "<br>")}</p>` : ""}<p>${escapeHtml(organizationName)}</p>`;
  return { subject, text: plainText, html };
}

