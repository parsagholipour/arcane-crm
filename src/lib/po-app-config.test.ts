import assert from "node:assert/strict";
import test from "node:test";
import { configuredPoAppSyncCronSecret, validBearerSecret } from "@/lib/cron-auth";
import { poAppConfiguredBaseUrl } from "@/lib/po-app-client";
import { resolvePoAppCredentials } from "@/lib/po-app-integration";
import { encryptSecret } from "@/lib/secret-encryption";

type IntegrationRow = Parameters<typeof resolvePoAppCredentials>[0];

function integration(overrides: Partial<NonNullable<IntegrationRow>> = {}) {
  return {
    baseUrl: "https://po.example.com/api/v1",
    tokenCiphertext: null,
    ...overrides
  } as NonNullable<IntegrationRow>;
}

/** Runs a body with PO_TOKEN set, restoring whatever the environment had before. */
function withEnvironmentToken(value: string, body: () => void) {
  const previous = process.env.PO_TOKEN;
  process.env.PO_TOKEN = value;
  try {
    body();
  } finally {
    if (previous === undefined) delete process.env.PO_TOKEN;
    else process.env.PO_TOKEN = previous;
  }
}

test("the PO App sync cron secret is read and trimmed independently of the other schedulers", () => {
  assert.equal(configuredPoAppSyncCronSecret({ PO_APP_SYNC_CRON_SECRET: "  s3cret  " }), "s3cret");
  assert.equal(configuredPoAppSyncCronSecret({ SHIPMENT_TRACKING_CRON_SECRET: "other" }), "");
  assert.equal(configuredPoAppSyncCronSecret({}), "");
});

test("an unset PO App cron secret never authorizes a dispatch call", () => {
  assert.equal(validBearerSecret("Bearer anything", configuredPoAppSyncCronSecret({})), false);
  assert.equal(
    validBearerSecret("Bearer s3cret", configuredPoAppSyncCronSecret({ PO_APP_SYNC_CRON_SECRET: "s3cret" })),
    true
  );
});

test("the base URL default is trimmed, since only the host has an environment default", () => {
  assert.equal(
    poAppConfiguredBaseUrl({ PO_API_BASE_URL: "  https://po.example.com/api/v1  " }),
    "https://po.example.com/api/v1"
  );
  assert.equal(poAppConfiguredBaseUrl({}), "");
});

test("an organization with no saved token is unconnected even when PO_TOKEN is set", () => {
  withEnvironmentToken("poa_shared_environment_token", () => {
    // A shared environment token would make an unconfigured organization sync another
    // organization's PO App store, so there is deliberately no fallback.
    for (const row of [null, integration(), integration({ tokenCiphertext: "" })]) {
      const credentials = resolvePoAppCredentials(row);
      assert.equal(credentials.token, "", "no organization may inherit a token it did not save");
      assert.equal(credentials.source, "none");
    }
  });
});

test("each organization resolves its own stored token", () => {
  withEnvironmentToken("poa_shared_environment_token", () => {
    const first = resolvePoAppCredentials(integration({ tokenCiphertext: encryptSecret("poa_org_one") }));
    const second = resolvePoAppCredentials(integration({ tokenCiphertext: encryptSecret("poa_org_two") }));

    assert.equal(first.token, "poa_org_one");
    assert.equal(second.token, "poa_org_two");
    assert.equal(first.source, "organization");
  });
});

test("a token that can no longer be decrypted is reported, never replaced by the environment", () => {
  withEnvironmentToken("poa_shared_environment_token", () => {
    const credentials = resolvePoAppCredentials(integration({ tokenCiphertext: "v1.bogus.bogus.bogus" }));

    assert.equal(credentials.token, "");
    assert.equal(credentials.source, "unreadable");
  });
});
