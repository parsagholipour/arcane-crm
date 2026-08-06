import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { type ScopedCrmData } from "@/lib/crm-types";
import { OrderEditor } from "@/components/crm/commerce/order-editor";
import { StoreEditor } from "@/components/crm/commerce/store-editor";
import { KnowledgeModal } from "@/features/crm/knowledge-editor";
import { QuickTextModal } from "@/features/crm/quick-text-editor";

const data = {
  user: { id: "user-1", name: "Primary User", alias: "primary" },
  users: [
    { id: "user-1", name: "Primary User", alias: "primary" },
    { id: "user-2", name: "Previous Author", alias: "author" }
  ],
  accounts: [],
  contacts: [],
  leads: [],
  opportunities: [],
  products: [],
  priceBooks: [],
  priceBookEntries: [],
  stores: [],
  quickTextFolders: []
} as unknown as ScopedCrmData;

describe("custom edit-form hydration", () => {
  it("shows Knowledge summary, metadata, zero view count, and user labels", () => {
    render(
      <KnowledgeModal
        data={data}
        initial={{
          id: "article-1",
          title: "Returns",
          urlName: "returns",
          summary: "How to return an item",
          createdAt: "2026-07-01T12:30:00.000Z",
          createdById: "user-2",
          updatedById: "user-1",
          totalViewCount: 0
        }}
        onClose={vi.fn()}
        onSave={vi.fn().mockResolvedValue(false)}
      />
    );

    expect(screen.getByLabelText("Summary")).toHaveValue("How to return an item");
    expect(screen.getByLabelText("Article Created Date")).toHaveValue("2026-07-01T12:30:00.000Z");
    expect(screen.getByLabelText("Created By")).toHaveValue("Previous Author");
    expect(screen.getByLabelText("Last Modified By")).toHaveValue("Primary User");
    expect(screen.getByLabelText("Article Total View Count")).toHaveValue("0");
  });

  it("hydrates every Quick Text channel and lets a saved channel be removed", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(false);
    render(
      <QuickTextModal
        data={data}
        initial={{ id: "quick-1", name: "Follow up", message: "Thanks", channels: ["Email", "Task"] }}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    const selected = screen.getByLabelText("Selected Channels");
    expect(selected).toHaveTextContent("Email");
    expect(selected).toHaveTextContent("Task");

    await user.selectOptions(selected, "Task");
    await user.click(screen.getByRole("button", { name: "Move selection to Available" }));
    expect(selected).not.toHaveTextContent("Task");

    await user.click(screen.getByRole("button", { name: "Update" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ channels: ["Email"] }));
  });

  it("preserves a Store currency outside the suggested list", () => {
    render(
      <StoreEditor
        data={data}
        initial={{ id: "store-1", name: "Japan Store", currency: "JPY" }}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    expect(screen.getByLabelText("Currency")).toHaveValue("JPY");
  });

  it("allows hyphens while manually typing a Store URL slug", async () => {
    const user = userEvent.setup();
    render(<StoreEditor data={data} onClose={vi.fn()} onSaved={vi.fn()} />);

    const slug = screen.getByLabelText("URL Slug");
    await user.type(slug, "-");
    expect(slug).toHaveValue("-");

    await user.clear(slug);
    await user.type(slug, "summer-sale");

    expect(slug).toHaveValue("summer-sale");
  });

  it("keeps an archived Store visible on an existing draft order", () => {
    const orderData = {
      ...data,
      stores: [
        { id: "store-active", name: "Current Store", status: "Active", currency: "USD" },
        { id: "store-archived", name: "Legacy Store", status: "Archived", currency: "CAD" }
      ]
    } as unknown as ScopedCrmData;
    render(
      <OrderEditor
        data={orderData}
        initial={{
          id: "order-1",
          orderNumber: "D-100",
          storeId: "store-archived",
          lines: [
            {
              id: "line-1",
              productId: "outside-page",
              product: { id: "outside-page", name: "Legacy Product" },
              quantity: 1,
              unitPrice: 10,
              discountAmount: 0,
              taxRate: 0
            }
          ]
        }}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    expect(screen.getByLabelText("Store")).toHaveValue("store-archived");
    expect(screen.getByRole("option", { name: "Legacy Store (Archived)" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Line 1 Product" })).toHaveValue("Legacy Product");
  });
});
