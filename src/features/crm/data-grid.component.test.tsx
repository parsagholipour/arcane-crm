import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DataGrid } from "@/features/crm/data-grid";
import { OBJECT_DEFINITIONS } from "@/lib/crm-metadata";

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
});
