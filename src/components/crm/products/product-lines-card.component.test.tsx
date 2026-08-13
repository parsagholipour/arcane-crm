import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { type ScopedCrmData, type RecordData } from "@/lib/crm-types";
import { suggestedSalesPrice } from "./product-line-editor";
import { ProductLinesCard } from "./product-lines-card";

const line = {
  id: "line-1",
  productId: "product-1",
  quantity: "2",
  unitPrice: "150.00",
  totalPrice: "300.00",
  description: null,
  product: { id: "product-1", name: "Installed Widget", productCode: "WID-1" }
};

const opportunity: RecordData = {
  id: "opportunity-1",
  name: "Global Expansion",
  products: [{ ...line, opportunityId: "opportunity-1" }]
};

const lead: RecordData = {
  id: "lead-1",
  firstName: "Dana",
  lastName: "Reed",
  sampleProducts: [{ ...line, leadId: "lead-1" }]
};

const data = {
  user: { id: "user-1", name: "Primary User", alias: "primary" },
  users: [{ id: "user-1", name: "Primary User", alias: "primary" }],
  opportunities: [opportunity],
  leads: [lead],
  products: [
    { id: "product-1", name: "Installed Widget", productCode: "WID-1", active: true },
    { id: "product-2", name: "Support Retainer", active: true, price: "89.00" }
  ],
  priceBookEntries: [
    {
      id: "entry-custom",
      productId: "product-2",
      listPrice: "95.00",
      currency: "USD",
      active: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      priceBook: { id: "book-custom", active: true, isStandard: false }
    },
    {
      id: "entry-standard",
      productId: "product-2",
      listPrice: "99.50",
      currency: "USD",
      active: true,
      createdAt: "2026-02-01T00:00:00.000Z",
      priceBook: { id: "book-standard", active: true, isStandard: true }
    }
  ]
} as unknown as ScopedCrmData;

function renderCard(overrides: Partial<Parameters<typeof ProductLinesCard>[0]> = {}) {
  const onDataChange = vi.fn();
  const onToast = vi.fn();
  render(
    <ProductLinesCard
      subjectKind="Opportunity"
      subject={opportunity}
      data={data}
      onDataChange={onDataChange}
      onToast={onToast}
      {...overrides}
    />
  );
  return { onDataChange, onToast };
}

function renderLeadCard(overrides: Partial<Parameters<typeof ProductLinesCard>[0]> = {}) {
  return renderCard({ subjectKind: "Lead", subject: lead, ...overrides });
}

describe("Product lines card", () => {
  it("ignores inactive, expired, future, and non-USD prices before using the catalogue fallback", () => {
    const product = { id: "product-3", price: "44.00" };
    const priceBook = { active: true, isStandard: true };
    const entries = [
      { id: "inactive", productId: "product-3", active: false, currency: "USD", listPrice: "1", priceBook },
      {
        id: "expired",
        productId: "product-3",
        active: true,
        currency: "USD",
        listPrice: "2",
        priceBook: { ...priceBook, validTo: "2025-12-31T23:59:59.000Z" }
      },
      {
        id: "future",
        productId: "product-3",
        active: true,
        currency: "USD",
        listPrice: "3",
        priceBook: { ...priceBook, validFrom: "2027-01-01T00:00:00.000Z" }
      },
      { id: "eur", productId: "product-3", active: true, currency: "EUR", listPrice: "4", priceBook }
    ];

    expect(suggestedSalesPrice(product, entries, new Date("2026-08-11T00:00:00.000Z").getTime())).toBe("44.00");
  });

  it("lists the assigned products with their line and overall totals", () => {
    renderCard();

    expect(screen.getByText("Products (1)")).toBeInTheDocument();
    const row = screen.getByRole("link", { name: "Installed Widget" }).closest("tr");
    expect(row).not.toBeNull();
    expect(within(row!).getByText("$150.00")).toBeInTheDocument();
    expect(within(row!).getByText("$300.00")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Installed Widget" })).toHaveAttribute(
      "href",
      "/lightning/r/Product2/product-1/view"
    );
    const footer = screen.getByText("Total Product Amount").closest("tr");
    expect(within(footer!).getByText("$300.00")).toBeInTheDocument();
  });

  it("assigns a product, prefilling the sales price from the standard active price book", async () => {
    const user = userEvent.setup();
    const created = {
      id: "line-2",
      productId: "product-2",
      quantity: "1",
      unitPrice: "99.50",
      totalPrice: "99.50",
      product: { id: "product-2", name: "Support Retainer" }
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ product: created })
    });
    vi.stubGlobal("fetch", fetchMock);
    const { onDataChange, onToast } = renderCard();

    await user.click(screen.getByRole("button", { name: /Add Product/ }));
    const lookup = screen.getByRole("combobox", { name: /Product/ });
    await user.type(lookup, "Support");
    await user.click(screen.getByRole("option", { name: "Support Retainer" }));

    expect(screen.getByRole("spinbutton", { name: /Sales Price/ })).toHaveValue(99.5);
    expect(screen.getByRole("spinbutton", { name: /Quantity/ })).toHaveValue(1);

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/opportunities/opportunity-1/products");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toMatchObject({ productId: "product-2", quantity: "1", unitPrice: "99.50" });
    expect(onDataChange).toHaveBeenCalledOnce();
    expect(onToast).toHaveBeenCalledWith({ tone: "success", message: "Product assigned." });
  });

  it("hides products that are already assigned", async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByRole("button", { name: /Add Product/ }));
    await user.click(screen.getByRole("combobox", { name: /Product/ }));

    expect(screen.getByRole("option", { name: "Support Retainer" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Installed Widget" })).not.toBeInTheDocument();
  });

  it("removes an assigned product after confirmation", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);
    const { onDataChange, onToast } = renderCard();

    await user.click(screen.getByRole("button", { name: "Remove Installed Widget" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock.mock.calls[0][0]).toBe("/api/opportunities/opportunity-1/products/line-1");
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
    expect(onDataChange).toHaveBeenCalledOnce();
    expect(onToast).toHaveBeenCalledWith({ tone: "success", message: "Product removed." });
  });

  it("surfaces a server rejection without clearing the dialog", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      statusText: "Conflict",
      json: async () => ({ error: "This Product is already assigned to the Opportunity." })
    });
    vi.stubGlobal("fetch", fetchMock);
    const { onDataChange } = renderCard();

    await user.click(screen.getByRole("button", { name: /Add Product/ }));
    await user.click(screen.getByRole("combobox", { name: /Product/ }));
    await user.click(screen.getByRole("option", { name: "Support Retainer" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("This Product is already assigned to the Opportunity.")).toBeInTheDocument();
    expect(onDataChange).not.toHaveBeenCalled();
  });

  it("assigns the same catalogue Products to a Lead through the sample endpoint", async () => {
    const user = userEvent.setup();
    const created = {
      id: "sample-2",
      productId: "product-2",
      quantity: "1",
      unitPrice: "99.50",
      totalPrice: "99.50",
      product: { id: "product-2", name: "Support Retainer" }
    };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ product: created }) });
    vi.stubGlobal("fetch", fetchMock);
    const { onDataChange, onToast } = renderLeadCard();

    expect(screen.getByText("Sample Products (1)")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Add Sample Product/ }));
    await user.click(screen.getByRole("combobox", { name: /Product/ }));
    await user.click(screen.getByRole("option", { name: "Support Retainer" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock.mock.calls[0][0]).toBe("/api/leads/lead-1/sample-products");
    expect(onDataChange).toHaveBeenCalledOnce();
    expect(onToast).toHaveBeenCalledWith({ tone: "success", message: "Sample Product added." });
  });

  it("hides the write actions on a converted Lead, which the server also freezes", () => {
    renderLeadCard({ readOnly: true });

    expect(screen.getByRole("link", { name: "Installed Widget" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add Sample Product/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Remove/ })).not.toBeInTheDocument();
  });

  it("blocks save when quantity or sales price is blank", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderCard();

    await user.click(screen.getByRole("button", { name: /Add Product/ }));
    await user.click(screen.getByRole("combobox", { name: /Product/ }));
    await user.click(screen.getByRole("option", { name: "Support Retainer" }));
    await user.clear(screen.getByRole("spinbutton", { name: /Sales Price/ }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Sales price must be a valid number.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
