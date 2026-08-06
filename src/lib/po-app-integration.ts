import "server-only";

import type { PoAppIntegration } from "@prisma/client";
import type { PoAppIntegrationDto } from "@/lib/api/contracts";
import { fetchPoAppIdentity, normalizePoAppBaseUrl, poAppConfiguredBaseUrl, PoAppError } from "@/lib/po-app-client";
import { normalizeSyncIntervalMinutes } from "@/lib/po-app-product";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret, maskSecret, secretEncryptionConfigured } from "@/lib/secret-encryption";

/**
 * Settings service for the PO App connection. The API token never leaves this module in
 * readable form — routes and the browser only ever see the masked preview.
 */

export type PoAppTokenSource = "organization" | "unreadable" | "none";

export type PoAppCredentials = {
  token: string;
  baseUrl: string;
  source: PoAppTokenSource;
};

export type PoAppIntegrationInput = {
  baseUrl?: string;
  /** Undefined leaves the stored token alone; an empty string clears it. */
  token?: string;
  webhookSecret?: string;
  enabled?: boolean;
  storeId?: string | null;
  syncIntervalMinutes?: number;
};

function isoOrNull(value: Date | null) {
  return value ? value.toISOString() : null;
}

export function loadPoAppIntegration(organizationId: string) {
  return prisma.poAppIntegration.findUnique({ where: { organizationId } });
}

/**
 * The token is always the organization's own. There is deliberately no environment fallback: a
 * shared token would make an organization that has not been configured yet silently sync a
 * different organization's PO App store. An org with no saved token is simply not connected.
 */
export function resolvePoAppCredentials(integration: PoAppIntegration | null): PoAppCredentials {
  // Only the base URL has an environment default — it is a host, not a credential.
  const baseUrl = integration?.baseUrl?.trim() || poAppConfiguredBaseUrl();
  if (!integration?.tokenCiphertext) return { token: "", baseUrl, source: "none" };
  const token = decryptSecret(integration.tokenCiphertext);
  // A rotated INTEGRATION_ENCRYPTION_KEY makes stored ciphertext unreadable; that is surfaced as
  // its own state rather than being reported as "no token".
  return token ? { token, baseUrl, source: "organization" } : { token: "", baseUrl, source: "unreadable" };
}

export function poAppWebhookSecret(integration: PoAppIntegration | null) {
  return integration?.webhookSecretCipher ? decryptSecret(integration.webhookSecretCipher) : null;
}

export function poAppIntegrationDto(integration: PoAppIntegration | null): PoAppIntegrationDto {
  const credentials = resolvePoAppCredentials(integration);
  return {
    baseUrl: credentials.baseUrl,
    enabled: integration?.enabled ?? false,
    hasToken: Boolean(credentials.token),
    tokenPreview: integration?.tokenPreview ?? null,
    tokenSource: credentials.source,
    hasWebhookSecret: Boolean(integration?.webhookSecretCipher),
    storeId: integration?.storeId ?? null,
    syncIntervalMinutes: integration?.syncIntervalMinutes ?? 60,
    poStoreId: integration?.poStoreId ?? null,
    poStoreName: integration?.poStoreName ?? null,
    poTokenId: integration?.poTokenId ?? null,
    scopes: integration?.scopes ? integration.scopes.split(",").filter(Boolean) : [],
    status: integration?.status ?? "Disconnected",
    lastError: integration?.lastError ?? null,
    lastSyncedAt: isoOrNull(integration?.lastSyncedAt ?? null),
    lastFullSyncAt: isoOrNull(integration?.lastFullSyncAt ?? null),
    nextSyncAt: isoOrNull(integration?.nextSyncAt ?? null),
    failureCount: integration?.failureCount ?? 0,
    productsSynced: integration?.productsSynced ?? 0,
    encryptionConfigured: secretEncryptionConfigured()
  };
}

async function assertStoreBelongsToOrganization(organizationId: string, storeId: string) {
  const store = await prisma.marketingStore.findFirst({ where: { id: storeId, organizationId }, select: { id: true } });
  if (!store) throw new PoAppError("Select a store in this organization.", "invalid_request", 400, false);
}

export async function savePoAppIntegration(organizationId: string, input: PoAppIntegrationInput) {
  const existing = await loadPoAppIntegration(organizationId);

  const baseUrl =
    input.baseUrl === undefined
      ? (existing?.baseUrl ?? normalizeOptionalBaseUrl(poAppConfiguredBaseUrl()))
      : normalizePoAppBaseUrl(input.baseUrl);

  if (input.storeId) await assertStoreBelongsToOrganization(organizationId, input.storeId);

  const tokenUpdate = tokenUpdateFor(input.token);
  const webhookUpdate = webhookSecretUpdateFor(input.webhookSecret);

  const shared = {
    baseUrl,
    ...tokenUpdate,
    ...webhookUpdate,
    ...(input.enabled === undefined ? {} : { enabled: input.enabled }),
    ...(input.storeId === undefined ? {} : { storeId: input.storeId || null }),
    ...(input.syncIntervalMinutes === undefined
      ? {}
      : { syncIntervalMinutes: normalizeSyncIntervalMinutes(input.syncIntervalMinutes) })
  };

  const integration = await prisma.poAppIntegration.upsert({
    where: { organizationId },
    update: shared,
    create: { organizationId, ...shared }
  });

  if (integration.enabled) {
    const credentials = resolvePoAppCredentials(integration);
    if (!credentials.token || !credentials.baseUrl) {
      throw new PoAppError(
        "Add the PO App API token and base URL before enabling the sync.",
        "not_configured",
        400,
        false
      );
    }
    // Enabling, changing the token, or changing the schedule should take effect now rather than
    // at the end of whatever interval was already pending.
    if (!existing?.enabled || input.token !== undefined || input.syncIntervalMinutes !== undefined) {
      return prisma.poAppIntegration.update({
        where: { organizationId },
        data: { nextSyncAt: null, failureCount: 0, lastError: null }
      });
    }
  }

  return integration;
}

function normalizeOptionalBaseUrl(value: string) {
  return value ? normalizePoAppBaseUrl(value) : "";
}

function assertEncryptionConfigured() {
  if (secretEncryptionConfigured()) return;
  throw new PoAppError(
    "Set INTEGRATION_ENCRYPTION_KEY (or AUTH_SECRET) before saving integration secrets.",
    "not_configured",
    503,
    false
  );
}

/** Undefined leaves the stored secret untouched; an empty string clears it. */
function tokenUpdateFor(value: string | undefined): { tokenCiphertext?: string | null; tokenPreview?: string | null } {
  if (value === undefined) return {};
  const trimmed = value.trim();
  if (!trimmed) return { tokenCiphertext: null, tokenPreview: null };
  assertEncryptionConfigured();
  return { tokenCiphertext: encryptSecret(trimmed), tokenPreview: maskSecret(trimmed) };
}

function webhookSecretUpdateFor(value: string | undefined): { webhookSecretCipher?: string | null } {
  if (value === undefined) return {};
  const trimmed = value.trim();
  if (!trimmed) return { webhookSecretCipher: null };
  assertEncryptionConfigured();
  return { webhookSecretCipher: encryptSecret(trimmed) };
}

/** Calls GET /me and records what the token can reach, so the UI can confirm the connection. */
export async function testPoAppConnection(organizationId: string, fetcher?: typeof fetch) {
  const integration = await loadPoAppIntegration(organizationId);
  const credentials = resolvePoAppCredentials(integration);
  if (!credentials.token || !credentials.baseUrl) {
    throw new PoAppError("Add the PO App API token and base URL first.", "not_configured", 400, false);
  }

  try {
    const identity = await fetchPoAppIdentity({
      token: credentials.token,
      baseUrl: credentials.baseUrl,
      ...(fetcher ? { fetcher } : {})
    });
    const saved = await prisma.poAppIntegration.upsert({
      where: { organizationId },
      update: {
        poStoreId: identity.storeId,
        poStoreName: identity.storeName,
        poTokenId: identity.tokenId,
        scopes: identity.scopes.join(","),
        status: "Connected",
        lastError: null,
        failureCount: 0
      },
      create: {
        organizationId,
        baseUrl: credentials.baseUrl,
        poStoreId: identity.storeId,
        poStoreName: identity.storeName,
        poTokenId: identity.tokenId,
        scopes: identity.scopes.join(","),
        status: "Connected"
      }
    });
    return { integration: saved, identity };
  } catch (error) {
    const message = poAppFailureReason(error);
    await prisma.poAppIntegration.updateMany({
      where: { organizationId },
      data: { status: "Error", lastError: message }
    });
    throw error;
  }
}

/** Maps a client error to a message safe to show an admin; upstream bodies are never echoed. */
export function poAppFailureReason(error: unknown) {
  if (error instanceof PoAppError) {
    switch (error.code) {
      case "not_configured":
        return "The PO App connection is not configured.";
      case "unauthorized":
        return "PO App rejected the API token. Issue a new token and reconnect.";
      case "token_expired":
        return "The PO App API token has expired. Issue a new token and reconnect.";
      case "insufficient_scope":
        return 'The PO App API token is missing the "products:read" scope.';
      case "not_found":
        return "PO App could not find the requested record.";
      case "rate_limited":
        return "PO App is receiving too many requests.";
      case "timeout":
        return "PO App did not respond in time.";
      case "invalid_request":
        return error.message;
      case "invalid_response":
        return "PO App returned a response we could not read.";
      default:
        return "PO App is temporarily unavailable.";
    }
  }
  return "The PO App catalogue could not be synced.";
}
