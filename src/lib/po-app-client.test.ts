import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchPoAppIdentity,
  fetchPoAppProductPage,
  normalizePoAppBaseUrl,
  PoAppError,
  type PoAppRequestOptions
} from "@/lib/po-app-client";

const BASE_URL = "https://po.example.com/api/v1";

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init
  });
}

function product(id: string, updatedAt = "2026-07-30T08:09:10.000Z") {
  return { id, name: `Product ${id}`, sku: `SKU-${id}`, updatedAt };
}

/** Replays a scripted list of responses and records every URL it was asked for. */
function scriptedFetcher(responses: (() => Response)[]) {
  const calls: string[] = [];
  const fetcher = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    const next = responses.shift();
    if (!next) throw new Error("the client made more requests than the test scripted");
    return next();
  }) as unknown as typeof fetch;
  return { fetcher, calls };
}

function options(fetcher: typeof fetch, slept: number[] = []): PoAppRequestOptions {
  return {
    token: "poa_test_token",
    baseUrl: BASE_URL,
    fetcher,
    sleeper: async (milliseconds) => {
      slept.push(milliseconds);
    }
  };
}

test("a base URL is normalized, and a bare host gains the versioned API path", () => {
  assert.equal(normalizePoAppBaseUrl(" https://po.example.com/api/v1/ "), BASE_URL);
  assert.equal(normalizePoAppBaseUrl("https://po.example.com"), BASE_URL);
  assert.equal(normalizePoAppBaseUrl("https://po.example.com/custom/v2"), "https://po.example.com/custom/v2");
  assert.equal(normalizePoAppBaseUrl(""), "");
  assert.throws(() => normalizePoAppBaseUrl("po.example.com"), PoAppError);
  assert.throws(() => normalizePoAppBaseUrl("ftp://po.example.com"), PoAppError);
});

test("a missing token or base URL fails before any request is made", async () => {
  const { fetcher, calls } = scriptedFetcher([]);

  await assert.rejects(
    () => fetchPoAppIdentity({ ...options(fetcher), token: "" }),
    (error: unknown) => error instanceof PoAppError && error.code === "not_configured"
  );
  await assert.rejects(
    () => fetchPoAppIdentity({ ...options(fetcher), baseUrl: "" }),
    (error: unknown) => error instanceof PoAppError && error.code === "not_configured"
  );
  assert.equal(calls.length, 0);
});

test("the identity endpoint reports the store the token can reach", async () => {
  const { fetcher, calls } = scriptedFetcher([
    () =>
      jsonResponse({
        data: {
          tokenId: "8131ea34-c7b0-4b92-aa53-ee0db14b3cf8",
          scopes: ["products:read"],
          store: { id: "4e5db5c0", name: "Arcane Fortress", slug: "arcane-fortress" }
        }
      })
  ]);

  const identity = await fetchPoAppIdentity(options(fetcher));

  assert.equal(calls[0], `${BASE_URL}/me`);
  assert.deepEqual(identity, {
    tokenId: "8131ea34-c7b0-4b92-aa53-ee0db14b3cf8",
    scopes: ["products:read"],
    storeId: "4e5db5c0",
    storeName: "Arcane Fortress",
    storeSlug: "arcane-fortress"
  });
});

test("a rejected token is not retried", async () => {
  const { fetcher, calls } = scriptedFetcher([
    () => jsonResponse({ error: { code: "unauthorized", message: "no" } }, { status: 401 })
  ]);

  await assert.rejects(
    () => fetchPoAppIdentity(options(fetcher)),
    (error: unknown) => error instanceof PoAppError && error.code === "unauthorized" && !error.retryable
  );
  assert.equal(calls.length, 1, "a 401 must not consume another attempt");
});

test("an expired token is distinguished from a rejected one", async () => {
  const { fetcher } = scriptedFetcher([
    () => jsonResponse({ error: { code: "token_expired", message: "expired" } }, { status: 401 })
  ]);

  await assert.rejects(
    () => fetchPoAppIdentity(options(fetcher)),
    (error: unknown) => error instanceof PoAppError && error.code === "token_expired"
  );
});

test("a 404 from /me is reported as a wrong base URL, not a missing record", async () => {
  // A host that is not a PO App answers 404 in plain text for every path, which is exactly what
  // pointing the integration at the wrong hostname looks like.
  const { fetcher, calls } = scriptedFetcher([() => new Response("Not Found", { status: 404 })]);

  await assert.rejects(
    () => fetchPoAppIdentity(options(fetcher)),
    (error: unknown) =>
      error instanceof PoAppError && error.code === "invalid_request" && /base URL/.test(error.message)
  );
  assert.equal(calls.length, 1, "a 404 must not be retried");
});

test("a missing scope is not retried", async () => {
  const { fetcher, calls } = scriptedFetcher([
    () => jsonResponse({ error: { code: "insufficient_scope", message: "nope" } }, { status: 403 })
  ]);

  await assert.rejects(
    () => fetchPoAppProductPage({ page: 1 }, options(fetcher)),
    (error: unknown) => error instanceof PoAppError && error.code === "insufficient_scope"
  );
  assert.equal(calls.length, 1);
});

test("a rate limit waits for Retry-After and then succeeds", async () => {
  const slept: number[] = [];
  const { fetcher, calls } = scriptedFetcher([
    () =>
      jsonResponse(
        { error: { code: "rate_limited", message: "slow down" } },
        { status: 429, headers: { "retry-after": "7" } }
      ),
    () => jsonResponse({ data: [product("a")], pagination: { hasMore: false, total: 1 } })
  ]);

  const page = await fetchPoAppProductPage({ page: 1 }, options(fetcher, slept));

  assert.equal(calls.length, 2);
  assert.deepEqual(slept, [7000], "the Retry-After header must drive the wait");
  assert.equal(page.products.length, 1);
});

test("a server fault is retried with exponential backoff", async () => {
  const slept: number[] = [];
  const { fetcher, calls } = scriptedFetcher([
    () => new Response("upstream exploded", { status: 502 }),
    () => new Response("upstream exploded", { status: 503 }),
    () => jsonResponse({ data: [], pagination: { hasMore: false, total: 0 } })
  ]);

  const page = await fetchPoAppProductPage({ page: 1 }, options(fetcher, slept));

  assert.equal(calls.length, 3);
  assert.deepEqual(slept, [1000, 2000]);
  assert.deepEqual(page.products, []);
});

test("a body that is not JSON is reported rather than crashing", async () => {
  const { fetcher } = scriptedFetcher([() => new Response("<html>oops</html>", { status: 200 })]);

  await assert.rejects(
    () => fetchPoAppProductPage({ page: 1 }, options(fetcher)),
    (error: unknown) => error instanceof PoAppError && error.code === "invalid_response"
  );
});

test("a page requests the maximum size sorted by createdAt, and passes updatedSince through", async () => {
  const { fetcher, calls } = scriptedFetcher([
    () => jsonResponse({ data: [product("a"), product("b")], pagination: { hasMore: true, total: 4 } })
  ]);

  const page = await fetchPoAppProductPage(
    { page: 2, updatedSince: new Date("2026-07-30T08:09:10.000Z") },
    options(fetcher)
  );

  const requested = new URL(calls[0]);
  assert.equal(requested.pathname, "/api/v1/products");
  assert.equal(requested.searchParams.get("sort"), "createdAt");
  assert.equal(requested.searchParams.get("order"), "asc");
  assert.equal(requested.searchParams.get("pageSize"), "200");
  assert.equal(requested.searchParams.get("page"), "2");
  assert.equal(requested.searchParams.get("updatedSince"), "2026-07-30T08:09:10.000Z");
  assert.equal(page.hasMore, true);
  assert.equal(page.total, 4);
  assert.equal(page.products.length, 2);
});

test("a row in an unreadable shape is skipped rather than failing the page", async () => {
  const { fetcher } = scriptedFetcher([
    () => jsonResponse({ data: [product("a"), { name: "no id" }, null], pagination: { hasMore: false } })
  ]);

  const page = await fetchPoAppProductPage({ page: 1 }, options(fetcher));

  assert.equal(page.products.length, 1);
  assert.equal(page.skipped, 2);
  assert.equal(page.hasMore, false);
});

test("a missing pagination block terminates the loop instead of paging forever", async () => {
  const { fetcher } = scriptedFetcher([() => jsonResponse({ data: [product("a")] })]);

  assert.equal((await fetchPoAppProductPage({ page: 1 }, options(fetcher))).hasMore, false);
});
