import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { type ScopedCrmData, type RecordData } from "@/lib/crm-types";
import { GenericRecordModal } from "@/features/crm/record-editors";

const products = [
  { id: "product-1", name: "Installed Widget", productCode: "WID-1", active: true },
  { id: "product-2", name: "Support Retainer", active: true, price: "89.00" }
];

const priceBookEntries = [
  {
    id: "entry-standard",
    productId: "product-2",
    listPrice: "99.50",
    currency: "USD",
    active: true,
    priceBook: { id: "book-standard", active: true, isStandard: true }
  }
];

const existingLine = {
  id: "line-1",
  productId: "product-1",
  quantity: "2",
  unitPrice: "150.00",
  totalPrice: "300.00",
  description: null,
  product: { id: "product-1", name: "Installed Widget", productCode: "WID-1" }
};

const lead: RecordData = {
  id: "lead-1",
  firstName: "Dana",
  lastName: "Reed",
  status: "Sample requested",
  sampleProducts: [existingLine]
};

const opportunity: RecordData = {
  id: "opportunity-1",
  name: "Global Expansion",
  accountId: "account-1",
  closeDate: "2026-09-30T00:00:00.000Z",
  stage: "Propose",
  forecastCategory: "Best Case",
  ownerId: "user-1",
  products: [existingLine]
};

const data = {
  user: { id: "user-1", name: "Primary User", alias: "primary" },
  users: [{ id: "user-1", name: "Primary User", alias: "primary" }],
  accounts: [{ id: "account-1", name: "Robert Industries" }],
  contacts: [],
  leads: [lead],
  opportunities: [opportunity],
  products,
  priceBookEntries
} as unknown as ScopedCrmData;

function renderModal(overrides: Partial<Parameters<typeof GenericRecordModal>[0]> = {}) {
  const onSave = vi.fn().mockResolvedValue({ id: "lead-1" });
  const onDataChange = vi.fn();
  const onToast = vi.fn();
  render(
    <GenericRecordModal
      mode="edit"
      object="Lead"
      data={data}
      record={lead}
      onClose={vi.fn()}
      onSave={onSave}
      onDataChange={onDataChange}
      onToast={onToast}
      {...overrides}
    />
  );
  return { onSave, onDataChange, onToast };
}

describe("Product lines inside the record modal", () => {
  it("shows the Lead's staged Sample Products with editable quantity and price", () => {
    renderModal();

    expect(screen.getByText("Sample Products")).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Quantity for Installed Widget" })).toHaveValue(2);
    expect(screen.getByRole("spinbutton", { name: "Sales price for Installed Widget" })).toHaveValue(150);
    expect(screen.getByText("Total Sample Amount")).toBeInTheDocument();
  });

  it("uses the Opportunity's own copy for the same control", () => {
    renderModal({ object: "Opportunity", record: opportunity });

    expect(screen.getByText("Products")).toBeInTheDocument();
    expect(screen.getByText("Total Product Amount")).toBeInTheDocument();
  });

  it("adds a product at its standard price and posts it after the record saves", async () => {
    const user = userEvent.setup();
    const created = { id: "sample-2", productId: "product-2", quantity: "1", unitPrice: "99.50" };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ product: created }) });
    vi.stubGlobal("fetch", fetchMock);
    const { onSave, onDataChange } = renderModal();

    await user.click(screen.getByRole("combobox", { name: /Product/ }));
    await user.click(screen.getByRole("option", { name: "Support Retainer" }));

    expect(screen.getByRole("spinbutton", { name: "Sales price for Support Retainer" })).toHaveValue(99.5);

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(onSave).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/leads/lead-1/sample-products");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toMatchObject({ productId: "product-2", quantity: "1", unitPrice: "99.50" });
    expect(onDataChange).toHaveBeenCalledOnce();
  });

  it("deletes a line the user removed before saving, and leaves untouched lines alone", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);
    renderModal();

    await user.click(screen.getByRole("button", { name: "Remove Installed Widget" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock.mock.calls[0][0]).toBe("/api/leads/lead-1/sample-products/line-1");
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
  });

  it("patches only the lines whose quantity or price actually changed", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ product: { ...existingLine, quantity: "5" } })
    });
    vi.stubGlobal("fetch", fetchMock);
    renderModal();

    const quantity = screen.getByRole("spinbutton", { name: "Quantity for Installed Widget" });
    await user.clear(quantity);
    await user.type(quantity, "5");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock.mock.calls[0][0]).toBe("/api/leads/lead-1/sample-products/line-1");
    expect(fetchMock.mock.calls[0][1].method).toBe("PATCH");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ quantity: "5" });
  });

  it("writes nothing when the lines are untouched", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderModal();

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(fetchMock).not.toHaveBeenCalled());
  });

  it("skips line writes entirely when the record itself failed to save", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderModal({ onSave: vi.fn().mockResolvedValue(null) });

    await user.click(screen.getByRole("button", { name: "Remove Installed Widget" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(fetchMock).not.toHaveBeenCalled());
  });

  it("stages products on a brand new Lead and posts them against the id the server assigns", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ product: { id: "sample-9", productId: "product-2" } })
    });
    vi.stubGlobal("fetch", fetchMock);
    const onSave = vi.fn().mockResolvedValue({ id: "lead-created" });
    renderModal({ mode: "new", record: undefined, onSave });

    await user.type(screen.getByRole("textbox", { name: /Last Name/ }), "Fowler");
    await user.click(screen.getByRole("combobox", { name: /^Product/ }));
    await user.click(screen.getByRole("option", { name: "Support Retainer" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock.mock.calls[0][0]).toBe("/api/leads/lead-created/sample-products");
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
  });

  it("hides products that are already staged from the picker", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole("combobox", { name: /Product/ }));

    expect(screen.getByRole("option", { name: "Support Retainer" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Installed Widget" })).not.toBeInTheDocument();
  });

  it("reports a rejected line without pretending the record failed", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      statusText: "Conflict",
      json: async () => ({ error: "This Product is already in the Lead's sample." })
    });
    vi.stubGlobal("fetch", fetchMock);
    const { onToast } = renderModal();

    await user.click(screen.getByRole("combobox", { name: /Product/ }));
    await user.click(screen.getByRole("option", { name: "Support Retainer" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onToast).toHaveBeenCalledOnce());
    expect(onToast.mock.calls[0][0].tone).toBe("error");
    expect(onToast.mock.calls[0][0].message).toContain("Support Retainer");
  });

  it("keeps the total in step with an edited quantity", async () => {
    const user = userEvent.setup();
    renderModal();

    const footer = screen.getByText("Total Sample Amount").closest("tr");
    expect(within(footer!).getByText("$300.00")).toBeInTheDocument();

    const quantity = screen.getByRole("spinbutton", { name: "Quantity for Installed Widget" });
    await user.clear(quantity);
    await user.type(quantity, "3");

    expect(within(footer!).getByText("$450.00")).toBeInTheDocument();
  });
});
