import { Prisma } from "@prisma/client";

export type OpportunityProductInput = {
  quantity: string | number | Prisma.Decimal | null | undefined;
  unitPrice: string | number | Prisma.Decimal | null | undefined;
  description?: string | null;
  displayOrder?: number | null;
};

export type CalculatedOpportunityProduct = {
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  totalPrice: Prisma.Decimal;
  description: string | null;
  displayOrder: number;
};

export class OpportunityProductInputError extends Error {
  constructor(
    message: string,
    readonly field?: string
  ) {
    super(message);
    this.name = "OpportunityProductInputError";
  }
}

const ZERO = new Prisma.Decimal(0);
const MAX_QUANTITY = new Prisma.Decimal("99999999999999.9999");
const MAX_MONEY = new Prisma.Decimal("9999999999999999.99");

function decimal(value: unknown, message: string, field: string) {
  try {
    if (value === null || value === undefined || String(value).trim() === "") throw new Error("blank");
    const parsed = new Prisma.Decimal(String(value));
    if (!parsed.isFinite()) throw new Error("not finite");
    return parsed;
  } catch {
    throw new OpportunityProductInputError(message, field);
  }
}

export function money(value: Prisma.Decimal.Value) {
  return new Prisma.Decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

/** Quantity and sales price define the line; the total is never accepted from the client. */
export function calculateOpportunityProduct(input: OpportunityProductInput): CalculatedOpportunityProduct {
  const quantity = decimal(input.quantity, "Quantity must be a valid number.", "quantity").toDecimalPlaces(
    4,
    Prisma.Decimal.ROUND_HALF_UP
  );
  const unitPrice = money(decimal(input.unitPrice, "Sales price must be a valid number.", "unitPrice"));

  if (quantity.lte(0)) throw new OpportunityProductInputError("Quantity must be greater than zero.", "quantity");
  if (quantity.gt(MAX_QUANTITY)) throw new OpportunityProductInputError("Quantity is too large.", "quantity");
  if (unitPrice.lt(0)) throw new OpportunityProductInputError("Sales price cannot be negative.", "unitPrice");
  if (unitPrice.gt(MAX_MONEY)) throw new OpportunityProductInputError("Sales price is too large.", "unitPrice");

  const totalPrice = money(quantity.mul(unitPrice));
  if (totalPrice.gt(MAX_MONEY))
    throw new OpportunityProductInputError("Quantity and sales price produce a total that is too large.");

  const description = String(input.description ?? "").trim();
  const displayOrder = Number(input.displayOrder);

  return {
    quantity,
    unitPrice,
    totalPrice,
    description: description || null,
    displayOrder: Number.isInteger(displayOrder) ? displayOrder : 0
  };
}

export function opportunityProductsTotal(lines: Array<{ totalPrice: Prisma.Decimal.Value }>) {
  return money(lines.reduce((sum, line) => sum.plus(new Prisma.Decimal(line.totalPrice)), ZERO));
}
