import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OrganizationApiAccessDto } from "@/lib/api/contracts";
import { OrganizationApiAccessClient } from "./OrganizationApiAccessClient";

const REAL_TOKEN = "crm_l0_rwGVqLAFQD9ga7neS9xbzAJcSCUWIEz85bHO37h0";

function settings(overrides: Partial<OrganizationApiAccessDto> = {}): OrganizationApiAccessDto {
  return {
    hasToken: false,
    tokenPreview: null,
    tokenCreatedAt: null,
    lastUsedAt: null,
    webhookUrl: null,
    webhookEnabled: false,
    hasWebhookSecret: false,
    webhookSecretPreview: null,
    webhookSecretReadable: true,
    webhookFailureCount: 0,
    webhookLastError: null,
    webhookLastDeliveredAt: null,
    encryptionConfigured: true,
    publicApiBaseUrl: "https://crm.example.com/api/v1",
    ...overrides
  };
}

describe("Organization API access settings", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("never renders a stored token, only its masked preview", () => {
    render(
      <OrganizationApiAccessClient initialSettings={settings({ hasToken: true, tokenPreview: "crm_l0_rw••••" })} />
    );

    expect(document.body.textContent).not.toContain(REAL_TOKEN);
    expect(screen.getByText("crm_l0_rw••••")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revoke" })).toBeEnabled();
  });

  it("shows a newly issued token once and hides it after dismiss", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { ...settings({ hasToken: true, tokenPreview: "crm_l0_rw••••" }), token: REAL_TOKEN }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    render(<OrganizationApiAccessClient initialSettings={settings()} />);
    await userEvent.click(screen.getByRole("button", { name: "Create token" }));

    expect(await screen.findByText(REAL_TOKEN)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "I have copied it" }));
    expect(screen.queryByText(REAL_TOKEN)).not.toBeInTheDocument();
    expect(screen.getByText("crm_l0_rw••••")).toBeInTheDocument();
  });

  it("disables webhook test and rotate until a URL is saved", () => {
    render(<OrganizationApiAccessClient initialSettings={settings()} />);

    expect(screen.getByRole("button", { name: "Send test" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Rotate secret" })).toBeDisabled();
  });

  it("warns when webhook secrets cannot be encrypted", () => {
    render(<OrganizationApiAccessClient initialSettings={settings({ encryptionConfigured: false })} />);

    expect(screen.getByRole("alert")).toHaveTextContent("INTEGRATION_ENCRYPTION_KEY");
  });
});
