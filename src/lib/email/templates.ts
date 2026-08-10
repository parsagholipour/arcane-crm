import type { Prisma } from "@prisma/client";
import type { invoiceInclude } from "@/lib/invoices";
import { BRAND } from "@/lib/brand";

function text(value: unknown) {
  return String(value ?? "").trim();
}

function escapeHtml(value: unknown) {
  return text(value).replace(
    /[&<>"']/g,
    (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character
  );
}

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(
    new Date(value)
  );
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

export function calendarReminderTemplate(input: {
  organizationName: string;
  eventSubject: string;
  startText: string;
  endText: string;
  allDay: boolean;
  location?: string | null;
  eventUrl: string;
}) {
  const subject = `Reminder: ${text(input.eventSubject)}`;
  const schedule = input.allDay
    ? [
        `Date: ${text(input.startText)}`,
        ...(input.endText && input.endText !== input.startText ? [`Ends: ${text(input.endText)}`] : [])
      ]
    : [`Starts: ${text(input.startText)}`, `Ends: ${text(input.endText)}`];
  const plainText = [
    `${input.organizationName} calendar reminder`,
    "",
    text(input.eventSubject),
    ...schedule,
    ...(text(input.location) ? [`Location: ${text(input.location)}`] : []),
    "",
    `Open event: ${input.eventUrl}`
  ].join("\n");
  const html = [
    `<div style="font-family:Arial,sans-serif;color:#181818">`,
    `<p style="color:#706e6b">${escapeHtml(input.organizationName)} calendar reminder</p>`,
    `<h2>${escapeHtml(input.eventSubject)}</h2>`,
    `<p>${schedule.map((line) => escapeHtml(line)).join("<br>")}${text(input.location) ? `<br><strong>Location:</strong> ${escapeHtml(input.location)}` : ""}</p>`,
    `<p><a href="${escapeHtml(input.eventUrl)}">Open event</a></p>`,
    `</div>`
  ].join("");
  return { subject, text: plainText, html };
}

export function shipmentStatusTemplate(input: {
  organizationName: string;
  carrier: string;
  trackingNumber: string;
  subjectLabel: string;
  statusLabel: string;
  statusSummary?: string | null;
  delivered: boolean;
  /** Opportunity follow-up nudge this many days after delivery. */
  followUpDays?: number;
  recordUrl: string;
  carrierUrl?: string | null;
}) {
  const headline = input.followUpDays
    ? "Follow up after delivery"
    : input.delivered
      ? "Package delivered"
      : "Shipment needs attention";
  const subject = `${headline}: ${text(input.trackingNumber)}`;
  const lines = [
    `${text(input.carrier)} ${text(input.trackingNumber)}`,
    `Status: ${text(input.statusLabel)}`,
    `Record: ${text(input.subjectLabel)}`,
    ...(input.followUpDays
      ? [`At least ${input.followUpDays} days have passed since delivery — a good time to follow up.`]
      : [])
  ];
  const plainText = [
    `${text(input.organizationName)} shipment update`,
    "",
    headline,
    ...lines,
    ...(text(input.statusSummary) ? ["", text(input.statusSummary)] : []),
    "",
    `Open record: ${input.recordUrl}`,
    ...(input.carrierUrl ? [`Track with ${text(input.carrier)}: ${input.carrierUrl}`] : [])
  ].join("\n");
  const html = [
    `<div style="font-family:Arial,sans-serif;color:#181818">`,
    `<p style="color:#706e6b">${escapeHtml(input.organizationName)} shipment update</p>`,
    `<h2>${escapeHtml(headline)}</h2>`,
    `<p>${lines.map((line) => escapeHtml(line)).join("<br>")}</p>`,
    ...(text(input.statusSummary) ? [`<p>${escapeHtml(input.statusSummary)}</p>`] : []),
    `<p><a href="${escapeHtml(input.recordUrl)}">Open record</a>`,
    ...(input.carrierUrl
      ? [` &middot; <a href="${escapeHtml(input.carrierUrl)}">Track with ${escapeHtml(input.carrier)}</a>`]
      : []),
    `</p>`,
    `</div>`
  ].join("");
  return { subject, text: plainText, html };
}

export function organizationInvitationTemplate(input: {
  recipientName: string;
  organizationName: string;
  role: "ADMIN" | "MEMBER";
  activationUrl: string;
  newIdentity: boolean;
}) {
  const recipientName = text(input.recipientName) || "there";
  const organizationName = text(input.organizationName);
  const role = input.role === "ADMIN" ? "administrator" : "member";
  const subject = `You've been invited to ${organizationName} in ${BRAND.name}`;
  const accountGuidance = input.newIdentity
    ? `You will also receive a separate ${BRAND.name} account setup email. Complete it first to verify your email and choose a password.`
    : `Use your existing ${BRAND.name} account to sign in.`;
  const plainText = [
    `Hello ${recipientName},`,
    "",
    `You now have ${role} access to ${organizationName} in ${BRAND.product}.`,
    accountGuidance,
    "",
    `Open ${BRAND.name}: ${input.activationUrl}`,
    "",
    "If you were not expecting this invitation, contact the organization administrator.",
    "",
    BRAND.name
  ].join("\n");
  const html = [
    `<div style="margin:0;background:#f3f3f3;padding:32px 16px;font-family:Arial,sans-serif;color:#181818">`,
    `<div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #d8dde6;border-radius:12px;overflow:hidden">`,
    `<div style="background:#032d60;padding:22px 28px;color:#ffffff;font-size:22px;font-weight:700">${escapeHtml(BRAND.name)}</div>`,
    `<div style="padding:28px">`,
    `<p style="margin:0 0 18px">Hello ${escapeHtml(recipientName)},</p>`,
    `<p style="margin:0 0 14px">You now have <strong>${escapeHtml(role)}</strong> access to <strong>${escapeHtml(organizationName)}</strong> in ${escapeHtml(BRAND.product)}.</p>`,
    `<p style="margin:0 0 24px;color:#444444">${escapeHtml(accountGuidance)}</p>`,
    `<p style="margin:0 0 26px"><a href="${escapeHtml(input.activationUrl)}" style="display:inline-block;border-radius:6px;background:#0b5cab;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 20px">Open ${escapeHtml(BRAND.name)}</a></p>`,
    `<p style="margin:0;color:#706e6b;font-size:13px">If you were not expecting this invitation, contact the organization administrator.</p>`,
    `</div></div></div>`
  ].join("");
  return { subject, text: plainText, html };
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
  ]
    .filter((line, index, lines) => line || (index > 0 && lines[index - 1] !== ""))
    .join("\n");
  const html = `<p>Hello ${escapeHtml(invoice.billingName)},</p><p>Please find invoice <strong>${escapeHtml(invoice.invoiceNumber)}</strong> attached.</p><p><strong>Total:</strong> ${escapeHtml(total)}<br><strong>Due date:</strong> ${escapeHtml(dueDate)}</p>${invoice.terms ? `<p>${escapeHtml(invoice.terms).replace(/\n/g, "<br>")}</p>` : ""}<p>${escapeHtml(organizationName)}</p>`;
  return { subject, text: plainText, html };
}
