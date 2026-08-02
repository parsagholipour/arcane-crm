import "server-only";

import { z } from "zod";
import { normalizeTrackingNumber, type UspsTrackingResponse } from "@/lib/usps-status";

const DEFAULT_BASE_URL = "https://apis.usps.com";
const TRACKING_SCOPE = "tracking";
/** Refresh a little early so a long batch never runs off the end of the token. */
const TOKEN_SKEW_SECONDS = 60;
const REQUEST_TIMEOUT_MS = 20_000;

const tokenSchema = z
  .object({
    access_token: z.string().min(1),
    expires_in: z.union([z.number(), z.string()]).optional()
  })
  .passthrough();

/**
 * Deliberately permissive: USPS returns verbatim status phrases and varies which fields
 * are present per mail class, so an unexpected shape must not fail the whole poll.
 */
const trackingSchema = z
  .object({
    trackingNumber: z.string().nullish(),
    statusCategory: z.string().nullish(),
    statusSummary: z.string().nullish(),
    expectedDeliveryTimeStamp: z.string().nullish(),
    trackingEvents: z
      .array(
        z
          .object({
            eventType: z.string().nullish(),
            eventTimestamp: z.string().nullish(),
            eventCity: z.string().nullish(),
            eventState: z.string().nullish(),
            eventZIP: z.string().nullish()
          })
          .passthrough()
      )
      .nullish()
  })
  .passthrough();

export type UspsErrorCode =
  "not_configured" | "authentication" | "not_found" | "rate_limit" | "timeout" | "upstream" | "invalid_response";

export class UspsError extends Error {
  constructor(
    message: string,
    readonly code: UspsErrorCode,
    readonly status: number,
    readonly retryable: boolean
  ) {
    super(message);
    this.name = "UspsError";
  }
}

type CachedToken = { value: string; expiresAt: number };

// Pinned on globalThis so a dev HMR reload and repeated route invocations reuse the token
// instead of re-authenticating once per tracking number.
const tokenStore = globalThis as typeof globalThis & { __uspsToken?: CachedToken | null };

export function uspsBaseUrl(environment: Partial<NodeJS.ProcessEnv> = process.env) {
  return (environment.USPS_API_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

export function uspsTrackingConfigured(environment: Partial<NodeJS.ProcessEnv> = process.env) {
  return Boolean(environment.USPS_CONSUMER_KEY?.trim() && environment.USPS_CONSUMER_SECRET?.trim());
}

export function clearUspsTokenCache() {
  tokenStore.__uspsToken = null;
}

function errorForStatus(status: number, context: string) {
  if (status === 401 || status === 403)
    return new UspsError(`USPS rejected the ${context} credentials.`, "authentication", 503, false);
  if (status === 404) return new UspsError("USPS has no record of that tracking number.", "not_found", 404, false);
  if (status === 429) return new UspsError("USPS is receiving too many requests.", "rate_limit", 429, true);
  if (status >= 500) return new UspsError("USPS is temporarily unavailable.", "upstream", 502, true);
  return new UspsError(`USPS rejected the ${context} request.`, "upstream", 502, false);
}

function normalizeError(error: unknown) {
  if (error instanceof UspsError) return error;
  if (error instanceof Error && error.name === "AbortError")
    return new UspsError("USPS took too long to respond.", "timeout", 504, true);
  return new UspsError("USPS is temporarily unavailable.", "upstream", 502, true);
}

async function requestWithTimeout(fetcher: typeof fetch, url: string, init: RequestInit, deadline: number) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new UspsError("USPS took too long to respond.", "timeout", 504, true);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(remaining, REQUEST_TIMEOUT_MS));
  try {
    return await fetcher(url, { ...init, cache: "no-store", signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function uspsAccessToken({
  fetcher = fetch,
  deadline = Date.now() + 30_000,
  now = Date.now()
}: { fetcher?: typeof fetch; deadline?: number; now?: number } = {}): Promise<string> {
  const cached = tokenStore.__uspsToken;
  if (cached && cached.expiresAt > now) return cached.value;

  const clientId = process.env.USPS_CONSUMER_KEY?.trim();
  const clientSecret = process.env.USPS_CONSUMER_SECRET?.trim();
  if (!clientId || !clientSecret) throw new UspsError("USPS tracking is not configured.", "not_configured", 503, false);

  try {
    const response = await requestWithTimeout(
      fetcher,
      `${uspsBaseUrl()}/oauth2/v3/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "client_credentials",
          scope: TRACKING_SCOPE
        })
      },
      deadline
    );
    if (!response.ok) {
      clearUspsTokenCache();
      throw errorForStatus(response.status, "token");
    }
    const parsed = tokenSchema.safeParse(await response.json());
    if (!parsed.success) throw new UspsError("USPS returned an invalid token.", "invalid_response", 502, true);
    const lifetime = Number(parsed.data.expires_in ?? 0);
    const seconds = Number.isFinite(lifetime) && lifetime > 0 ? lifetime : 8 * 60 * 60;
    tokenStore.__uspsToken = {
      value: parsed.data.access_token,
      expiresAt: now + Math.max(seconds - TOKEN_SKEW_SECONDS, 30) * 1000
    };
    return parsed.data.access_token;
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function fetchUspsTracking(
  trackingNumber: string,
  {
    fetcher = fetch,
    deadline = Date.now() + 30_000,
    now = Date.now()
  }: { fetcher?: typeof fetch; deadline?: number; now?: number } = {}
): Promise<UspsTrackingResponse> {
  const normalized = normalizeTrackingNumber(trackingNumber);
  if (!normalized) throw new UspsError("A tracking number is required.", "not_found", 400, false);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const token = await uspsAccessToken({ fetcher, deadline, now });
    try {
      const response = await requestWithTimeout(
        fetcher,
        `${uspsBaseUrl()}/tracking/v3/tracking/${encodeURIComponent(normalized)}?expand=DETAIL`,
        { method: "GET", headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } },
        deadline
      );
      if (!response.ok) {
        const upstream = errorForStatus(response.status, "tracking");
        // A rejected token is worth one retry with a fresh one; anything else is final.
        if (upstream.code === "authentication") clearUspsTokenCache();
        if (attempt === 1 || !(upstream.retryable || upstream.code === "authentication")) throw upstream;
        continue;
      }
      const parsed = trackingSchema.safeParse(await response.json());
      if (!parsed.success)
        throw new UspsError("USPS returned an invalid tracking response.", "invalid_response", 502, true);
      return parsed.data;
    } catch (error) {
      const normalizedError = normalizeError(error);
      if (attempt === 1 || !normalizedError.retryable) throw normalizedError;
    }
  }

  throw new UspsError("USPS is temporarily unavailable.", "upstream", 502, true);
}
