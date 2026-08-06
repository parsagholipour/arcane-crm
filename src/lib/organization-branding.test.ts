import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeOrganizationLogoUrl,
  resolveOrganizationLogoUrl,
  validateOrganizationLogo
} from "@/lib/organization-branding";

test("organization logos are optional and normalize surrounding whitespace", () => {
  assert.equal(normalizeOrganizationLogoUrl(""), null);
  assert.equal(
    normalizeOrganizationLogoUrl("  https://cdn.example.com/logo.png  "),
    "https://cdn.example.com/logo.png"
  );
});

test("organization logos reject invalid and non-web URLs", () => {
  assert.throws(() => normalizeOrganizationLogoUrl("not a url"), /valid URL/);
  assert.throws(() => normalizeOrganizationLogoUrl("javascript:alert(1)"), /http or https/);
});

test("organization logo uploads verify the image signature and declared type", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.deepEqual(validateOrganizationLogo({ size: png.length, type: "image/png" }, png), {
    contentType: "image/png",
    extension: "png"
  });
  assert.throws(() => validateOrganizationLogo({ size: png.length, type: "image/jpeg" }, png), /does not match/);
  assert.throws(
    () => validateOrganizationLogo({ size: 4, type: "image/svg+xml" }, new Uint8Array([0x3c, 0x73, 0x76, 0x67])),
    /PNG, JPEG, WebP, or GIF/
  );
});

test("stored organization logos resolve to a versioned authenticated route", () => {
  assert.equal(
    resolveOrganizationLogoUrl({
      id: "org/one",
      logoUrl: "https://example.com/old.png",
      logoObjectKey: "organization-logos/org_one/logo.png",
      updatedAt: "2026-08-06T12:00:00.000Z"
    }),
    "/api/organizations/org%2Fone/logo?v=1786017600000"
  );
});
