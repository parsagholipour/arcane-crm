import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { type ScopedCrmData } from "@/lib/crm-types";
import { EventModal } from "@/features/crm/event-editor";

const data = {
  user: { id: "user-1", name: "Primary User", alias: "primary" },
  users: [
    { id: "user-1", name: "Primary User", alias: "primary" },
    { id: "user-2", name: "Secondary User", alias: "secondary" }
  ],
  accounts: [],
  contacts: [],
  leads: [],
  opportunities: [],
  cases: [],
  products: [],
  priceBooks: [],
  knowledgeArticles: [],
  listEmails: [],
  invoices: [],
  campaigns: [{ id: "campaign-1", name: "FY27 Launch" }],
  calendarSources: [],
  quickTexts: [],
  userPreferences: [{ timezone: "UTC" }],
  emailDeliveryConfigured: false
} as unknown as ScopedCrmData;

describe("EventModal edit hydration", () => {
  it("shows the persisted assignee, user attendee, and singular Related To record", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(false);

    render(
      <EventModal
        data={data}
        record={{
          id: "event-1",
          subject: "Meeting",
          assignedToId: "user-2",
          attendeeIds: ["user-2", "legacy-user"],
          relatedObjectType: "Campaign",
          relatedRecordId: "campaign-1",
          startAt: "2026-09-30T08:15:00.000Z",
          endAt: "2026-09-30T09:15:00.000Z"
        }}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    expect(screen.getByLabelText(/Assigned To/)).toHaveValue("Secondary User");
    expect(screen.getByRole("button", { name: "Remove Secondary User" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove legacy-user" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Related To" })).toHaveValue("FY27 Launch");

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        assignedToId: "user-2",
        attendeeIds: ["user-2", "legacy-user"],
        relatedObjectType: "Campaigns",
        relatedRecordId: "campaign-1"
      })
    );
  });
});
