import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PoAppIntegrationDto } from "@/lib/api/contracts";
import { PoAppIntegrationClient } from "./PoAppIntegrationClient";

const REAL_TOKEN = "poa_l0_rwGVqLAFQD9ga7neS9xbzAJcSCUWIEz85bHO37h0";

function settings(overrides: Partial<PoAppIntegrationDto> = {}): PoAppIntegrationDto {
  return {
    baseUrl: "https://po.example.com/api/v1",
    enabled: false,
    hasToken: false,
    tokenPreview: null,
    tokenSource: "none",
    hasWebhookSecret: false,
    storeId: null,
    syncIntervalMinutes: 60,
    poStoreId: null,
    poStoreName: null,
    poTokenId: null,
    scopes: [],
    status: "Disconnected",
    lastError: null,
    lastSyncedAt: null,
    lastFullSyncAt: null,
    nextSyncAt: null,
    failureCount: 0,
    productsSynced: 0,
    encryptionConfigured: true,
    ...overrides
  };
}

function renderClient(overrides: Partial<PoAppIntegrationDto> = {}) {
  return render(
    <PoAppIntegrationClient
      initialSettings={settings(overrides)}
      stores={[{ id: "store-1", name: "Main Store", currency: "USD" }]}
      webhookUrl="https://crm.example.com/api/integrations/po-app/webhook/org-1"
    />
  );
}

describe("PO App integration settings", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("never renders the API token, only its masked preview", () => {
    renderClient({ hasToken: true, tokenPreview: "poa_••••37h0", tokenSource: "organization", status: "Connected" });

    expect(document.body.textContent).not.toContain(REAL_TOKEN);
    expect(document.body.innerHTML).not.toContain(REAL_TOKEN);
    expect(screen.getByPlaceholderText("poa_••••37h0")).toHaveValue("");
  });

  it("keeps sync controls unavailable until the integration is connected and enabled", () => {
    renderClient({ hasToken: true, enabled: false });

    expect(screen.getByRole("button", { name: "Sync now" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Full resync" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Test connection" })).toBeEnabled();
    expect(screen.getByText(/Sync actions are disabled because “Enable scheduled sync” is turned off/)).toBeVisible();
  });

  it("explains what a full resync changes", () => {
    renderClient({ hasToken: true, enabled: true, status: "Connected" });

    expect(screen.getByText("What does Full resync do?")).toBeVisible();
    expect(screen.getByText(/checks the complete PO App catalogue/)).toBeVisible();
    expect(screen.getByText(/does not delete CRM products/)).toBeVisible();
  });

  it("explains every reason syncing is unavailable", () => {
    renderClient({ hasToken: false, enabled: false });

    expect(screen.getByText(/no API token is saved and “Enable scheduled sync” is turned off/)).toBeVisible();
  });

  it("enables syncing once a token is saved and the schedule is on", () => {
    renderClient({ hasToken: true, enabled: true, status: "Connected", poStoreName: "Arcane Fortress" });

    expect(screen.getByRole("button", { name: "Sync now" })).toBeEnabled();
    expect(screen.getByText("Arcane Fortress")).toBeInTheDocument();
    expect(screen.getByText("Connected")).toBeInTheDocument();
  });

  it("cannot test a connection before a token exists", () => {
    renderClient();

    expect(screen.getByRole("button", { name: "Test connection" })).toBeDisabled();
  });

  it("warns when secrets cannot be encrypted at rest", () => {
    renderClient({ encryptionConfigured: false });

    expect(screen.getByRole("alert")).toHaveTextContent("INTEGRATION_ENCRYPTION_KEY");
  });

  it("tells an admin to re-enter a token that can no longer be decrypted", () => {
    renderClient({ tokenSource: "unreadable", hasToken: false });

    expect(screen.getByRole("alert")).toHaveTextContent("could not be decrypted");
  });

  it("surfaces the last sync failure", () => {
    renderClient({ status: "Error", lastError: "PO App rejected the API token." });

    expect(screen.getByRole("alert")).toHaveTextContent("PO App rejected the API token.");
  });

  it("shows the webhook URL to register and reports the sync outcome", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            summary: { organizations: 1, created: 3, updated: 2, skipped: 0, deactivated: 1, unreadable: 0, failed: 0 },
            integration: settings({ hasToken: true, enabled: true, status: "Connected", productsSynced: 5 })
          }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    renderClient({ hasToken: true, enabled: true, status: "Connected" });

    expect(screen.getByDisplayValue("https://crm.example.com/api/integrations/po-app/webhook/org-1")).toHaveAttribute(
      "readonly"
    );

    await userEvent.click(screen.getByRole("button", { name: "Sync now" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/integrations/po-app/sync",
      expect.objectContaining({ method: "POST" })
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("3 added, 2 updated, 1 deactivated");
  });
});
