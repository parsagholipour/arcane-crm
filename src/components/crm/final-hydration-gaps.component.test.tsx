import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { type ScopedCrmData } from "@/lib/crm-types";
import { CalendarSourceModal } from "@/components/crm/calendar/dialogs";
import { MarketingLandingPagesPanel } from "@/components/crm/MarketingLandingPagesPanel";
import { ListEmailWizard } from "@/features/crm/list-email-editor";

const data = {
  user: { id: "user-1", name: "Active User", alias: "active" },
  users: [{ id: "user-1", name: "Active User", alias: "active" }],
  accounts: [],
  contacts: [],
  leads: [],
  campaigns: [],
  listEmails: [],
  marketingLandingPages: [],
  notifications: [],
  organization: { id: "org-1", name: "Example Org", slug: "example-org" }
} as unknown as ScopedCrmData;

describe("final edit hydration gaps", () => {
  it("keeps a custom persisted List Email layout selected, previewed, and saved", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(false);
    render(
      <ListEmailWizard
        data={data}
        initialValues={{
          id: "email-1",
          layoutType: "Partner Spotlight",
          subject: "A saved partner update",
          body: "Persisted custom-layout content",
          status: "Draft",
          recipientType: "Contacts",
          recipients: ["contact:outside-page"]
        }}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    expect(screen.getByRole("radio", { name: /Partner Spotlight/ })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Preview" }));
    expect(screen.getByText("Partner Spotlight Layout")).toBeInTheDocument();
    expect(screen.getByText("A saved partner update")).toBeInTheDocument();
    expect(screen.getByText("Persisted custom-layout content")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Select & Continue" }));
    await user.click(screen.getByRole("button", { name: "Save Draft" }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ layoutType: "Partner Spotlight", status: "Draft" }))
    );
  });

  it("keeps an archived Landing Page campaign label and inactive owner visible", async () => {
    const user = userEvent.setup();
    const landingData = {
      ...data,
      campaigns: [
        { id: "active-campaign", name: "Active Campaign", status: "In Progress" },
        { id: "archived-campaign", name: "Archived Campaign", status: "Archived" }
      ],
      marketingLandingPages: [
        {
          id: "page-1",
          name: "Archived Campaign Page",
          slug: "archived-campaign-page",
          status: "Draft",
          headline: "Keep the saved relationships",
          ownerId: "inactive-owner",
          campaignId: "archived-campaign",
          campaign: { id: "archived-campaign", name: "Archived Campaign", status: "Archived" },
          fields: ["email"],
          submissions: []
        }
      ]
    } as unknown as ScopedCrmData;
    render(<MarketingLandingPagesPanel data={landingData} onDataChange={vi.fn()} onToast={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("Owner")).toHaveValue("inactive-owner");
    expect(screen.getByLabelText("Owner")).toHaveDisplayValue("inactive-owner (Inactive)");
    expect(screen.getByRole("combobox", { name: "Campaign" })).toHaveValue("Archived Campaign");
  });

  it("shows and saves a Calendar Source color outside the standard swatches", async () => {
    const user = userEvent.setup();
    const source = {
      id: "calendar-1",
      name: "Imported Calendar",
      type: "Other",
      color: "#123abc",
      visible: true
    };
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<CalendarSourceModal state={{ type: "edit", source }} onClose={vi.fn()} onSave={onSave} />);

    const savedColor = screen.getByRole("button", { name: "Use Saved color #123abc" });
    expect(savedColor).toHaveClass("ring-2", "ring-brand-500");
    expect(screen.getByText("#123abc")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ color: "#123abc" }), source));
  });
});
