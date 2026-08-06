import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { type ScopedCrmData } from "@/lib/crm-types";
import { CampaignEditorModal } from "@/components/crm/campaigns/editor";
import { VideoCallEditorModal } from "@/components/crm/communications/video-editor";
import { toDateTimeInput } from "@/components/crm/communications/primitives";
import { InvoiceEditorModal } from "@/components/crm/invoices/editor";
import { EventModal } from "@/features/crm/event-editor";
import { ListEmailWizard } from "@/features/crm/list-email-editor";

const data = {
  user: { id: "user-1", name: "Primary User", alias: "primary" },
  users: [{ id: "user-1", name: "Primary User", alias: "primary" }],
  accounts: [{ id: "account-1", name: "Robert Industries" }],
  contacts: [],
  leads: [],
  opportunities: [],
  products: [],
  priceBooks: [],
  priceBookEntries: [],
  campaigns: [],
  calendarSources: [],
  quickTexts: [],
  listEmails: [],
  userPreferences: [{ timezone: "UTC" }],
  emailDeliveryConfigured: false
} as unknown as ScopedCrmData;

describe("edit-form date hydration", () => {
  it("hydrates Campaign date inputs from serialized API timestamps", () => {
    render(
      <CampaignEditorModal
        data={data}
        initial={{
          id: "campaign-1",
          name: "Autumn Campaign",
          ownerId: "inactive-owner",
          startDate: "2026-09-30T00:00:00.000Z",
          endDate: "2026-10-31T00:00:00.000Z"
        }}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        onToast={vi.fn()}
      />
    );

    expect(screen.getByLabelText("Start Date")).toHaveValue("2026-09-30");
    expect(screen.getByLabelText("End Date")).toHaveValue("2026-10-31");
    expect(screen.getByLabelText("Owner")).toHaveValue("inactive-owner");
  });

  it("hydrates Invoice date inputs from serialized API timestamps", () => {
    const invoiceData = { ...data, products: [] } as unknown as ScopedCrmData;
    render(
      <InvoiceEditorModal
        mode="edit"
        data={invoiceData}
        invoice={{
          id: "invoice-1",
          status: "Draft",
          accountId: "account-1",
          issueDate: "2026-09-30T00:00:00.000Z",
          dueDate: "2026-10-30T00:00:00.000Z",
          currency: "JPY",
          lineItems: [
            {
              id: "line-1",
              productId: "product-retired",
              product: { id: "product-retired", name: "Retired Widget", active: false },
              description: "Retired Widget",
              quantity: 1,
              unitPrice: 100,
              discountAmount: 0,
              taxRate: 0
            }
          ]
        }}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        onToast={vi.fn()}
      />
    );

    expect(screen.getByLabelText("Issue Date")).toHaveValue("2026-09-30");
    expect(screen.getByLabelText("Due Date")).toHaveValue("2026-10-30");
    expect(screen.getByLabelText("Currency")).toHaveValue("JPY");
    expect(screen.getByRole("combobox", { name: "Line 1 Product" })).toHaveValue("Retired Widget");
  });

  it("hydrates Video Call local date-time inputs from serialized API timestamps", () => {
    const scheduledStartAt = "2026-09-30T08:15:00.000Z";
    const scheduledEndAt = "2026-09-30T09:45:00.000Z";
    render(
      <VideoCallEditorModal
        data={data}
        initial={{
          id: "video-1",
          name: "Planning Call",
          organizerId: "user-1",
          status: "Scheduled",
          scheduledStartAt,
          scheduledEndAt
        }}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        onToast={vi.fn()}
      />
    );

    expect(screen.getByLabelText(/Start/)).toHaveValue(toDateTimeInput(scheduledStartAt));
    expect(screen.getByLabelText(/End/)).toHaveValue(toDateTimeInput(scheduledEndAt));
  });

  it("hydrates Event date and time controls in the configured time zone", () => {
    render(
      <EventModal
        data={data}
        record={{
          id: "event-1",
          subject: "Meeting",
          assignedToId: "user-1",
          startAt: "2026-09-30T08:15:00.000Z",
          endAt: "2026-09-30T09:45:00.000Z"
        }}
        onClose={vi.fn()}
        onSave={vi.fn().mockResolvedValue(false)}
      />
    );

    expect(screen.getByLabelText(/Start Date/)).toHaveValue("2026-09-30");
    expect(screen.getByRole("combobox", { name: /Start Time/ })).toHaveTextContent("08:15");
    expect(screen.getByLabelText(/End Date/)).toHaveValue("2026-09-30");
    expect(screen.getByRole("combobox", { name: /End Time/ })).toHaveTextContent("09:45");
  });

  it("hydrates a scheduled List Email date and off-grid time from its saved timestamp", () => {
    render(
      <ListEmailWizard
        data={data}
        startingStep={2}
        initialValues={{
          id: "email-1",
          layoutType: "Sales",
          subject: "Quarterly update",
          body: "Hello",
          status: "Scheduled",
          scheduledAt: "2026-09-30T08:07:00.000Z",
          recipientType: "Contacts",
          recipients: ["contact:outside-page"]
        }}
        onClose={vi.fn()}
        onSave={vi.fn().mockResolvedValue(false)}
      />
    );

    const saved = new Date("2026-09-30T08:07:00.000Z");
    const local = new Date(saved.getTime() - saved.getTimezoneOffset() * 60_000).toISOString();
    expect(screen.getByLabelText("Schedule Date")).toHaveValue(local.slice(0, 10));
    expect(screen.getByRole("combobox", { name: "Schedule Time" })).toHaveTextContent(local.slice(11, 16));
    expect(screen.getByRole("checkbox", { name: /Saved recipient: contact:outside-page/ })).toBeChecked();
  });
});
