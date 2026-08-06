import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { type FieldDefinition, type ScopedCrmData } from "@/lib/crm-types";
import { LookupField } from "@/features/crm/form-controls";
import { GenericRecordModal } from "@/features/crm/record-editors";

const data = {
  user: { id: "user-1", name: "Primary User", alias: "primary" },
  users: [{ id: "user-1", name: "Primary User", alias: "primary" }],
  accounts: [],
  contacts: [],
  leads: [],
  opportunities: [],
  cases: [],
  products: [],
  priceBooks: []
} as unknown as ScopedCrmData;

describe("persisted form-control hydration", () => {
  it("keeps a persisted picklist value that is absent from current metadata", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(false);

    render(
      <GenericRecordModal
        mode="edit"
        object="Product2"
        data={data}
        record={{ id: "product-1", name: "Legacy Router", family: "Hardware" }}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    const family = screen.getByRole("combobox", { name: "Product Family" });
    expect(family).toHaveTextContent("Hardware");
    await user.click(family);
    expect(screen.getByRole("option", { name: "Hardware" })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({ family: "Hardware" });
  });

  it("shows and preserves off-grid persisted Price Book times", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(false);

    render(
      <GenericRecordModal
        mode="edit"
        object="Pricebook2"
        data={data}
        record={{
          id: "price-book-1",
          name: "Legacy Price Book",
          validFrom: "2026-09-30T10:07:00.000Z",
          validTo: "2026-10-31T17:43:00.000Z"
        }}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    expect(screen.getByLabelText("Valid From")).toHaveValue("2026-09-30");
    expect(screen.getByRole("combobox", { name: "Valid From Time" })).toHaveTextContent("10:07");
    expect(screen.getByLabelText("Valid To")).toHaveValue("2026-10-31");
    expect(screen.getByRole("combobox", { name: "Valid To Time" })).toHaveTextContent("17:43");

    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      validFrom: "2026-09-30",
      validFromTime: "10:07",
      validTo: "2026-10-31",
      validToTime: "17:43"
    });
  });

  it("falls back to a saved lookup ID or explicit label without breaking search", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const field: FieldDefinition = {
      name: "parentAccountId",
      label: "Parent Account",
      section: "About",
      type: "lookup",
      lookupObject: "Account"
    };
    const view = render(
      <LookupField
        field={field}
        value="missing-account"
        data={data}
        options={[{ id: "available-account", label: "Available Account" }]}
        onChange={onChange}
        inlineSelection
      />
    );

    expect(screen.getByRole("combobox", { name: "Parent Account" })).toHaveValue("missing-account");

    view.rerender(
      <LookupField
        field={field}
        value="missing-account"
        selectedLabel="Archived Parent"
        data={data}
        options={[{ id: "available-account", label: "Available Account" }]}
        onChange={onChange}
        inlineSelection
      />
    );
    const lookup = screen.getByRole("combobox", { name: "Parent Account" });
    expect(lookup).toHaveValue("Archived Parent");

    await user.click(lookup);
    await waitFor(() => expect(lookup).toHaveValue(""));
    await user.click(screen.getByRole("option", { name: "Available Account" }));
    expect(onChange).toHaveBeenCalledWith("available-account");
  });
});
