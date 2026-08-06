"use client";

import { useState, type ReactNode } from "react";
import { AsyncButton } from "@/components/crm/AsyncButton";
import { apiRequest } from "@/lib/api/client";
import type { PoAppIntegrationDto, PoAppSyncSummary } from "@/lib/api/contracts";

type Store = { id: string; name: string; currency: string };
type SyncPayload = { summary: PoAppSyncSummary; integration: PoAppIntegrationDto };
type TestPayload = {
  integration: PoAppIntegrationDto;
  identity: { storeName: string | null; storeSlug: string | null; scopes: string[] };
};

const inputClass =
  "h-9 w-full rounded border border-[#c9c9c9] bg-white px-3 text-sm outline-none focus:border-brand-500 disabled:bg-[#f3f3f3]";
const buttonClass =
  "inline-flex h-9 items-center justify-center gap-2 rounded border border-brand-600 bg-white px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50";
const labelClass = "text-xs font-semibold uppercase tracking-wide text-[#706e6b]";

const SYNC_INTERVALS = [15, 30, 60, 240, 720, 1440];

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

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "Connected"
      ? "bg-[#eaf5ea] text-[#2e844a]"
      : status === "Error"
        ? "bg-[#fff1f1] text-[#8e030f]"
        : "bg-[#f3f3f3] text-[#444]";
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>{status}</span>;
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className={labelClass}>{label}</div>
      <div className="mt-0.5 text-sm">{value}</div>
    </div>
  );
}

function timestamp(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Never";
}

function describeSync(summary: PoAppSyncSummary) {
  if (summary.organizations === 0) return "Nothing to sync — the integration is disabled or already up to date.";
  if (summary.failed) return "The sync failed. See the status below for the reason.";
  const parts = [`${summary.created} added`, `${summary.updated} updated`];
  if (summary.deactivated) parts.push(`${summary.deactivated} deactivated`);
  if (summary.unreadable) parts.push(`${summary.unreadable} unreadable`);
  return `Sync complete: ${parts.join(", ")}.`;
}

export function PoAppIntegrationClient({
  initialSettings,
  stores,
  webhookUrl
}: {
  initialSettings: PoAppIntegrationDto;
  stores: Store[];
  webhookUrl: string;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [baseUrl, setBaseUrl] = useState(initialSettings.baseUrl);
  const [token, setToken] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [enabled, setEnabled] = useState(initialSettings.enabled);
  const [storeId, setStoreId] = useState(initialSettings.storeId ?? "");
  const [syncIntervalMinutes, setSyncIntervalMinutes] = useState(initialSettings.syncIntervalMinutes);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  function report(text: string, isFailure = false) {
    setMessage(text);
    setFailed(isFailure);
  }

  async function run<T>(action: () => Promise<T>, onSuccess: (payload: T) => void) {
    setMessage(null);
    try {
      onSuccess(await action());
    } catch (error) {
      report(error instanceof Error ? error.message : "The operation could not be completed.", true);
    }
  }

  async function save(body: Record<string, unknown>, successMessage: string) {
    await run(
      () => apiRequest<PoAppIntegrationDto>("/api/integrations/po-app", { method: "PUT", body: JSON.stringify(body) }),
      (next) => {
        setSettings(next);
        setBaseUrl(next.baseUrl);
        setEnabled(next.enabled);
        setStoreId(next.storeId ?? "");
        setSyncIntervalMinutes(next.syncIntervalMinutes);
        report(successMessage);
      }
    );
  }

  async function testConnection() {
    await run(
      () => apiRequest<TestPayload>("/api/integrations/po-app/test", { method: "POST" }),
      ({ integration, identity }) => {
        setSettings(integration);
        report(
          `Connected to ${identity.storeName ?? "the PO App store"}${
            identity.scopes.length ? ` with ${identity.scopes.join(", ")}` : ""
          }.`
        );
      }
    );
  }

  async function sync(mode: "incremental" | "full") {
    await run(
      () =>
        apiRequest<SyncPayload>("/api/integrations/po-app/sync", {
          method: "POST",
          body: JSON.stringify({ mode, force: true })
        }),
      ({ summary, integration }) => {
        setSettings(integration);
        report(describeSync(summary), summary.failed > 0);
      }
    );
  }

  const tokenPlaceholder = settings.hasToken ? (settings.tokenPreview ?? "A token is saved") : "poa_…";
  const canSync = settings.enabled && settings.hasToken;
  const syncDisabledReason = !settings.hasToken
    ? settings.enabled
      ? "Sync actions are disabled because no API token is saved. Save an API token to use manual sync."
      : "Sync actions are disabled because no API token is saved and “Enable scheduled sync” is turned off. Save a token, then enable scheduled sync and save the sync settings."
    : "Sync actions are disabled because “Enable scheduled sync” is turned off. Turn it on and save the sync settings to use manual sync.";

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
          Set INTEGRATION_ENCRYPTION_KEY (or AUTH_SECRET) before saving a token — secrets are encrypted at rest.
        </div>
      )}
      {settings.tokenSource === "unreadable" && (
        <div role="alert" className="rounded border border-[#ea001e] bg-[#fff1f1] p-3 text-sm text-[#8e030f]">
          The saved token could not be decrypted, which usually means INTEGRATION_ENCRYPTION_KEY changed. Enter the
          token again to reconnect.
        </div>
      )}

      <Card
        title="Connection"
        description="The API token is issued in PO App under Settings → Developers and needs the products:read scope."
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="API base URL" hint="For example https://po.example.com/api/v1">
            <input
              className={inputClass}
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://po.example.com/api/v1"
            />
          </Field>
          <Field
            label="API token"
            hint={
              settings.hasToken
                ? "Stored encrypted for this organization. Leave blank to keep the saved token."
                : "This organization has no token yet. Each organization connects with its own."
            }
          >
            <input
              className={inputClass}
              type="password"
              autoComplete="off"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder={tokenPlaceholder}
            />
          </Field>
        </div>
        <div className="mt-3 flex gap-2">
          <AsyncButton
            className={buttonClass}
            onClick={() => save({ baseUrl, ...(token ? { token } : {}) }, "Connection saved.").then(() => setToken(""))}
          >
            Save connection
          </AsyncButton>
          <AsyncButton className={buttonClass} disabled={!settings.hasToken} onClick={testConnection}>
            Test connection
          </AsyncButton>
        </div>
      </Card>

      <Card
        title="Sync schedule"
        description="Products, prices, and stock counts are pulled on this interval. Stock is only written when a store is selected."
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Sync interval">
            <select
              className={inputClass}
              value={syncIntervalMinutes}
              onChange={(event) => setSyncIntervalMinutes(Number(event.target.value))}
            >
              {SYNC_INTERVALS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes < 60 ? `Every ${minutes} minutes` : `Every ${minutes / 60} hours`}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Inventory store" hint="Stock counts are written to this store's inventory.">
            <select className={inputClass} value={storeId} onChange={(event) => setStoreId(event.target.value)}>
              <option value="">Do not sync inventory</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name} ({store.currency})
                </option>
              ))}
            </select>
          </Field>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 shrink-0 rounded border border-[#c9c9c9] accent-brand-600"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          />
          Enable scheduled sync
        </label>
        <div className="mt-3">
          <AsyncButton
            className={buttonClass}
            onClick={() => save({ enabled, storeId: storeId || null, syncIntervalMinutes }, "Sync settings saved.")}
          >
            Save sync settings
          </AsyncButton>
        </div>
      </Card>

      <Card
        title="Webhooks"
        description="Register this URL in PO App under Settings → Developers → Webhook endpoints to receive product changes as they happen."
      >
        <Field label="Endpoint URL">
          <input className={inputClass} readOnly value={webhookUrl} />
        </Field>
        <div className="mt-3">
          <Field
            label="Signing secret"
            hint={
              settings.hasWebhookSecret
                ? "A secret is saved. Enter a new one to rotate it, or save it empty to stop accepting webhooks."
                : "PO App shows the whsec_… secret once, when the endpoint is created."
            }
          >
            <input
              className={inputClass}
              type="password"
              autoComplete="off"
              value={webhookSecret}
              onChange={(event) => setWebhookSecret(event.target.value)}
              placeholder={settings.hasWebhookSecret ? "A secret is saved" : "whsec_…"}
            />
          </Field>
        </div>
        <div className="mt-3">
          <AsyncButton
            className={buttonClass}
            onClick={() => save({ webhookSecret }, "Webhook secret saved.").then(() => setWebhookSecret(""))}
          >
            Save webhook secret
          </AsyncButton>
        </div>
      </Card>

      <Card title="Status" description="Deletions in PO App are only detected by a full resync or a webhook.">
        <div className="grid gap-3 md:grid-cols-3">
          <Detail label="Connection" value={<StatusBadge status={settings.status} />} />
          <Detail label="PO App store" value={settings.poStoreName ?? "Not verified"} />
          <Detail label="Products in last sync" value={settings.productsSynced} />
          <Detail label="Last sync" value={timestamp(settings.lastSyncedAt)} />
          <Detail label="Last full resync" value={timestamp(settings.lastFullSyncAt)} />
          <Detail label="Next scheduled sync" value={settings.enabled ? timestamp(settings.nextSyncAt) : "Disabled"} />
        </div>
        {settings.lastError && (
          <p role="alert" className="mt-3 rounded border border-[#ea001e] bg-[#fff1f1] p-2 text-sm text-[#8e030f]">
            {settings.lastError}
          </p>
        )}
        <aside className="mt-3 rounded border border-[#9ac3e8] bg-[#eef4ff] p-3 text-sm text-[#181818]">
          <p className="font-semibold">What does Full resync do?</p>
          <p className="mt-1 text-[#444]">
            It checks the complete PO App catalogue instead of only products changed since the last sync. It adds or
            updates products in the CRM and deactivates products that are no longer in PO App; it does not delete CRM
            products.
          </p>
        </aside>
        {!canSync && <p className="mt-3 text-sm text-[#706e6b]">{syncDisabledReason}</p>}
        <div className="mt-3 flex gap-2">
          <AsyncButton className={buttonClass} disabled={!canSync} onClick={() => sync("incremental")}>
            Sync now
          </AsyncButton>
          <AsyncButton className={buttonClass} disabled={!canSync} onClick={() => sync("full")}>
            Full resync
          </AsyncButton>
        </div>
      </Card>
    </div>
  );
}
