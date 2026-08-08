import test from "node:test";
import assert from "node:assert/strict";
import { accountDtoSchema, leadDtoSchema, listQuerySchema, opportunityDtoSchema } from "./contracts";

test("listQuerySchema supplies bounded defaults and validates direction", () => {
  assert.deepEqual(listQuerySchema.parse({}), {
    limit: 50,
    search: "",
    country: "",
    state: "",
    view: "",
    sort: "",
    direction: "asc"
  });
  assert.equal(listQuerySchema.parse({ limit: "200", direction: "desc" }).limit, 200);
  assert.equal(listQuerySchema.parse({ country: "  Canada  " }).country, "Canada");
  assert.equal(listQuerySchema.parse({ state: "  California  " }).state, "California");
  assert.throws(() => listQuerySchema.parse({ limit: 201 }));
});

test("domain DTO schemas require stable identities and primary fields", () => {
  const parsed = accountDtoSchema.parse({ id: "account-1", name: "Acme" });
  assert.equal(parsed.name, "Acme");
  assert.throws(() => accountDtoSchema.parse({ id: "account-1" }));
});

test("lead DTO accepts an omitted last name and company", () => {
  const parsed = leadDtoSchema.parse({ id: "lead-1", status: "New", lastName: null, company: null });
  assert.equal(parsed.lastName, null);
  assert.equal(parsed.company, null);
});

test("opportunity DTO covers every editable field and requires persisted relationships and status", () => {
  const opportunity = {
    id: "opportunity-1",
    name: "Global Expansion",
    accountId: "account-1",
    contactId: "contact-1",
    closeDate: "2026-09-30T00:00:00.000Z",
    amount: "125000.50",
    description: "Expand the existing agreement.",
    ownerId: "user-1",
    stage: "Propose",
    probability: 0,
    forecastCategory: "Best Case",
    nextStep: "Send the revised proposal",
    leadSource: "Partner",
    courier: "FedEx",
    trackingNumber: "TRACK-123"
  };

  const parsed = opportunityDtoSchema.parse(opportunity);
  assert.equal(parsed.contactId, opportunity.contactId);
  assert.equal(parsed.description, opportunity.description);
  assert.equal(parsed.ownerId, opportunity.ownerId);
  assert.equal(parsed.probability, opportunity.probability);
  assert.equal(parsed.forecastCategory, opportunity.forecastCategory);
  assert.equal(parsed.nextStep, opportunity.nextStep);
  assert.equal(parsed.leadSource, opportunity.leadSource);
  assert.throws(() => opportunityDtoSchema.parse({ ...opportunity, closeDate: undefined }));
  assert.throws(() => opportunityDtoSchema.parse({ ...opportunity, accountId: null }));
});
