import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OrganizationLogo } from "@/components/brand/OrganizationLogo";
import { BRAND } from "@/lib/brand";

describe("OrganizationLogo", () => {
  it("shows the organization logo when configured", () => {
    render(<OrganizationLogo name="Acme" logoUrl="https://cdn.example.com/acme.png" />);
    expect(screen.getByRole("img", { name: "Acme logo" })).toHaveAttribute("src", "https://cdn.example.com/acme.png");
    expect(screen.queryByText(BRAND.name)).not.toBeInTheDocument();
  });

  it("falls back to the current logo when absent or unable to load", () => {
    const { rerender } = render(<OrganizationLogo name="Acme" />);
    expect(screen.getByRole("img", { name: BRAND.name })).toBeInTheDocument();

    rerender(<OrganizationLogo name="Acme" logoUrl="https://cdn.example.com/broken.png" />);
    fireEvent.error(screen.getByRole("img", { name: "Acme logo" }));
    expect(screen.getByRole("img", { name: BRAND.name })).toBeInTheDocument();
  });
});
