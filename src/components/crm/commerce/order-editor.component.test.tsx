import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { type ScopedCrmData } from "@/lib/crm-types";
import { OrderEditor } from "./order-editor";

const data = {
  accounts: [
    { id: "account-alpha", name: "Alpha Industries" },
    { id: "account-beta", name: "Beta Holdings" }
  ],
  contacts: [
    { id: "contact-alpha", accountId: "account-alpha", firstName: "Alice", lastName: "Alpha" },
    { id: "contact-beta", accountId: "account-beta", firstName: "Bob", lastName: "Beta" }
  ],
  stores: [],
  products: [{ id: "product-1", name: "Searchable Widget" }],
  priceBookEntries: []
} as unknown as ScopedCrmData;

describe("OrderEditor", () => {
  it("uses searchable account and contact lookups and scopes contacts to the chosen account", async () => {
    const user = userEvent.setup();
    render(<OrderEditor data={data} onClose={vi.fn()} onSaved={vi.fn()} />);

    const accountLookup = screen.getByRole("combobox", { name: "Account" });
    expect(accountLookup).toHaveAttribute("placeholder", "Search Accounts...");

    await user.type(accountLookup, "Beta");
    await user.click(screen.getByRole("option", { name: "Beta Holdings" }));
    expect(accountLookup).toHaveValue("Beta Holdings");

    const contactLookup = screen.getByRole("combobox", { name: "Contact" });
    expect(contactLookup).toHaveAttribute("placeholder", "Search Contacts...");

    await user.click(contactLookup);
    expect(screen.getByRole("option", { name: "Bob Beta" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Alice Alpha" })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "Add Line" }));
    const productLookup = screen.getByRole("combobox", { name: "Line 1 Product" });
    await user.type(productLookup, "Widget");
    expect(screen.getByRole("option", { name: "Searchable Widget" })).toBeInTheDocument();
  });
});
