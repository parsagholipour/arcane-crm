import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { type ScopedCrmData } from "@/lib/crm-types";
import { GenericRecordModal } from "@/features/crm/record-editors";

const opportunity = {
  id: "opportunity-1",
  name: "Global Expansion",
  accountId: "account-1",
  contactId: "contact-1",
  closeDate: "2026-09-30T00:00:00.000Z",
  amount: "125000.50",
  description: "Expand the existing agreement.",
  ownerId: "user-1",
  stage: "Propose",
  probability: 0,
  forecastCategory: "Best Case",
  nextStep: "Send the revised proposal",
  leadSource: "Partner",
  courier: "FedEx",
  trackingNumber: "TRACK-123"
};

const data = {
  user: { id: "user-1", name: "Primary User", alias: "primary" },
  users: [{ id: "user-1", name: "Primary User", alias: "primary" }],
  accounts: [{ id: "account-1", name: "Robert Industries" }],
  contacts: [{ id: "contact-1", firstName: "Grace", lastName: "Hopper", accountId: "account-1" }],
  opportunities: [opportunity]
} as unknown as ScopedCrmData;

describe("Opportunity edit modal", () => {
  it("loads every persisted field and adapts the API timestamp for the Close Date input", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(false);

    render(
      <GenericRecordModal
        mode="edit"
        object="Opportunity"
        data={data}
        record={opportunity}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    expect(screen.getByRole("textbox", { name: /Opportunity Name/ })).toHaveValue("Global Expansion");
    expect(screen.getByRole("combobox", { name: /Account Name/ })).toHaveValue("Robert Industries");
    expect(screen.getByRole("combobox", { name: /Contact Name/ })).toHaveValue("Grace Hopper");
    expect(screen.getByLabelText(/Close Date/)).toHaveValue("2026-09-30");
    expect(screen.getByRole("spinbutton", { name: /Amount/ })).toHaveValue(125000.5);
    expect(screen.getByRole("textbox", { name: /Description/ })).toHaveValue("Expand the existing agreement.");
    expect(screen.getByRole("combobox", { name: /Opportunity Owner/ })).toHaveValue("Primary User");
    expect(screen.getByRole("combobox", { name: /^Stage/ })).toHaveTextContent("Propose");
    expect(screen.getByRole("spinbutton", { name: /Probability/ })).toHaveValue(0);
    expect(screen.getByRole("combobox", { name: /Forecast Category/ })).toHaveTextContent("Best Case");
    expect(screen.getByRole("textbox", { name: /Next Step/ })).toHaveValue("Send the revised proposal");
    expect(screen.getByRole("combobox", { name: /Lead Source/ })).toHaveTextContent("Partner");
    expect(screen.getByRole("combobox", { name: /Courier/ })).toHaveTextContent("FedEx");
    expect(screen.getByRole("textbox", { name: /Tracking Number/ })).toHaveValue("TRACK-123");

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave).toHaveBeenCalledWith({ ...opportunity, closeDate: "2026-09-30" }, false);
  });
});
