import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateOpportunityProduct,
  opportunityProductsTotal,
  OpportunityProductInputError
} from "@/lib/opportunity-product-lines";

describe("calculateOpportunityProduct", () => {
  it("derives the total from quantity and sales price", () => {
    const line = calculateOpportunityProduct({ quantity: "3", unitPrice: "19.99" });
    assert.equal(line.quantity.toString(), "3");
    assert.equal(line.unitPrice.toFixed(2), "19.99");
    assert.equal(line.totalPrice.toFixed(2), "59.97");
  });

  it("rounds the total to two decimals and keeps four decimals of quantity", () => {
    const line = calculateOpportunityProduct({ quantity: "1.3335", unitPrice: "10.005" });
    assert.equal(line.quantity.toString(), "1.3335");
    assert.equal(line.unitPrice.toFixed(2), "10.01");
    assert.equal(line.totalPrice.toFixed(2), "13.35");
  });

  it("normalizes a blank description to null and defaults the display order", () => {
    const line = calculateOpportunityProduct({ quantity: 1, unitPrice: 0, description: "   " });
    assert.equal(line.description, null);
    assert.equal(line.displayOrder, 0);
    assert.equal(line.totalPrice.toFixed(2), "0.00");
  });

  it("keeps a supplied description and display order", () => {
    const line = calculateOpportunityProduct({
      quantity: 2,
      unitPrice: 5,
      description: " Bundled install ",
      displayOrder: 4
    });
    assert.equal(line.description, "Bundled install");
    assert.equal(line.displayOrder, 4);
  });

  it("rejects a quantity of zero or less", () => {
    assert.throws(
      () => calculateOpportunityProduct({ quantity: 0, unitPrice: 10 }),
      (error: unknown) =>
        error instanceof OpportunityProductInputError &&
        error.field === "quantity" &&
        error.message === "Quantity must be greater than zero."
    );
  });

  it("rejects a negative sales price", () => {
    assert.throws(
      () => calculateOpportunityProduct({ quantity: 1, unitPrice: -1 }),
      (error: unknown) => error instanceof OpportunityProductInputError && error.field === "unitPrice"
    );
  });

  it("rejects values that are not numbers", () => {
    assert.throws(
      () => calculateOpportunityProduct({ quantity: "many", unitPrice: 1 }),
      (error: unknown) => error instanceof OpportunityProductInputError && error.field === "quantity"
    );
  });

  it("rejects a blank required sales price", () => {
    assert.throws(
      () => calculateOpportunityProduct({ quantity: 1, unitPrice: "" }),
      (error: unknown) =>
        error instanceof OpportunityProductInputError &&
        error.field === "unitPrice" &&
        error.message === "Sales price must be a valid number."
    );
  });

  it("rejects values and calculated totals that exceed the database precision", () => {
    assert.throws(
      () => calculateOpportunityProduct({ quantity: "100000000000000", unitPrice: 1 }),
      (error: unknown) => error instanceof OpportunityProductInputError && error.field === "quantity"
    );
    assert.throws(
      () => calculateOpportunityProduct({ quantity: 1, unitPrice: "10000000000000000" }),
      (error: unknown) => error instanceof OpportunityProductInputError && error.field === "unitPrice"
    );
    assert.throws(
      () => calculateOpportunityProduct({ quantity: "99999999999999.9999", unitPrice: 101 }),
      (error: unknown) =>
        error instanceof OpportunityProductInputError &&
        error.message === "Quantity and sales price produce a total that is too large."
    );
  });
});

describe("opportunityProductsTotal", () => {
  it("sums every assigned line", () => {
    const total = opportunityProductsTotal([{ totalPrice: "59.97" }, { totalPrice: "13.35" }, { totalPrice: 0 }]);
    assert.equal(total.toFixed(2), "73.32");
  });

  it("returns zero without lines", () => {
    assert.equal(opportunityProductsTotal([]).toFixed(2), "0.00");
  });
});
