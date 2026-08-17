"use client";

import { useState, type ReactNode } from "react";
import { AsyncButton } from "@/components/crm/AsyncButton";
import { apiRequest } from "@/lib/api/client";
import type {
  OrganizationApiAccessDto,
  OrganizationApiAccessMutationDto,
  OrganizationWebhookTestDto
} from "@/lib/api/contracts";

const inputClass =
  "h-9 w-full rounded border border-[#c9c9c9] bg-white px-3 text-sm outline-none focus:border-brand-500 disabled:bg-[#f3f3f3]";
const buttonClass =
  "inline-flex h-9 items-center justify-center gap-2 rounded border border-brand-600 bg-white px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50";
const labelClass = "text-xs font-semibold uppercase tracking-wide text-[#706e6b]";
const secretBoxClass = "break-all rounded border border-[#9ac3e8] bg-[#eef4ff] p-3 font-mono text-sm";

function Card({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="rounded border border-[#d8dde6] bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mb-3 mt-1 text-sm text-[#706e6b]">{description}</p>
      {children}
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className={labelClass}>{label}</span>
      {children}
      {hint && <span className="text-xs text-[#706e6b]">{hint}</span>}
    </label>
  );
}

function RevealedSecret({ label, value, onDismiss }: { label: string; value: string; onDismiss: () => void }) {
  return (
    <div className="mt-3 space-y-2">
      <div className={labelClass}>{label}</div>
      <p className="text-sm text-[#8e030f]">Copy this now. It will not be shown again.</p>
      <div className={secretBoxClass}>{value}</div>
      <AsyncButton className={buttonClass} onClick={onDismiss}>
        I have copied it
      </AsyncButton>
    </div>
  );
}

export function OrganizationApiAccessClient({ initialSettings }: { initialSettings: OrganizationApiAccessDto }) {
  const [settings, setSettings] = useState(initialSettings);
  const [webhookUrl, setWebhookUrl] = useState(initialSettings.webhookUrl ?? "");
  const [webhookEnabled, setWebhookEnabled] = useState(initialSettings.webhookEnabled);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  function report(text: string, isFailure = false) {
    setMessage(text);
    setFailed(isFailure);
  }

  function apply(next: OrganizationApiAccessMutationDto) {
    setSettings(next);
    setWebhookUrl(next.webhookUrl ?? "");
    setWebhookEnabled(next.webhookEnabled);
    if (next.token) setRevealedToken(next.token);
    if (next.webhookSecret) setRevealedSecret(next.webhookSecret);
  }

  async function run<T>(action: () => Promise<T>, onSuccess: (payload: T) => void) {
    setMessage(null);
    try {
      onSuccess(await action());
    } catch (error) {
      report(error instanceof Error ? error.message : "The operation could not be completed.", true);
    }
  }

  const curlExample = `curl -s "${settings.publicApiBaseUrl}/leads?limit=10" \\
  -H "Authorization: Bearer ${settings.hasToken ? "crm_…" : "<token>"}"`;

  return (
    <div className="space-y-5">
      {message && (
        <div
          role="alert"
          className={`rounded border p-3 text-sm ${
            failed ? "border-[#ea001e] bg-[#fff1f1] text-[#8e030f]" : "border-[#9ac3e8] bg-[#eef4ff]"
          }`}
        >
          {message}
        </div>
      )}
      {!settings.encryptionConfigured && (
        <div role="alert" className="rounded border border-[#ea001e] bg-[#fff1f1] p-3 text-sm text-[#8e030f]">
          Set INTEGRATION_ENCRYPTION_KEY (or AUTH_SECRET) before enabling webhooks — signing secrets are encrypted at
          rest.
        </div>
      )}
      {settings.hasWebhookSecret && !settings.webhookSecretReadable && (
        <div role="alert" className="rounded border border-[#ea001e] bg-[#fff1f1] p-3 text-sm text-[#8e030f]">
          The stored webhook secret could not be decrypted. Rotate the secret to reconnect deliveries.
        </div>
      )}

      <Card
        title="API token"
        description="One bearer token per organization. It can list and read Leads with full details. The value is shown once."
      >
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <div className={labelClass}>Status</div>
            <div className="mt-0.5 text-sm">{settings.hasToken ? "Token issued" : "No token"}</div>
          </div>
          <div>
            <div className={labelClass}>Preview</div>
            <div className="mt-0.5 font-mono text-sm">{settings.tokenPreview ?? "—"}</div>
          </div>
        </div>
        {revealedToken && (
          <RevealedSecret label="API token" value={revealedToken} onDismiss={() => setRevealedToken(null)} />
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <AsyncButton
            className={buttonClass}
            onClick={() =>
              run(
                () =>
                  apiRequest<OrganizationApiAccessMutationDto>("/api/organization/api-access/token", {
                    method: "POST"
                  }),
                (next) => {
                  apply(next);
                  report(settings.hasToken ? "API token regenerated." : "API token created.");
                }
              )
            }
          >
            {settings.hasToken ? "Regenerate token" : "Create token"}
          </AsyncButton>
          <AsyncButton
            className={buttonClass}
            disabled={!settings.hasToken}
            onClick={() =>
              run(
                () =>
                  apiRequest<OrganizationApiAccessMutationDto>("/api/organization/api-access/token", {
                    method: "DELETE"
                  }),
                (next) => {
                  apply(next);
                  setRevealedToken(null);
                  report("API token revoked.");
                }
              )
            }
          >
            Revoke
          </AsyncButton>
        </div>
        <pre className="mt-4 overflow-x-auto rounded bg-[#f3f3f3] p-3 text-xs">{curlExample}</pre>
      </Card>

      <Card
        title="Lead webhook"
        description="CRM POSTs signed lead.created, lead.updated, lead.converted, and lead.deleted events to this URL."
      >
        <Field label="Endpoint URL" hint="HTTPS in production. Private and loopback addresses are rejected.">
          <input
            className={inputClass}
            value={webhookUrl}
            onChange={(event) => setWebhookUrl(event.target.value)}
            placeholder="https://example.com/webhooks/crm-leads"
          />
        </Field>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 shrink-0 rounded border border-[#c9c9c9] accent-brand-600"
            checked={webhookEnabled}
            onChange={(event) => setWebhookEnabled(event.target.checked)}
          />
          Enable webhook deliveries
        </label>
        {revealedSecret && (
          <RevealedSecret label="Signing secret" value={revealedSecret} onDismiss={() => setRevealedSecret(null)} />
        )}
        <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
          <div>
            <div className={labelClass}>Secret</div>
            <div className="mt-0.5 font-mono">{settings.webhookSecretPreview ?? "Not issued yet"}</div>
          </div>
          <div>
            <div className={labelClass}>Last delivery</div>
            <div className="mt-0.5">
              {settings.webhookLastDeliveredAt ? new Date(settings.webhookLastDeliveredAt).toLocaleString() : "Never"}
            </div>
          </div>
        </div>
        {settings.webhookLastError && <p className="mt-2 text-sm text-[#8e030f]">{settings.webhookLastError}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <AsyncButton
            className={buttonClass}
            onClick={() =>
              run(
                () =>
                  apiRequest<OrganizationApiAccessMutationDto>("/api/organization/api-access", {
                    method: "PUT",
                    body: JSON.stringify({ webhookUrl, webhookEnabled })
                  }),
                (next) => {
                  apply(next);
                  report("Webhook settings saved.");
                }
              )
            }
          >
            Save webhook
          </AsyncButton>
          <AsyncButton
            className={buttonClass}
            disabled={!settings.webhookUrl}
            onClick={() =>
              run(
                () =>
                  apiRequest<OrganizationApiAccessMutationDto>("/api/organization/api-access/webhook", {
                    method: "PUT",
                    body: JSON.stringify({ rotateSecret: true })
                  }),
                (next) => {
                  apply(next);
                  report("Webhook signing secret rotated.");
                }
              )
            }
          >
            Rotate secret
          </AsyncButton>
          <AsyncButton
            className={buttonClass}
            disabled={!settings.webhookUrl || !settings.hasWebhookSecret}
            onClick={() =>
              run(
                () =>
                  apiRequest<OrganizationWebhookTestDto>("/api/organization/api-access/webhook/test", {
                    method: "POST"
                  }),
                ({ access, delivered, status, error }) => {
                  apply(access);
                  report(
                    delivered ? `Test delivered with HTTP ${status ?? 200}.` : (error ?? "The test delivery failed."),
                    !delivered
                  );
                }
              )
            }
          >
            Send test
          </AsyncButton>
        </div>
      </Card>
    </div>
  );
}
