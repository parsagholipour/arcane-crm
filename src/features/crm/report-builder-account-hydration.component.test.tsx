import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type RecordData, type ScopedCrmData } from "@/lib/crm-types";
import { YourAccountPage } from "@/features/crm/account";
import { ReportBuilderModal } from "@/features/crm/report-builder-modal";

const resourceMocks = vi.hoisted(() => ({
  createReport: vi.fn(),
  updateReport: vi.fn(),
  createDashboard: vi.fn(),
  updateDashboard: vi.fn(),
  updateProfile: vi.fn(),
  updatePreferences: vi.fn()
}));

vi.mock("@/lib/api/resources", () => ({ resourceApi: resourceMocks }));

function dataWith(overrides: Partial<ScopedCrmData> = {}): ScopedCrmData {
  return {
    user: { id: "user-1", name: "Primary User", alias: "primary", email: "primary@example.com" },
    users: [{ id: "user-1", name: "Primary User", alias: "primary", email: "primary@example.com" }],
    organization: { id: "org-1", name: "Primary Org", slug: "primary" },
    organizations: [{ id: "org-1", name: "Primary Org", slug: "primary", role: "ADMIN" }],
    organizationRole: "ADMIN",
    isSuperAdmin: false,
    emailDeliveryConfigured: false,
    accounts: [],
    contacts: [],
    leads: [],
    opportunities: [],
    cases: [],
    products: [],
    priceBooks: [],
    priceBookEntries: [],
    events: [],
    calendarSources: [],
    quickTexts: [],
    quickTextFolders: [],
    quickTextFavorites: [],
    knowledgeArticles: [],
    listEmails: [],
    messagingSessions: [],
    invoices: [],
    videoCalls: [],
    files: [],
    attachments: [],
    tasks: [],
    emailActivities: [],
    emailDeliveries: [],
    callActivities: [],
    partners: [],
    stores: [],
    commerceOrders: [],
    inventoryItems: [],
    commercePromotions: [],
    commerceFulfillments: [],
    campaigns: [],
    campaignMembers: [],
    recordLabels: [],
    marketingActivations: [],
    marketingLandingPages: [],
    customReports: [],
    customDashboards: [],
    notifications: [],
    notificationPreferences: [],
    guidanceItems: [],
    guidanceStates: [],
    userPreferences: [],
    setupShortcutStates: [],
    helpArticleStates: [],
    appNavPreferences: [],
    listViewPreferences: [],
    globalSearchRecents: [],
    agentforceMessages: [],
    ...overrides
  };
}

describe("persisted editor option hydration", () => {
  beforeEach(() => {
    resourceMocks.updateReport.mockReset();
  });

  it("keeps an unsupported saved report object and its field configuration", async () => {
    const user = userEvent.setup();
    const initial: RecordData = {
      id: "report-products",
      name: "Products by Family",
      object: "Product2",
      groupField: "family",
      columns: ["name", "productCode", "family"]
    };
    resourceMocks.updateReport.mockResolvedValue({ customReports: [initial] });

    render(
      <ReportBuilderModal
        reportType="Products"
        initial={initial}
        data={dataWith({
          products: [{ id: "product-1", name: "Router", productCode: "RTR", family: "Hardware" }]
        })}
        onClose={vi.fn()}
        onDataChange={vi.fn()}
        onToast={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Product (Saved)" })).toHaveClass("bg-brand-50");
    expect(screen.getByRole("checkbox", { name: "Product Name" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Product Code" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Product Family" })).toBeChecked();
    expect(screen.getByRole("combobox", { name: "Group Rows" })).toHaveTextContent("Product Family");
    expect(screen.getAllByText("Hardware")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Update Report" }));
    await waitFor(() => expect(resourceMocks.updateReport).toHaveBeenCalledOnce());
    expect(resourceMocks.updateReport).toHaveBeenCalledWith("report-products", {
      name: "Products by Family",
      object: "Product2",
      groupField: "family",
      columns: ["name", "productCode", "family"]
    });
  });

  it("shows persisted account preferences outside the suggested option lists", () => {
    render(
      <YourAccountPage
        data={dataWith({
          userPreferences: [
            {
              id: "preferences-1",
              userId: "user-1",
              displayDensity: "Spacious",
              timezone: "Asia/Tokyo",
              locale: "ja-JP",
              guidanceEnabled: true,
              consoleTabsEnabled: true
            }
          ]
        })}
        onDataChange={vi.fn()}
        onToast={vi.fn()}
      />
    );

    expect(screen.getByLabelText("Display Density")).toHaveValue("Spacious");
    expect(screen.getByLabelText("Timezone")).toHaveValue("Asia/Tokyo");
    expect(screen.getByLabelText("Locale")).toHaveValue("ja-JP");
    expect(screen.getByRole("option", { name: "Spacious" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Asia/Tokyo" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "ja-JP" })).toBeInTheDocument();
  });
});
