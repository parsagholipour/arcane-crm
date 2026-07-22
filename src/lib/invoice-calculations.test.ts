import assert from "node:assert/strict";
import test from "node:test";
import { calculateInvoiceTotals, InvoiceInputError } from "@/lib/invoice-calculations";

test("calculates multiple invoice lines with discounts and tax using decimal arithmetic", () => {
  const result = calculateInvoiceTotals([
    { description: "Product", quantity: "2", unitPrice: "49.99", discountAmount: "9.98", taxRate: "10" },
    { description: "Service", quantity: "1.5", unitPrice: "20.00", discountAmount: "0", taxRate: "5" }
  ]);

  assert.equal(result.lineItems[0].lineSubtotal.toFixed(2), "99.98");
  assert.equal(result.lineItems[0].taxAmount.toFixed(2), "9.00");
  assert.equal(result.lineItems[0].lineTotal.toFixed(2), "99.00");
  assert.equal(result.subtotal.toFixed(2), "129.98");
  assert.equal(result.discountTotal.toFixed(2), "9.98");
  assert.equal(result.taxTotal.toFixed(2), "10.50");
  assert.equal(result.total.toFixed(2), "130.50");
});

test("rounds monetary values half-up at the line boundary", () => {
  const result = calculateInvoiceTotals([{ description: "Rounded", quantity: "1", unitPrice: "0.10", discountAmount: "0", taxRate: "5" }]);
  assert.equal(result.lineItems[0].taxAmount.toFixed(2), "0.01");
  assert.equal(result.total.toFixed(2), "0.11");
});

test("rejects invalid quantities, discounts, unit prices, and tax rates", () => {
  const invalidLines = [
    { description: "Quantity", quantity: "0", unitPrice: "1", discountAmount: "0", taxRate: "0" },
    { description: "Unit", quantity: "1", unitPrice: "-1", discountAmount: "0", taxRate: "0" },
    { description: "Discount", quantity: "1", unitPrice: "1", discountAmount: "1.01", taxRate: "0" },
    { description: "Tax", quantity: "1", unitPrice: "1", discountAmount: "0", taxRate: "100.01" }
  ];

  for (const line of invalidLines) {
    assert.throws(() => calculateInvoiceTotals([line]), InvoiceInputError);
  }
});
