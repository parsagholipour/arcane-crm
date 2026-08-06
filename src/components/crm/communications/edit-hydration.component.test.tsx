import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { type ScopedCrmData } from "@/lib/crm-types";
import { MessagingSessionEditorModal } from "@/components/crm/communications/messaging-editor";
import { VideoCallEditorModal } from "@/components/crm/communications/video-editor";

const data = {
  user: { id: "user-1", name: "Active User", alias: "active" },
  users: [{ id: "user-1", name: "Active User", alias: "active" }],
  accounts: [],
  contacts: [],
  opportunities: []
} as unknown as ScopedCrmData;

const callbacks = {
  onClose: vi.fn(),
  onSaved: vi.fn(),
  onToast: vi.fn()
};

describe("communication editor hydration", () => {
  it("keeps unavailable Messaging owner, participant, and custom role visible", () => {
    render(
      <MessagingSessionEditorModal
        data={data}
        initial={{
          id: "session-1",
          name: "Escalation Chat",
          ownerId: "former-owner",
          ownerName: "Former Owner",
          accountId: "unloaded-account",
          account: { id: "unloaded-account", name: "Nested Account" },
          contactId: "unloaded-contact",
          contact: { id: "unloaded-contact", firstName: "Nested", lastName: "Contact" },
          participants: [
            {
              contactId: "archived-contact",
              name: "Legacy Customer",
              address: "legacy@example.com",
              role: "Sponsor"
            }
          ]
        }}
        {...callbacks}
      />
    );

    expect(screen.getByLabelText("Owner")).toHaveValue("former-owner");
    expect(screen.getByLabelText("Owner")).toHaveDisplayValue("Former Owner (Unavailable)");
    expect(screen.getByRole("combobox", { name: "Account" })).toHaveValue("Nested Account");
    expect(screen.getByRole("combobox", { name: "Primary Contact" })).toHaveValue("Nested Contact");
    expect(screen.getByRole("combobox", { name: "Participant 1 Contact" })).toHaveValue(
      "Contact: Legacy Customer (Unavailable)"
    );
    expect(screen.getByRole("combobox", { name: "Participant 1 Role" })).toHaveValue("Sponsor");
  });

  it("keeps unavailable Video organizer, participant, and custom role visible", () => {
    render(
      <VideoCallEditorModal
        data={data}
        initial={{
          id: "video-1",
          name: "Migration Review",
          status: "Scheduled",
          organizerId: "former-organizer",
          organizerName: "Former Organizer",
          accountId: "unloaded-account",
          account: { id: "unloaded-account", name: "Nested Account" },
          contactId: "unloaded-contact",
          contact: { id: "unloaded-contact", firstName: "Nested", lastName: "Contact" },
          opportunityId: "unloaded-opportunity",
          opportunity: { id: "unloaded-opportunity", name: "Nested Opportunity" },
          scheduledStartAt: "2026-09-30T08:15:00.000Z",
          scheduledEndAt: "2026-09-30T09:15:00.000Z",
          participants: [
            {
              userId: "former-presenter",
              name: "Guest Interpreter",
              email: "guest@example.com",
              role: "Interpreter"
            }
          ]
        }}
        {...callbacks}
      />
    );

    expect(screen.getByLabelText("Organizer")).toHaveValue("former-organizer");
    expect(screen.getByLabelText("Organizer")).toHaveDisplayValue("Former Organizer (Unavailable)");
    expect(screen.getByRole("combobox", { name: "Account" })).toHaveValue("Nested Account");
    expect(screen.getByRole("combobox", { name: "Contact" })).toHaveValue("Nested Contact");
    expect(screen.getByRole("combobox", { name: "Opportunity" })).toHaveValue("Nested Opportunity");
    expect(screen.getByRole("combobox", { name: "Participant 1" })).toHaveValue(
      "User: Guest Interpreter (Unavailable)"
    );
    expect(screen.getByRole("combobox", { name: "Participant 1 Role" })).toHaveValue("Interpreter");
  });
});
