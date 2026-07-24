import "server-only";

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Prisma } from "@prisma/client";
import { invoiceInclude } from "@/lib/invoices";

type InvoiceDocument = Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }>;

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 48;
const BLUE = rgb(0.01, 0.22, 0.42);
const BRAND = rgb(0.01, 0.46, 0.83);
const TEXT = rgb(0.09, 0.09, 0.09);
const MUTED = rgb(0.38, 0.38, 0.38);
const LINE = rgb(0.84, 0.86, 0.89);
const LIGHT = rgb(0.95, 0.97, 0.99);

function safeText(value: unknown) {
  return String(value ?? "").normalize("NFKD").replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}

function formatDocumentDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "2-digit", timeZone: "UTC" }).format(new Date(value));
}

function formatMoney(value: unknown, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(Number(value ?? 0));
}

function wrapText(text: string, font: PDFFont, size: number, width: number) {
  const words = safeText(text).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let current = words[0];
  for (const word of words.slice(1)) {
    const candidate = `${current} ${word}`;
    if (font.widthOfTextAtSize(candidate, size) <= width) current = candidate;
    else {
      lines.push(current);
      current = word;
    }
  }
  lines.push(current);
  return lines;
}

function drawRight(page: PDFPage, text: string, right: number, y: number, font: PDFFont, size = 9, color = TEXT) {
  page.drawText(safeText(text), { x: right - font.widthOfTextAtSize(safeText(text), size), y, font, size, color });
}

function drawLabelValue(page: PDFPage, label: string, value: string, x: number, y: number, regular: PDFFont, bold: PDFFont, width = 220) {
  page.drawText(safeText(label).toUpperCase(), { x, y, font: bold, size: 7, color: MUTED });
  const lines = wrapText(value || "-", regular, 9, width).slice(0, 3);
  lines.forEach((line, index) => page.drawText(line, { x, y: y - 14 - index * 12, font: regular, size: 9, color: TEXT }));
}

export async function generateInvoicePdf(invoice: InvoiceDocument, organizationName: string) {
  const document = await PDFDocument.create();
  document.setTitle(invoice.invoiceNumber);
  document.setSubject("Sales invoice");
  document.setAuthor(safeText(organizationName));
  document.setCreator("Reloriq Sales Invoicing");
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);

  let page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;
  let pageNumber = 1;

  function drawHeader(currentPage: PDFPage, continuation = false) {
    currentPage.drawRectangle({ x: 0, y: PAGE_HEIGHT - 112, width: PAGE_WIDTH, height: 112, color: BLUE });
    currentPage.drawText(safeText(organizationName), { x: MARGIN, y: PAGE_HEIGHT - 54, font: bold, size: 18, color: rgb(1, 1, 1) });
    currentPage.drawText(continuation ? "SALES INVOICE - CONTINUED" : "SALES INVOICE", { x: MARGIN, y: PAGE_HEIGHT - 78, font: regular, size: 9, color: rgb(0.78, 0.88, 0.97) });
    drawRight(currentPage, invoice.invoiceNumber, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 54, bold, 18, rgb(1, 1, 1));
    drawRight(currentPage, invoice.status.toUpperCase(), PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 78, bold, 9, rgb(0.78, 0.9, 1));
  }

  function drawFooter(currentPage: PDFPage, number: number) {
    currentPage.drawLine({ start: { x: MARGIN, y: 34 }, end: { x: PAGE_WIDTH - MARGIN, y: 34 }, color: LINE, thickness: 0.7 });
    currentPage.drawText("Sales invoice - payments shown are externally received payments recorded in the CRM.", { x: MARGIN, y: 19, font: regular, size: 7, color: MUTED });
    drawRight(currentPage, `Page ${number}`, PAGE_WIDTH - MARGIN, 19, regular, 7, MUTED);
  }

  function newPage() {
    drawFooter(page, pageNumber);
    pageNumber += 1;
    page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawHeader(page, true);
    y = PAGE_HEIGHT - 140;
  }

  function ensureSpace(height: number) {
    if (y - height < 54) newPage();
  }

  function drawTableHeader() {
    page.drawRectangle({ x: MARGIN, y: y - 18, width: PAGE_WIDTH - MARGIN * 2, height: 22, color: LIGHT });
    const headings = [
      ["DESCRIPTION", MARGIN + 6],
      ["QTY", 326],
      ["UNIT", 370],
      ["DISC.", 431],
      ["TAX", 478],
      ["TOTAL", 523]
    ] as const;
    headings.forEach(([heading, x]) => page.drawText(heading, { x, y: y - 10, font: bold, size: 7, color: MUTED }));
    y -= 24;
  }

  drawHeader(page);
  y = PAGE_HEIGHT - 142;
  drawLabelValue(page, "Bill to", invoice.billingName, MARGIN, y, regular, bold, 236);
  const billingAddress = [invoice.billingStreet, [invoice.billingCity, invoice.billingState, invoice.billingPostalCode].filter(Boolean).join(" "), invoice.billingCountry].filter(Boolean).join(", ");
  drawLabelValue(page, "Billing address", billingAddress || "-", MARGIN, y - 55, regular, bold, 236);
  drawLabelValue(page, "Issue date", formatDocumentDate(invoice.issueDate), 340, y, regular, bold, 100);
  drawLabelValue(page, "Due date", formatDocumentDate(invoice.dueDate), 458, y, regular, bold, 100);
  drawLabelValue(page, "Purchase order", invoice.purchaseOrderNumber ?? "-", 340, y - 55, regular, bold, 218);
  y -= 120;

  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, color: LINE, thickness: 0.8 });
  y -= 18;
  drawTableHeader();
  for (const line of invoice.lineItems) {
    const descriptionLines = wrapText(line.description, regular, 8.5, 260).slice(0, 3);
    const rowHeight = Math.max(26, descriptionLines.length * 11 + 10);
    ensureSpace(rowHeight + 30);
    if (y === PAGE_HEIGHT - 140) drawTableHeader();
    descriptionLines.forEach((text, index) => page.drawText(text, { x: MARGIN + 6, y: y - 12 - index * 11, font: regular, size: 8.5, color: TEXT }));
    drawRight(page, String(line.quantity), 354, y - 12, regular, 8.5);
    drawRight(page, formatMoney(line.unitPrice, invoice.currency), 423, y - 12, regular, 8.5);
    drawRight(page, formatMoney(line.discountAmount, invoice.currency), 475, y - 12, regular, 8.5);
    drawRight(page, `${line.taxRate}%`, 515, y - 12, regular, 8.5);
    drawRight(page, formatMoney(line.lineTotal, invoice.currency), PAGE_WIDTH - MARGIN - 5, y - 12, bold, 8.5);
    y -= rowHeight;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, color: LINE, thickness: 0.5 });
  }
  if (!invoice.lineItems.length) {
    page.drawText("No line items", { x: MARGIN + 6, y: y - 14, font: regular, size: 9, color: MUTED });
    y -= 34;
  }

  ensureSpace(138);
  y -= 18;
  const totalsX = 370;
  const totalsRight = PAGE_WIDTH - MARGIN;
  const totals = [
    ["Subtotal", formatMoney(invoice.subtotal, invoice.currency)],
    ["Discounts", `-${formatMoney(invoice.discountTotal, invoice.currency)}`],
    ["Tax", formatMoney(invoice.taxTotal, invoice.currency)],
    ["Total", formatMoney(invoice.total, invoice.currency)],
    ["Amount paid", formatMoney(invoice.amountPaid, invoice.currency)]
  ];
  totals.forEach(([label, value], index) => {
    const rowY = y - index * 20;
    page.drawText(label, { x: totalsX, y: rowY, font: index === 3 ? bold : regular, size: index === 3 ? 10 : 9, color: index === 3 ? TEXT : MUTED });
    drawRight(page, value, totalsRight, rowY, index === 3 ? bold : regular, index === 3 ? 10 : 9);
  });
  const balanceY = y - totals.length * 20 - 5;
  page.drawRectangle({ x: totalsX - 8, y: balanceY - 9, width: totalsRight - totalsX + 8, height: 28, color: BLUE });
  page.drawText("BALANCE DUE", { x: totalsX, y: balanceY, font: bold, size: 9, color: rgb(1, 1, 1) });
  drawRight(page, formatMoney(invoice.balanceDue, invoice.currency), totalsRight - 6, balanceY, bold, 11, rgb(1, 1, 1));
  y = balanceY - 36;

  for (const [label, value] of [["Notes", invoice.notes], ["Payment terms", invoice.terms]] as const) {
    if (!value) continue;
    const lines = wrapText(value, regular, 8.5, PAGE_WIDTH - MARGIN * 2);
    ensureSpace(28 + lines.length * 11);
    page.drawText(label.toUpperCase(), { x: MARGIN, y, font: bold, size: 7, color: BRAND });
    y -= 15;
    lines.forEach((line, index) => page.drawText(line, { x: MARGIN, y: y - index * 11, font: regular, size: 8.5, color: TEXT }));
    y -= lines.length * 11 + 18;
  }

  drawFooter(page, pageNumber);
  return document.save();
}
