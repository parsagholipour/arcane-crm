import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LeadCountryFilter, LeadLocationFilters } from "@/features/crm/lead-country-filter";

describe("LeadCountryFilter", () => {
  it("offers all countries and reports the selected country", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn()
    });
    render(<LeadCountryFilter value="" onChange={onChange} />);

    await user.click(screen.getByRole("combobox", { name: "Filter leads by country" }));
    await user.click(screen.getByRole("option", { name: "Canada" }));

    expect(onChange).toHaveBeenCalledWith("Canada");
  });
});

describe("LeadLocationFilters", () => {
  it("shows US states only when the United States is selected", async () => {
    const user = userEvent.setup();
    const onStateChange = vi.fn();
    const { rerender } = render(
      <LeadLocationFilters country="Canada" state="" onCountryChange={vi.fn()} onStateChange={onStateChange} />
    );

    expect(screen.queryByRole("combobox", { name: "Filter leads by state" })).not.toBeInTheDocument();

    rerender(
      <LeadLocationFilters country="United States" state="" onCountryChange={vi.fn()} onStateChange={onStateChange} />
    );
    await user.click(screen.getByRole("combobox", { name: "Filter leads by state" }));
    await user.click(screen.getByRole("option", { name: "California" }));

    expect(onStateChange).toHaveBeenCalledWith("California");
  });
});
