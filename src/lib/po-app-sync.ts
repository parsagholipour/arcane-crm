import "server-only";

import type { PoAppIntegration } from "@prisma/client";
import type { PoAppSyncSummary } from "@/lib/api/contracts";
import { fetchPoAppProductPage, isPoAppCredentialError, PoAppError } from "@/lib/po-app-client";
import { poAppFailureReason, resolvePoAppCredentials } from "@/lib/po-app-integration";
import { poAppRetryDelayMinutes } from "@/lib/po-app-product";
import {
  deactivateStalePoAppProducts,
  ensureStandardPriceBook,
  upsertPoAppProduct,
  type PoAppWriteTarget
} from "@/lib/po-app-upsert";
import { prisma } from "@/lib/prisma";

/**
 * Pulls the PO App catalogue into the CRM. Called both by the scheduled dispatch route (all
 * organizations) and by the in-app sync button (one organization, forced).
 */

const DEFAULT_BATCH_LIMIT = 25;
const MAX_BATCH_LIMIT = 100;
/** How long a claimed integration stays off the due list, so a crashed run self-heals. */
const SYNC_LEASE_MINUTES = 15;
/** Re-fetch the last minute on each incremental run to absorb clock skew. */
const OVERLAP_MS = 60_000;
const PAGE_DEADLINE_MS = 60_000;
const MAX_PAGES = 500;

export type PoAppSyncMode = "incremental" | "full";

export type { PoAppSyncSummary };

export type PoAppSyncOptions = {
  now?: Date;
  organizationId?: string;
  mode?: PoAppSyncMode;
  /** Ignore the schedule. Used by the manual "Sync now" button; still takes the lease. */
  force?: boolean;
  limit?: number;
  fetcher?: typeof fetch;
};

function emptySummary(): PoAppSyncSummary {
  return { organizations: 0, created: 0, updated: 0, skipped: 0, deactivated: 0, unreadable: 0, failed: 0 };
}

function minutesFrom(now: Date, minutes: number) {
  return new Date(now.getTime() + minutes * 60 * 1000);
}

function dueIntegrations(now: Date, organizationId: string | undefined, force: boolean, limit: number) {
  const leaseCutoff = new Date(now.getTime() - SYNC_LEASE_MINUTES * 60 * 1000);
  return prisma.poAppIntegration.findMany({
    where: {
      enabled: true,
      ...(organizationId ? { organizationId } : {}),
      AND: [
        { OR: [{ syncingSince: null }, { syncingSince: { lt: leaseCutoff } }] },
        ...(force ? [] : [{ OR: [{ nextSyncAt: null }, { nextSyncAt: { lte: now } }] }])
      ]
    },
    orderBy: [{ nextSyncAt: { sort: "asc", nulls: "first" } }],
    take: limit,
    select: { organizationId: true }
  });
}

/**
 * Take exclusive ownership by stamping syncingSince, which is cleared the moment the run ends.
 * The compare-and-set doubles as the claim, so the scheduler and a manual sync can never run the
 * same organization at once, while back-to-back manual syncs are still allowed. A crashed run
 * self-heals once its stamp passes the lease horizon.
 */
async function claimIntegration(organizationId: string, now: Date, force: boolean) {
  const leaseCutoff = new Date(now.getTime() - SYNC_LEASE_MINUTES * 60 * 1000);
  const claimed = await prisma.poAppIntegration.updateMany({
    where: {
      organizationId,
      enabled: true,
      AND: [
        { OR: [{ syncingSince: null }, { syncingSince: { lt: leaseCutoff } }] },
        // Forcing skips the schedule but never the lease.
        ...(force ? [] : [{ OR: [{ nextSyncAt: null }, { nextSyncAt: { lte: now } }] }])
      ]
    },
    data: { syncingSince: now }
  });
  if (!claimed.count) return null;
  return prisma.poAppIntegration.findUnique({ where: { organizationId } });
}

async function resolveWriteTarget(integration: PoAppIntegration): Promise<PoAppWriteTarget> {
  const store = integration.storeId
    ? await prisma.marketingStore.findFirst({
        where: { id: integration.storeId, organizationId: integration.organizationId },
        select: { id: true, currency: true }
      })
    : null;
  return {
    organizationId: integration.organizationId,
    priceBookId: await ensureStandardPriceBook(integration.organizationId),
    storeId: store?.id ?? null,
    // The API returns no currency code, so the store's own currency is the best available answer.
    currency: store?.currency?.trim() || "USD"
  };
}

async function recordSuccess(
  integration: PoAppIntegration,
  mode: PoAppSyncMode,
  runStartedAt: Date,
  processed: number
) {
  await prisma.poAppIntegration.update({
    where: { organizationId: integration.organizationId },
    data: {
      status: "Connected",
      lastError: null,
      failureCount: 0,
      // Recorded from before the run so changes made while it was running are picked up next time.
      lastSyncedAt: runStartedAt,
      ...(mode === "full" ? { lastFullSyncAt: runStartedAt } : {}),
      nextSyncAt: minutesFrom(runStartedAt, integration.syncIntervalMinutes),
      productsSynced: processed,
      syncingSince: null
    }
  });
}

async function recordFailure(integration: PoAppIntegration, error: unknown, now: Date) {
  const failureCount = integration.failureCount + 1;
  await prisma.poAppIntegration.update({
    where: { organizationId: integration.organizationId },
    data: {
      status: "Error",
      lastError: poAppFailureReason(error),
      failureCount,
      nextSyncAt: minutesFrom(now, poAppRetryDelayMinutes(failureCount, isPoAppCredentialError(error))),
      syncingSince: null
    }
  });
}

async function syncIntegration(
  integration: PoAppIntegration,
  mode: PoAppSyncMode,
  runStartedAt: Date,
  summary: PoAppSyncSummary,
  fetcher?: typeof fetch
) {
  const credentials = resolvePoAppCredentials(integration);
  if (credentials.source === "unreadable") {
    throw new PoAppError(
      "The stored PO App token could not be decrypted. Re-enter it in Setup.",
      "unauthorized",
      400,
      false
    );
  }
  if (!credentials.token || !credentials.baseUrl) {
    throw new PoAppError("The PO App connection is not configured.", "not_configured", 400, false);
  }

  // Without a watermark there is nothing to be incremental about, so a first run is always full.
  const effectiveMode: PoAppSyncMode = mode === "full" || !integration.lastSyncedAt ? "full" : "incremental";
  const updatedSince =
    effectiveMode === "full" || !integration.lastSyncedAt
      ? null
      : new Date(integration.lastSyncedAt.getTime() - OVERLAP_MS);

  const target = await resolveWriteTarget(integration);
  const syncedAt = new Date();
  let page = 1;
  let processed = 0;
  let completed = false;

  while (page <= MAX_PAGES) {
    const result = await fetchPoAppProductPage(
      { page, updatedSince },
      {
        token: credentials.token,
        baseUrl: credentials.baseUrl,
        deadline: Date.now() + PAGE_DEADLINE_MS,
        ...(fetcher ? { fetcher } : {})
      }
    );
    summary.unreadable += result.skipped;

    for (const product of result.products) {
      const outcome = await upsertPoAppProduct(product, target, syncedAt);
      if (outcome === "created") summary.created += 1;
      else if (outcome === "updated") summary.updated += 1;
      else summary.skipped += 1;
      processed += 1;
    }

    if (!result.hasMore) {
      completed = true;
      break;
    }
    page += 1;
  }

  if (!completed) {
    throw new PoAppError(`The PO App catalogue did not finish within ${MAX_PAGES} pages.`, "upstream", 502, false);
  }

  // Deletions never appear in the API — a deleted product simply stops being returned. They are
  // only reconciled after a full pass that completed; doing it after a partial page-through
  // would deactivate the entire catalogue on one transient error.
  if (effectiveMode === "full") {
    summary.deactivated += await deactivateStalePoAppProducts(integration.organizationId, syncedAt, new Date());
  }

  await recordSuccess(integration, effectiveMode, runStartedAt, processed);
}

/**
 * Sync every PO App integration that is due. Unconfigured or disabled organizations are a silent
 * no-op, matching how the other scheduled jobs behave.
 */
export async function runDuePoAppSyncs(options: PoAppSyncOptions = {}): Promise<PoAppSyncSummary> {
  const now = options.now ?? new Date();
  const mode = options.mode ?? "incremental";
  const force = options.force === true;
  const limit = Math.max(1, Math.min(options.limit ?? DEFAULT_BATCH_LIMIT, MAX_BATCH_LIMIT));
  const summary = emptySummary();

  for (const candidate of await dueIntegrations(now, options.organizationId, force, limit)) {
    const integration = await claimIntegration(candidate.organizationId, now, force);
    if (!integration) continue;
    summary.organizations += 1;
    try {
      await syncIntegration(integration, mode, now, summary, options.fetcher);
    } catch (error) {
      summary.failed += 1;
      await recordFailure(integration, error, now);
      console.error("[po-app] catalogue sync failed", integration.organizationId, error);
    }
  }

  return summary;
}
