import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EmptyPanel, LoadingPanel, ToastHost } from "./crm-primitives";

describe("CRM feedback primitives", () => {
  it("announces route loading state", () => {
    render(<LoadingPanel label="Loading Accounts…" />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading Accounts…");
  });

  it("renders an actionable empty state", async () => {
    const onAction = vi.fn();
    render(<EmptyPanel title="No leads" body="Create the first lead." action="New Lead" onAction={onAction} />);
    await userEvent.click(screen.getByRole("button", { name: "New Lead" }));
    expect(onAction).toHaveBeenCalledOnce();
  });

  it("labels success and error feedback accessibly", () => {
    const { rerender } = render(<ToastHost toast={{ tone: "success", message: "Account saved." }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Success");
    expect(screen.getByRole("status")).toHaveTextContent("Account saved.");
    rerender(<ToastHost toast={{ tone: "error", message: "Save failed." }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Error");
  });
});
