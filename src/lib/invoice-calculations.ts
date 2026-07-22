import { Prisma } from "@prisma/client";

export type InvoiceLineInput = {
  id?: string;
  productId?: string | null;
  description?: string | null;
  quantity: string | number | Prisma.Decimal;
  unitPrice: string | number | Prisma.Decimal;
  discountAmount?: string | number | Prisma.Decimal | null;
  taxRate?: string | number | Prisma.Decimal | null;
  displayOrder?: number;
};

export type CalculatedInvoiceLine = {
  productId: string | null;
  description: string;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  taxRate: Prisma.Decimal;
  lineSubtotal: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  displayOrder: number;
};

export type CalculatedInvoiceTotals = {
  lineItems: CalculatedInvoiceLine[];
  subtotal: Prisma.Decimal;
  discountTotal: Prisma.Decimal;
  taxTotal: Prisma.Decimal;
  total: Prisma.Decimal;
};

export class InvoiceInputError extends Error {
  constructor(message: string, readonly field?: string) {
    super(message);
    this.name = "InvoiceInputError";
  }
}

const ZERO = new Prisma.Decimal(0);

function decimal(value: unknown, label: string) {
  try {
    const parsed = new Prisma.Decimal(value === null || value === undefined || value === "" ? 0 : String(value));
    if (!parsed.isFinite()) throw new Error("not finite");
    return parsed;
  } catch {
    throw new InvoiceInputError(`${label} must be a valid number.`, label);
  }
}

export function money(value: Prisma.Decimal.Value) {
  return new Prisma.Decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function calculateInvoiceTotals(inputs: InvoiceLineInput[]): CalculatedInvoiceTotals {
  const lineItems = inputs.map((input, index) => {
    const quantity = decimal(input.quantity, `Line ${index + 1} quantity`).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
    const unitPrice = money(decimal(input.unitPrice, `Line ${index + 1} unit price`));
    const discountAmount = money(decimal(input.discountAmount, `Line ${index + 1} discount`));
    const taxRate = decimal(input.taxRate, `Line ${index + 1} tax rate`).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
    const description = String(input.description ?? "").trim();

    if (!description) throw new InvoiceInputError(`Line ${index + 1} requires a description.`, `lineItems.${index}.description`);
    if (quantity.lte(0)) throw new InvoiceInputError(`Line ${index + 1} quantity must be greater than zero.`, `lineItems.${index}.quantity`);
    if (unitPrice.lt(0)) throw new InvoiceInputError(`Line ${index + 1} unit price cannot be negative.`, `lineItems.${index}.unitPrice`);
    if (discountAmount.lt(0)) throw new InvoiceInputError(`Line ${index + 1} discount cannot be negative.`, `lineItems.${index}.discountAmount`);
    if (taxRate.lt(0) || taxRate.gt(100)) throw new InvoiceInputError(`Line ${index + 1} tax rate must be between 0 and 100.`, `lineItems.${index}.taxRate`);

    const lineSubtotal = money(quantity.mul(unitPrice));
    if (discountAmount.gt(lineSubtotal)) {
      throw new InvoiceInputError(`Line ${index + 1} discount cannot exceed the line subtotal.`, `lineItems.${index}.discountAmount`);
    }
    const taxableAmount = lineSubtotal.minus(discountAmount);
    const taxAmount = money(taxableAmount.mul(taxRate).div(100));
    const lineTotal = money(taxableAmount.plus(taxAmount));

    return {
      productId: input.productId ? String(input.productId) : null,
      description,
      quantity,
      unitPrice,
      discountAmount,
      taxRate,
      lineSubtotal,
      taxAmount,
      lineTotal,
      displayOrder: Number.isInteger(input.displayOrder) ? Number(input.displayOrder) : index
    };
  });

  return {
    lineItems,
    subtotal: money(lineItems.reduce((sum, line) => sum.plus(line.lineSubtotal), ZERO)),
    discountTotal: money(lineItems.reduce((sum, line) => sum.plus(line.discountAmount), ZERO)),
    taxTotal: money(lineItems.reduce((sum, line) => sum.plus(line.taxAmount), ZERO)),
    total: money(lineItems.reduce((sum, line) => sum.plus(line.lineTotal), ZERO))
  };
}
