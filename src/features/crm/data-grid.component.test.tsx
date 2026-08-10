import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DataGrid } from "@/features/crm/data-grid";
import { OBJECT_DEFINITIONS } from "@/lib/crm-metadata";
import type { RecordData } from "@/lib/crm-types";

const records = [
  {
    id: "opportunity-1",
    name: "Global Expansion",
    accountName: "Robert Industries",
    closeDate: "2026-09-30",
    stage: "Propose",
    amount: 125000,
    ownerAlias: "primary"
  }
];

function renderGrid(direction?: "asc" | "desc") {
  return render(
    <DataGrid
      definition={OBJECT_DEFINITIONS.Opportunity}
      records={records}
      selected={[]}
      sortState={direction ? { key: "name", direction } : null}
      onSelect={vi.fn()}
      onSort={vi.fn()}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
    />
  );
}

describe("DataGrid column sorting", () => {
  it.each([
    ["asc", "ascending", "lucide-arrow-up"],
    ["desc", "descending", "lucide-arrow-down"]
  ] as const)("shows the active %s sort direction in the column header", (direction, ariaSort, iconClass) => {
    renderGrid(direction);

    const header = screen.getByRole("columnheader", { name: /Opportunity Name/ });
    expect(header).toHaveAttribute("aria-sort", ariaSort);
    expect(
      within(header).getByRole("button", { name: "Opportunity Name" }).querySelector(`.${iconClass}`)
    ).not.toBeNull();
  });

  it("keeps unsorted column headers free of an active sort state", () => {
    renderGrid();

    const header = screen.getByRole("columnheader", { name: /Opportunity Name/ });
    expect(header).not.toHaveAttribute("aria-sort");
    expect(
      within(header).getByRole("button", { name: "Opportunity Name" }).querySelector(".lucide-chevrons-up-down")
    ).not.toBeNull();
  });

  it("disables derived columns that cannot be sorted across paginated records", () => {
    render(
      <DataGrid
        definition={OBJECT_DEFINITIONS.Opportunity}
        records={records}
        selected={[]}
        sortableColumns={["name", "accountName", "closeDate", "stage", "amount"]}
        onSelect={vi.fn()}
        onSort={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Opportunity Name" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Tracking Status" })).toBeDisabled();
  });
});

describe("DataGrid lead status editing", () => {
  const lead: RecordData = {
    id: "lead-1",
    firstName: "Ada",
    lastName: "Lovelace",
    displayName: "Ada Lovelace",
    company: "Analytical Engines",
    status: "New"
  };

  function renderLeads(records: RecordData[], onInlineSave = vi.fn().mockResolvedValue(true)) {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
    render(
      <DataGrid
        definition={OBJECT_DEFINITIONS.Lead}
        records={records}
        selected={[]}
        onSelect={vi.fn()}
        onSort={vi.fn()}
        onInlineSave={onInlineSave}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    return onInlineSave;
  }

  it("saves the status picked from the Lead Status cell", async () => {
    const user = userEvent.setup();
    const onInlineSave = renderLeads([lead]);

    await user.click(screen.getByRole("combobox", { name: "Lead Status for Ada Lovelace" }));
    await user.click(screen.getByRole("option", { name: "Qualified" }));

    expect(onInlineSave).toHaveBeenCalledWith(lead, "status", "Qualified");
  });

  it("skips the save when the picked status already matches the lead", async () => {
    const user = userEvent.setup();
    const onInlineSave = renderLeads([lead]);

    await user.click(screen.getByRole("combobox", { name: "Lead Status for Ada Lovelace" }));
    await user.click(screen.getByRole("option", { name: "New" }));

    expect(onInlineSave).not.toHaveBeenCalled();
  });

  it("locks the status picker on converted leads the server treats as read-only", () => {
    renderLeads([{ ...lead, id: "lead-2", convertedAt: "2026-01-05T10:00:00.000Z" }]);

    expect(screen.getByRole("combobox", { name: "Lead Status for Ada Lovelace" })).toBeDisabled();
  });
});
