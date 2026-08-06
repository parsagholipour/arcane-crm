import "server-only";

import { z } from "zod";
import { poAppProductSchema, type PoAppProduct } from "@/lib/po-app-product";

/**
 * HTTP client for the PO App public API (docs/PO-API.md). Every entry point takes an injectable
 * fetcher, sleeper, and deadline so the retry behaviour can be tested without a network or a
 * real wall-clock wait.
 */

const REQUEST_TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 4;
const MAX_RETRY_AFTER_MS = 60_000;
/** One call at pageSize=200 costs the same as one at pageSize=10, so always ask for the max. */
export const PO_APP_PAGE_SIZE = 200;

export type PoAppErrorCode =
  | "not_configured"
  | "invalid_request"
  | "unauthorized"
  | "token_expired"
  | "insufficient_scope"
  | "not_found"
  | "rate_limited"
  | "timeout"
  | "upstream"
  | "invalid_response";

export class PoAppError extends Error {
  constructor(
    message: string,
    readonly code: PoAppErrorCode,
    readonly status: number,
    readonly retryable: boolean
  ) {
    super(message);
    this.name = "PoAppError";
  }
}

/** A token problem an admin has to fix; retrying on the normal cadence only wastes calls. */
export function isPoAppCredentialError(error: unknown) {
  return (
    error instanceof PoAppError &&
    (error.code === "unauthorized" || error.code === "token_expired" || error.code === "insufficient_scope")
  );
}

export type PoAppRequestOptions = {
  token: string;
  baseUrl: string;
  fetcher?: typeof fetch;
  deadline?: number;
  sleeper?: (milliseconds: number) => Promise<void>;
};

const paginationSchema = z
  .object({
    page: z.number().nullish(),
    pageSize: z.number().nullish(),
    total: z.number().nullish(),
    totalPages: z.number().nullish(),
    hasMore: z.boolean().nullish()
  })
  .passthrough();

const identitySchema = z
  .object({
    data: z
      .object({
        tokenId: z.string().nullish(),
        scopes: z.array(z.string()).nullish(),
        store: z
          .object({ id: z.string().nullish(), name: z.string().nullish(), slug: z.string().nullish() })
          .passthrough()
          .nullish()
      })
      .passthrough()
  })
  .passthrough();

const productListSchema = z
  .object({
    data: z.array(z.unknown()),
    pagination: paginationSchema.nullish()
  })
  .passthrough();

export type PoAppIdentity = {
  tokenId: string | null;
  scopes: string[];
  storeId: string | null;
  storeName: string | null;
  storeSlug: string | null;
};

export type PoAppProductPage = {
  products: PoAppProduct[];
  /** Rows that failed to parse. Counted, skipped, and reported rather than failing the page. */
  skipped: number;
  hasMore: boolean;
  total: number | null;
};

export function poAppConfiguredBaseUrl(environment: Partial<NodeJS.ProcessEnv> = process.env) {
  return environment.PO_API_BASE_URL?.trim() ?? "";
}

/**
 * Accepts either the full API base (https://host/api/v1) or just the host, since the docs quote
 * both forms. Trailing slashes are stripped so paths concatenate cleanly.
 */
export function normalizePoAppBaseUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new PoAppError(
      "Enter a full PO App URL, for example https://po.example.com/api/v1.",
      "invalid_request",
      400,
      false
    );
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new PoAppError("The PO App URL must use http or https.", "invalid_request", 400, false);
  }
  const path = url.pathname.replace(/\/+$/, "");
  return `${url.origin}${path || "/api/v1"}`;
}

function errorForStatus(status: number, upstreamCode: string) {
  if (status === 400) return new PoAppError("PO App rejected the request.", "invalid_request", 400, false);
  if (status === 401 && upstreamCode === "token_expired")
    return new PoAppError("The PO App API token has expired.", "token_expired", 401, false);
  if (status === 401) return new PoAppError("PO App rejected the API token.", "unauthorized", 401, false);
  if (status === 403)
    return new PoAppError(
      'The PO App API token is missing the "products:read" scope.',
      "insufficient_scope",
      403,
      false
    );
  if (status === 404) return new PoAppError("PO App has no record of that product.", "not_found", 404, false);
  if (status === 429) return new PoAppError("PO App is receiving too many requests.", "rate_limited", 429, true);
  if (status >= 500) return new PoAppError("PO App is temporarily unavailable.", "upstream", 502, true);
  return new PoAppError("PO App rejected the request.", "upstream", 502, false);
}

function normalizeError(error: unknown) {
  if (error instanceof PoAppError) return error;
  if (error instanceof Error && error.name === "AbortError")
    return new PoAppError("PO App did not respond in time.", "timeout", 504, true);
  return new PoAppError("PO App is temporarily unavailable.", "upstream", 502, true);
}

async function errorForResponse(response: Response) {
  const body = await response.text().catch(() => "");
  let upstreamCode = "";
  try {
    const parsed = JSON.parse(body) as { error?: { code?: unknown } };
    upstreamCode = typeof parsed?.error?.code === "string" ? parsed.error.code : "";
  } catch {
    // 5xx bodies are not guaranteed to be JSON; the status alone is enough to classify.
  }
  return errorForStatus(response.status, upstreamCode);
}

function retryAfterMs(response: Response) {
  const header = Number(response.headers.get("retry-after"));
  const seconds = Number.isFinite(header) && header > 0 ? header : 5;
  return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
}

async function defaultSleeper(milliseconds: number) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function requestWithTimeout(fetcher: typeof fetch, url: string, init: RequestInit, deadline: number) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new PoAppError("PO App did not respond in time.", "timeout", 504, true);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(remaining, REQUEST_TIMEOUT_MS));
  try {
    return await fetcher(url, { ...init, cache: "no-store", signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function poAppFetch(path: string, searchParams: URLSearchParams, options: PoAppRequestOptions): Promise<unknown> {
  const { token, baseUrl, fetcher = fetch, deadline = Date.now() + 60_000, sleeper = defaultSleeper } = options;
  if (!token) throw new PoAppError("The PO App API token is not configured.", "not_configured", 503, false);
  if (!baseUrl) throw new PoAppError("The PO App API base URL is not configured.", "not_configured", 503, false);

  const query = searchParams.toString();
  const url = `${baseUrl}${path}${query ? `?${query}` : ""}`;
  const init: RequestInit = {
    method: "GET",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
  };

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const last = attempt === MAX_ATTEMPTS - 1;
    let response: Response;
    try {
      response = await requestWithTimeout(fetcher, url, init, deadline);
    } catch (error) {
      const failure = normalizeError(error);
      if (last || !failure.retryable) throw failure;
      await sleeper(2 ** attempt * 1000);
      continue;
    }

    if (response.ok) {
      try {
        return await response.json();
      } catch {
        throw new PoAppError("PO App returned a response we could not read.", "invalid_response", 502, false);
      }
    }

    // 400/401/403/404 are final by contract; only 429 and 5xx are worth another attempt.
    const upstream = await errorForResponse(response);
    if (last || !upstream.retryable) throw upstream;
    await sleeper(upstream.code === "rate_limited" ? retryAfterMs(response) : 2 ** attempt * 1000);
  }

  throw new PoAppError("PO App is temporarily unavailable.", "upstream", 502, true);
}

/** Confirms a token is live and reports the store it can reach. Doubles as a health probe. */
export async function fetchPoAppIdentity(options: PoAppRequestOptions): Promise<PoAppIdentity> {
  let payload: unknown;
  try {
    payload = await poAppFetch("/me", new URLSearchParams(), options);
  } catch (error) {
    // /me is published by every PO App deployment, and an unauthenticated call there answers 401,
    // never 404. A 404 therefore means the base URL does not point at a PO App API at all, which
    // is worth saying plainly instead of reporting a missing record.
    if (error instanceof PoAppError && error.code === "not_found") {
      throw new PoAppError(
        "No PO App API answered at that base URL. Confirm the host with your PO App administrator — it is the address where Settings → Developers issued the token.",
        "invalid_request",
        400,
        false
      );
    }
    throw error;
  }

  const parsed = identitySchema.safeParse(payload);
  if (!parsed.success)
    throw new PoAppError("PO App returned an identity response we could not read.", "invalid_response", 502, false);
  const { data } = parsed.data;
  return {
    tokenId: data.tokenId ?? null,
    scopes: data.scopes ?? [],
    storeId: data.store?.id ?? null,
    storeName: data.store?.name ?? null,
    storeSlug: data.store?.slug ?? null
  };
}

/**
 * One page of products, sorted by createdAt ascending — the only field that never changes, so
 * rows cannot shuffle between pages while the importer is paging through.
 */
export async function fetchPoAppProductPage(
  { page, updatedSince }: { page: number; updatedSince?: Date | null },
  options: PoAppRequestOptions
): Promise<PoAppProductPage> {
  const searchParams = new URLSearchParams({
    sort: "createdAt",
    order: "asc",
    pageSize: String(PO_APP_PAGE_SIZE),
    page: String(Math.max(1, Math.trunc(page)))
  });
  if (updatedSince) searchParams.set("updatedSince", updatedSince.toISOString());

  const parsed = productListSchema.safeParse(await poAppFetch("/products", searchParams, options));
  if (!parsed.success)
    throw new PoAppError("PO App returned a product response we could not read.", "invalid_response", 502, false);

  const products: PoAppProduct[] = [];
  let skipped = 0;
  for (const row of parsed.data.data) {
    const product = poAppProductSchema.safeParse(row);
    if (product.success) products.push(product.data);
    else skipped += 1;
  }

  return {
    products,
    skipped,
    hasMore: parsed.data.pagination?.hasMore === true,
    total: parsed.data.pagination?.total ?? null
  };
}
