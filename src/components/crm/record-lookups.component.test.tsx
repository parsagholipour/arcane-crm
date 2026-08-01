import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { type ScopedCrmData } from "@/lib/crm-types";
import { MessagingSessionEditorModal } from "@/components/crm/communications/messaging-editor";
import { VideoCallEditorModal } from "@/components/crm/communications/video-editor";
import { InvoiceEditorModal } from "@/components/crm/invoices/editor";
import { EntryEditor } from "@/components/crm/catalog/editors";
import { CampaignEditorModal } from "@/components/crm/campaigns/editor";
import { InventoryEditor } from "@/components/crm/commerce/inventory-editor";
import { StoreEditor } from "@/components/crm/commerce/store-editor";
import { MarketingLandingPagesPanel } from "@/components/crm/MarketingLandingPagesPanel";

const data = {
  user: { id: "user-1", name: "Primary User", alias: "primary" },
  users: [
    { id: "user-1", name: "Primary User", alias: "primary" },
    { id: "user-2", name: "Second User", alias: "second" }
  ],
  accounts: [
    { id: "account-alpha", name: "Alpha Industries" },
    { id: "account-beta", name: "Beta Holdings" }
  ],
  contacts: [
    { id: "contact-alpha", accountId: "account-alpha", firstName: "Alice", lastName: "Alpha" },
    { id: "contact-beta", accountId: "account-beta", firstName: "Bob", lastName: "Beta" }
  ],
  opportunities: [
    { id: "opportunity-alpha", accountId: "account-alpha", name: "Alpha Expansion" },
    { id: "opportunity-beta", accountId: "account-beta", name: "Beta Renewal" }
  ],
  products: [{ id: "product-1", name: "Searchable Widget", active: true }],
  priceBooks: [{ id: "price-book-1", name: "Standard Prices", active: false }],
  priceBookEntries: [],
  stores: [{ id: "store-1", name: "Main Store" }],
  campaigns: [
    { id: "campaign-1", name: "Active Campaign", status: "In Progress" },
    { id: "campaign-2", name: "Archived Campaign", status: "Archived" }
  ],
  marketingLandingPages: [],
  notifications: [],
  organization: { id: "org-1", name: "Example Org", slug: "example-org" }
} as unknown as ScopedCrmData;

const callbacks = {
  onClose: vi.fn(),
  onSaved: vi.fn(),
  onToast: vi.fn()
};

async function choose(user: ReturnType<typeof userEvent.setup>, label: string, query: string, option: string) {
  const lookup = screen.getByRole("combobox", { name: label });
  await user.type(lookup, query);
  await user.click(screen.getByRole("option", { name: option }));
  return lookup;
}

describe("searchable record lookups", () => {
  it("uses scoped Account and Contact lookups in Messaging Sessions", async () => {
    const user = userEvent.setup();
    render(<MessagingSessionEditorModal data={data} {...callbacks} />);

    const account = await choose(user, "Account", "Alpha", "Alpha Industries");
    const contact = await choose(user, "Primary Contact", "Alice", "Alice Alpha");
    expect(contact).toHaveValue("Alice Alpha");

    await user.click(screen.getByRole("button", { name: "Clear Account" }));
    await user.type(account, "Beta");
    await user.click(screen.getByRole("option", { name: "Beta Holdings" }));
    expect(contact).toHaveValue("");

    await user.click(contact);
    expect(screen.getByRole("option", { name: "Bob Beta" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Alice Alpha" })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "Add Participant" }));
    expect(screen.getByRole("combobox", { name: "Participant 1 Contact" })).toHaveAttribute(
      "placeholder",
      "Search Contacts..."
    );
  });

  it("uses scoped Account, Contact, Opportunity, and participant lookups in Video Calls", async () => {
    const user = userEvent.setup();
    render(<VideoCallEditorModal data={data} {...callbacks} />);

    await choose(user, "Account", "Alpha", "Alpha Industries");
    await user.click(screen.getByRole("combobox", { name: "Contact" }));
    expect(screen.getByRole("option", { name: "Alice Alpha" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Bob Beta" })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("combobox", { name: "Opportunity" }));
    expect(screen.getByRole("option", { name: "Alpha Expansion" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Beta Renewal" })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "Add Participant" }));
    const participant = screen.getByRole("combobox", { name: "Participant 1" });
    await user.type(participant, "Second User");
    expect(screen.getByRole("option", { name: "User: Second User" })).toBeInTheDocument();
  });

  it("uses Account and account-scoped Opportunity lookups in Invoices", async () => {
    const user = userEvent.setup();
    render(<InvoiceEditorModal mode="new" data={data} invoice={undefined} {...callbacks} />);

    await choose(user, "Account", "Beta", "Beta Holdings");
    const opportunity = screen.getByRole("combobox", { name: "Opportunity" });
    await user.click(opportunity);
    expect(screen.getByRole("option", { name: "Beta Renewal" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Alpha Expansion" })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "Add Line Item" }));
    const product = screen.getByRole("combobox", { name: "Line 1 Product" });
    await user.type(product, "Widget");
    expect(screen.getByRole("option", { name: "Searchable Widget" })).toBeInTheDocument();
  });

  it("uses searchable Product lookups in inventory and price book entries", async () => {
    const user = userEvent.setup();
    const inventory = render(<InventoryEditor data={data} {...callbacks} />);

    const inventoryProduct = screen.getByRole("combobox", { name: "Product" });
    await user.type(inventoryProduct, "Widget");
    expect(screen.getByRole("option", { name: "Searchable Widget" })).toBeInTheDocument();
    inventory.unmount();

    render(
      <EntryEditor
        priceBook={{ id: "price-book-1", name: "Standard Prices" }}
        data={data}
        entry={{ id: "entry-1", productId: "product-1" }}
        onClose={callbacks.onClose}
        onSaved={callbacks.onSaved}
      />
    );
    expect(screen.getByRole("combobox", { name: "Product" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Product" })).toHaveValue("Searchable Widget");
  });

  it("uses a searchable Price Book lookup in Stores", async () => {
    const user = userEvent.setup();
    render(<StoreEditor data={data} {...callbacks} />);

    const priceBook = screen.getByRole("combobox", { name: "Price Book" });
    await user.type(priceBook, "Standard");
    expect(screen.getByRole("option", { name: "Standard Prices (Inactive)" })).toBeInTheDocument();
  });

  it("uses searchable Campaign lookups and applies campaign exclusions", async () => {
    const user = userEvent.setup();
    const campaignEditor = render(<CampaignEditorModal data={data} initial={data.campaigns[0]} {...callbacks} />);

    const parentCampaign = screen.getByRole("combobox", { name: "Parent Campaign" });
    await user.click(parentCampaign);
    expect(screen.getByRole("option", { name: "Archived Campaign" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Active Campaign" })).not.toBeInTheDocument();
    campaignEditor.unmount();

    render(<MarketingLandingPagesPanel data={data} onDataChange={vi.fn()} onToast={callbacks.onToast} />);
    await user.click(screen.getByRole("button", { name: "New Landing Page" }));
    const campaign = screen.getByRole("combobox", { name: "Campaign" });
    await user.click(campaign);
    expect(screen.getByRole("option", { name: "Active Campaign" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Archived Campaign" })).not.toBeInTheDocument();
  });
});
