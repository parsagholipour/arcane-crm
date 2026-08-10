import assert from "node:assert/strict";
import test from "node:test";
import {
  LEAD_IDENTITY_ERROR,
  LEAD_IDENTITY_FIELDS,
  leadHasIdentity,
  leadIdentityFieldErrors
} from "@/lib/lead-identity";

test("leadHasIdentity accepts any one of the identity fields", () => {
  assert.equal(leadHasIdentity({}), false);
  assert.equal(leadHasIdentity({ firstName: "  ", lastName: "", company: null, title: "--None--" }), false);
  assert.equal(leadHasIdentity({ firstName: "Ada" }), true);
  assert.equal(leadHasIdentity({ lastName: "Lovelace" }), true);
  assert.equal(leadHasIdentity({ company: "Analytical Engines" }), true);
  assert.equal(leadHasIdentity({ title: "Mathematician" }), true);
});

test("leadIdentityFieldErrors marks all identity fields when none are set", () => {
  const errors = leadIdentityFieldErrors({});
  assert.deepEqual(errors, Object.fromEntries(LEAD_IDENTITY_FIELDS.map((field) => [field, LEAD_IDENTITY_ERROR])));
  assert.deepEqual(leadIdentityFieldErrors({ company: "Acme" }), {});
});
