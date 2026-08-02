import assert from "node:assert/strict";
import test from "node:test";
import {
  clearUspsTokenCache,
  fetchUspsTracking,
  uspsAccessToken,
  UspsError,
  uspsBaseUrl,
  uspsTrackingConfigured
} from "@/lib/usps-client";

type Call = { url: string; init: RequestInit };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** Replays a queue of responses and records what was sent. */
function stubFetch(responses: Array<Response | (() => Response)>) {
  const calls: Call[] = [];
  const fetcher = (async (url: string | URL | Request, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    const next = responses.shift();
    if (!next) throw new Error("Unexpected extra request");
    return typeof next === "function" ? next() : next;
  }) as unknown as typeof fetch;
  return { fetcher, calls };
}

const TOKEN = { access_token: "token-a", expires_in: 28800 };
const TRACKING = {
  trackingNumber: "9400100000000000000000",
  statusCategory: "Delivered",
  statusSummary: "Your item was delivered.",
  trackingEvents: [{ eventType: "Delivered, Front Door/Porch", eventTimestamp: "2026-08-01T14:30:00Z" }]
};

test.beforeEach(() => {
  clearUspsTokenCache();
  process.env.USPS_CONSUMER_KEY = "key";
  process.env.USPS_CONSUMER_SECRET = "secret";
  delete process.env.USPS_API_BASE_URL;
});

test("configuration requires both USPS credentials", () => {
  assert.equal(uspsTrackingConfigured({ USPS_CONSUMER_KEY: "k", USPS_CONSUMER_SECRET: "s" }), true);
  assert.equal(uspsTrackingConfigured({ USPS_CONSUMER_KEY: "k" }), false);
  assert.equal(uspsTrackingConfigured({ USPS_CONSUMER_KEY: "  ", USPS_CONSUMER_SECRET: "s" }), false);
  assert.equal(uspsTrackingConfigured({}), false);
});

test("the base URL defaults to production and honors an override without a trailing slash", () => {
  assert.equal(uspsBaseUrl({}), "https://apis.usps.com");
  assert.equal(uspsBaseUrl({ USPS_API_BASE_URL: "https://apis-tem.usps.com/" }), "https://apis-tem.usps.com");
});

test("the token request sends the client-credentials grant with the tracking scope", async () => {
  const { fetcher, calls } = stubFetch([jsonResponse(TOKEN)]);
  assert.equal(await uspsAccessToken({ fetcher }), "token-a");
  assert.equal(calls[0].url, "https://apis.usps.com/oauth2/v3/token");
  assert.equal(calls[0].init.method, "POST");
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
    client_id: "key",
    client_secret: "secret",
    grant_type: "client_credentials",
    scope: "tracking"
  });
});

test("a cached token is reused until it expires", async () => {
  const start = Date.now();
  const { fetcher, calls } = stubFetch([jsonResponse(TOKEN), jsonResponse({ ...TOKEN, access_token: "token-b" })]);
  assert.equal(await uspsAccessToken({ fetcher, now: start }), "token-a");
  assert.equal(await uspsAccessToken({ fetcher, now: start + 60_000 }), "token-a");
  assert.equal(calls.length, 1, "the second call must not re-authenticate");

  // Past the 8-hour lifetime the cache refreshes.
  assert.equal(await uspsAccessToken({ fetcher, now: start + 9 * 60 * 60 * 1000 }), "token-b");
  assert.equal(calls.length, 2);
});

test("missing credentials fail closed without a network call", async () => {
  delete process.env.USPS_CONSUMER_KEY;
  const { fetcher, calls } = stubFetch([]);
  await assert.rejects(uspsAccessToken({ fetcher }), (error: UspsError) => {
    assert.equal(error.code, "not_configured");
    assert.equal(error.retryable, false);
    return true;
  });
  assert.equal(calls.length, 0);
});

test("tracking sends the bearer token and asks for the detailed timeline", async () => {
  const { fetcher, calls } = stubFetch([jsonResponse(TOKEN), jsonResponse(TRACKING)]);
  const payload = await fetchUspsTracking("9400 1000 0000 0000 0000 00", { fetcher });
  assert.equal(payload.statusCategory, "Delivered");
  assert.equal(calls[1].url, "https://apis.usps.com/tracking/v3/tracking/9400100000000000000000?expand=DETAIL");
  assert.equal((calls[1].init.headers as Record<string, string>).Authorization, "Bearer token-a");
});

test("an unknown tracking number is not retried", async () => {
  const { fetcher, calls } = stubFetch([jsonResponse(TOKEN), jsonResponse({ error: "no record" }, 404)]);
  await assert.rejects(fetchUspsTracking("9400100000000000000000", { fetcher }), (error: UspsError) => {
    assert.equal(error.code, "not_found");
    assert.equal(error.retryable, false);
    return true;
  });
  assert.equal(calls.length, 2);
});

test("a rejected token is retried once with a fresh one", async () => {
  const { fetcher, calls } = stubFetch([
    jsonResponse(TOKEN),
    jsonResponse({ error: "expired" }, 401),
    jsonResponse({ ...TOKEN, access_token: "token-b" }),
    jsonResponse(TRACKING)
  ]);
  const payload = await fetchUspsTracking("9400100000000000000000", { fetcher });
  assert.equal(payload.statusCategory, "Delivered");
  assert.equal(calls.length, 4);
  assert.equal((calls[3].init.headers as Record<string, string>).Authorization, "Bearer token-b");
});

test("a persistent auth failure surfaces as non-retryable", async () => {
  const { fetcher } = stubFetch([
    jsonResponse(TOKEN),
    jsonResponse({}, 403),
    jsonResponse({ ...TOKEN, access_token: "token-b" }),
    jsonResponse({}, 403)
  ]);
  await assert.rejects(fetchUspsTracking("9400100000000000000000", { fetcher }), (error: UspsError) => {
    assert.equal(error.code, "authentication");
    assert.equal(error.retryable, false);
    return true;
  });
});

test("rate limiting and outages are retryable", async () => {
  const { fetcher } = stubFetch([jsonResponse(TOKEN), jsonResponse({}, 429), jsonResponse({}, 429)]);
  await assert.rejects(fetchUspsTracking("9400100000000000000000", { fetcher }), (error: UspsError) => {
    assert.equal(error.code, "rate_limit");
    assert.equal(error.retryable, true);
    return true;
  });

  clearUspsTokenCache();
  const outage = stubFetch([jsonResponse(TOKEN), jsonResponse({}, 503), jsonResponse({}, 503)]);
  await assert.rejects(fetchUspsTracking("9400100000000000000000", { fetcher: outage.fetcher }), (error: UspsError) => {
    assert.equal(error.code, "upstream");
    assert.equal(error.retryable, true);
    return true;
  });
});

test("a response that is not tracking-shaped is rejected rather than mapped", async () => {
  const { fetcher } = stubFetch([
    jsonResponse(TOKEN),
    jsonResponse({ trackingEvents: "not-an-array" }),
    jsonResponse({ trackingEvents: "not-an-array" })
  ]);
  await assert.rejects(fetchUspsTracking("9400100000000000000000", { fetcher }), (error: UspsError) => {
    assert.equal(error.code, "invalid_response");
    return true;
  });
});

test("unknown extra USPS fields pass through instead of failing the poll", async () => {
  const { fetcher } = stubFetch([
    jsonResponse(TOKEN),
    jsonResponse({ statusCategory: "In Transit", mailClass: "PRIORITY_MAIL", somethingNew: { nested: true } })
  ]);
  const payload = await fetchUspsTracking("9400100000000000000000", { fetcher });
  assert.equal(payload.statusCategory, "In Transit");
});

test("a blank tracking number never reaches the network", async () => {
  const { fetcher, calls } = stubFetch([]);
  await assert.rejects(fetchUspsTracking("   ", { fetcher }), (error: UspsError) => {
    assert.equal(error.status, 400);
    return true;
  });
  assert.equal(calls.length, 0);
});

test("an exhausted deadline times out instead of hanging", async () => {
  const { fetcher } = stubFetch([]);
  await assert.rejects(uspsAccessToken({ fetcher, deadline: Date.now() - 1 }), (error: UspsError) => {
    assert.equal(error.code, "timeout");
    assert.equal(error.retryable, true);
    return true;
  });
});
