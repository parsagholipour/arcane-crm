import assert from "node:assert/strict";
import test from "node:test";
import {
  accountNameForLead,
  buildAccountData,
  buildContactData,
  buildContactMergeData,
  buildOpportunityData,
  ConvertibleLead,
  findExactAccountMatch,
  LeadConversionValidationError,
  matchAccountsForLead,
  matchContactsForLead,
  MAX_LEADS_PER_CONVERSION,
  normalizeConversionValues,
  normalizeName,
  normalizePhone,
  opportunityNameFor,
  phoneMatchKey,
  probabilityForStage,
  splitCollidingRows
} from "@/lib/lead-conversion";

const lead: ConvertibleLead = {
  id: "lead-1",
  salutation: "Ms.",
  firstName: "Ada",
  lastName: "Lovelace",
  company: "Analytical Engines",
  title: "Chief Engineer",
  website: "https://analytical.example",
  description: "Inbound from the launch webinar.",
  ownerId: "user-1",
  rating: "Hot",
  phone: "+1 (415) 555-0100",
  email: "ada@analytical.example",
  country: "United States",
  street: "1 Babbage Way",
  postalCode: "94105",
  city: "San Francisco",
  state: "California",
  numberOfEmployees: 120,
  annualRevenue: "2500000",
  leadSource: "Web",
  industry: "Technology"
};

function expectValidationError(run: () => unknown, field: string) {
  assert.throws(run, (error: unknown) => {
    assert.ok(error instanceof LeadConversionValidationError);
    assert.equal(error.status, 400);
    assert.equal(error.field, field);
    return true;
  });
}

test("normalizeConversionValues applies documented defaults", () => {
  const now = new Date("2026-07-25T00:00:00.000Z");
  const result = normalizeConversionValues({}, 1, now);

  assert.equal(result.convertedStatus, "Qualified");
  assert.equal(result.stage, "Qualify");
  assert.equal(result.forecastCategory, "Pipeline");
  assert.equal(result.createOpportunity, true);
  assert.equal(result.amount, null);
  assert.equal(result.closeDate.toISOString().slice(0, 10), "2026-08-24");
  assert.equal(result.singleLead, true);
});

test("normalizeConversionValues rejects invalid picklist values", () => {
  expectValidationError(() => normalizeConversionValues({ convertedStatus: "Banana" }, 1), "convertedStatus");
  expectValidationError(() => normalizeConversionValues({ stage: "Banana" }, 1), "stage");
  expectValidationError(() => normalizeConversionValues({ forecastCategory: "Banana" }, 1), "forecastCategory");
});

test("normalizeConversionValues rejects an unparseable close date instead of passing it to the database", () => {
  expectValidationError(() => normalizeConversionValues({ closeDate: "not-a-date" }, 1), "closeDate");
});

test("normalizeConversionValues rejects a negative amount and keeps a valid one", () => {
  expectValidationError(() => normalizeConversionValues({ amount: "-5" }, 1), "amount");
  assert.equal(normalizeConversionValues({ amount: "12500.50" }, 1).amount, "12500.50");
  assert.equal(normalizeConversionValues({ amount: "" }, 1).amount, null);
});

test("normalizeConversionValues caps bulk conversions", () => {
  expectValidationError(() => normalizeConversionValues({}, MAX_LEADS_PER_CONVERSION + 1), "selectedIds");
  assert.doesNotThrow(() => normalizeConversionValues({}, MAX_LEADS_PER_CONVERSION));
});

test("normalizeConversionValues skips opportunity validation when no opportunity is created", () => {
  const result = normalizeConversionValues({ createOpportunity: false, stage: "Banana", closeDate: "nonsense" }, 1);
  assert.equal(result.createOpportunity, false);
  assert.equal(result.stage, "Qualify");
});

test("normalizeConversionValues ignores single-target overrides for bulk conversions", () => {
  const values = {
    accountName: "Override Co",
    existingAccountId: "acct-9",
    existingContactId: "cont-9",
    existingOpportunityId: "opp-9",
    contact: { lastName: "Override" },
    account: { type: "Customer" }
  };

  const single = normalizeConversionValues(values, 1);
  assert.equal(single.accountName, "Override Co");
  assert.equal(single.existingAccountId, "acct-9");
  assert.equal(single.contactOverrides.lastName, "Override");
  assert.equal(single.accountOverrides.type, "Customer");

  const bulk = normalizeConversionValues(values, 5);
  assert.equal(bulk.accountName, "");
  assert.equal(bulk.existingAccountId, "");
  assert.equal(bulk.existingContactId, "");
  assert.equal(bulk.existingOpportunityId, "");
  assert.deepEqual(bulk.contactOverrides, {});
  assert.deepEqual(bulk.accountOverrides, {});
});

test("normalizeConversionValues validates contact overrides", () => {
  expectValidationError(() => normalizeConversionValues({ contact: { lastName: "   " } }, 1), "contact.lastName");
  expectValidationError(() => normalizeConversionValues({ contact: { email: "nope" } }, 1), "contact.email");

  const result = normalizeConversionValues({ contact: { email: "  ada@example.com ", title: "--None--" } }, 1);
  assert.equal(result.contactOverrides.email, "ada@example.com");
  assert.equal(result.contactOverrides.title, null);
});

test("accountNameForLead walks the fallback chain", () => {
  assert.equal(accountNameForLead(lead, "  Explicit Co  "), "Explicit Co");
  assert.equal(accountNameForLead(lead), "Analytical Engines");
  assert.equal(accountNameForLead({ ...lead, company: "   " }), "Ada Lovelace");
  assert.equal(accountNameForLead({ ...lead, company: null, firstName: null, lastName: "" }), "Converted Lead Account");
});

test("opportunityNameFor falls back to the account name", () => {
  assert.equal(opportunityNameFor("Acme", "  Big Deal "), "Big Deal");
  assert.equal(opportunityNameFor("Acme", "   "), "Acme Opportunity");
});

test("buildAccountData carries the lead segment fields that used to be dropped", () => {
  const account = buildAccountData(lead, "Analytical Engines");
  assert.equal(account.name, "Analytical Engines");
  assert.equal(account.industry, "Technology");
  assert.equal(account.annualRevenue, "2500000");
  assert.equal(account.numberOfEmployees, 120);
  assert.equal(account.rating, "Hot");
  assert.equal(account.type, null, "type is not hardcoded; convert UI supplies it when set");
  assert.equal(account.ownerId, "user-1");
  assert.equal(account.billingCity, "San Francisco");
  assert.equal(buildAccountData({ ...lead, annualRevenue: null }, "X").annualRevenue, null);
  assert.equal(buildAccountData(lead, "X", { type: "Prospect" }).type, "Prospect");
});

test("buildContactData carries leadSource and honours overrides", () => {
  const contact = buildContactData(lead, "acct-1");
  assert.equal(contact.leadSource, "Web");
  assert.equal(contact.lastName, "Lovelace");
  assert.equal(contact.email, "ada@analytical.example");
  assert.equal(contact.mailingPostalCode, "94105");

  const overridden = buildContactData(lead, "acct-1", { email: "new@example.com", title: null, lastName: "Byron" });
  assert.equal(overridden.email, "new@example.com");
  assert.equal(overridden.title, null);
  assert.equal(overridden.lastName, "Byron");
  assert.equal(overridden.firstName, "Ada", "fields without an override keep the lead value");
});

test("buildContactData gives a nameless lead a valid conversion fallback", () => {
  const contact = buildContactData({ ...lead, lastName: null }, "acct-1");
  assert.equal(contact.lastName, "Converted Lead");
});

test("buildContactMergeData fills only the gaps on an existing contact", () => {
  const merged = buildContactMergeData({ title: "VP", phone: null, email: null, leadSource: null }, lead, "acct-2");
  assert.equal(merged.accountId, "acct-2");
  assert.equal(merged.title, "VP", "an existing value is never overwritten");
  assert.equal(merged.phone, lead.phone);
  assert.equal(merged.email, lead.email);
  assert.equal(merged.leadSource, "Web");
});

test("buildOpportunityData carries amount, leadSource and a stage-derived probability", () => {
  const closeDate = new Date("2026-09-01T00:00:00.000Z");
  const opportunity = buildOpportunityData(lead, "acct-1", "cont-1", {
    name: "Analytical Engines Opportunity",
    closeDate,
    stage: "Propose",
    forecastCategory: "Best Case",
    amount: "50000"
  });

  assert.equal(opportunity.amount, "50000");
  assert.equal(opportunity.leadSource, "Web");
  assert.equal(opportunity.stage, "Propose");
  assert.equal(opportunity.probability, 50);
  assert.equal(opportunity.contactId, "cont-1");
  assert.equal(opportunity.nextStep, "Follow up after lead conversion");
  assert.equal(opportunity.description, lead.description);
  assert.equal(opportunity.courier, null);
  assert.equal(opportunity.trackingNumber, null);
});

test("buildOpportunityData honours form overrides for the full opportunity shape", () => {
  const closeDate = new Date("2026-09-01T00:00:00.000Z");
  const opportunity = buildOpportunityData(lead, "acct-1", "cont-1", {
    name: "Custom Deal",
    closeDate,
    stage: "Negotiate",
    forecastCategory: "Commit",
    amount: "12000",
    description: "Override description",
    ownerId: "user-9",
    probability: 80,
    nextStep: "Send contract",
    leadSource: "Partner",
    courier: "USPS",
    trackingNumber: "9400111899223344556677"
  });

  assert.equal(opportunity.description, "Override description");
  assert.equal(opportunity.ownerId, "user-9");
  assert.equal(opportunity.probability, 80);
  assert.equal(opportunity.nextStep, "Send contract");
  assert.equal(opportunity.leadSource, "Partner");
  assert.equal(opportunity.courier, "USPS");
  assert.equal(opportunity.trackingNumber, "9400111899223344556677");
});

test("normalizeConversionValues accepts the opportunity form fields", () => {
  const result = normalizeConversionValues(
    {
      stage: "Propose",
      forecastCategory: "Best Case",
      description: "From convert form",
      ownerId: "user-2",
      probability: "55",
      nextStep: "Demo follow-up",
      leadSource: "Web",
      courier: "FedEx",
      trackingNumber: "FX123"
    },
    1
  );

  assert.equal(result.description, "From convert form");
  assert.equal(result.ownerId, "user-2");
  assert.equal(result.probability, 55);
  assert.equal(result.nextStep, "Demo follow-up");
  assert.equal(result.leadSource, "Web");
  assert.equal(result.courier, "FedEx");
  assert.equal(result.trackingNumber, "FX123");
});

test("normalizeConversionValues rejects invalid opportunity extras", () => {
  expectValidationError(() => normalizeConversionValues({ probability: "101" }, 1), "probability");
  expectValidationError(() => normalizeConversionValues({ leadSource: "Banana" }, 1), "leadSource");
  expectValidationError(() => normalizeConversionValues({ courier: "Banana" }, 1), "courier");
  expectValidationError(
    () => normalizeConversionValues({ courier: "USPS", trackingNumber: "not-valid" }, 1),
    "trackingNumber"
  );
});

test("probabilityForStage covers every stage rather than only Qualify", () => {
  assert.equal(probabilityForStage("Qualify"), 10);
  assert.equal(probabilityForStage("Meet & Present"), 25);
  assert.equal(probabilityForStage("Propose"), 50);
  assert.equal(probabilityForStage("Negotiate"), 75);
  assert.equal(probabilityForStage("Closed Won"), 100);
  assert.equal(probabilityForStage("Closed Lost"), 0);
  assert.equal(probabilityForStage("Unknown"), null);
});

test("matchAccountsForLead is case-insensitive and ranks exact matches first", () => {
  const accounts = [
    { id: "a1", name: "Analytical Engines Holdings" },
    { id: "a2", name: "analytical engines" },
    { id: "a3", name: "Unrelated Inc" }
  ];
  const matches = matchAccountsForLead(accounts, lead);
  assert.deepEqual(
    matches.map((account) => account.id),
    ["a2", "a1"]
  );
  assert.deepEqual(matchAccountsForLead(accounts, { ...lead, company: null }), []);
});

test("findExactAccountMatch ignores case and surrounding whitespace", () => {
  const accounts = [{ id: "a1", name: "Acme Corp" }];
  assert.equal(findExactAccountMatch(accounts, "  acme corp ")?.id, "a1");
  assert.equal(findExactAccountMatch(accounts, "acme"), undefined);
  assert.equal(findExactAccountMatch(accounts, "  "), undefined);
});

test("matchContactsForLead matches on email, phone or full name", () => {
  const contacts = [
    { id: "c-name", firstName: "Ada", lastName: "Lovelace", email: "other@example.com", phone: "" },
    { id: "c-phone", firstName: "A.", lastName: "L.", email: null, phone: "415-555-0100" },
    { id: "c-email", firstName: "Augusta", lastName: "King", email: "ADA@analytical.example", phone: null },
    { id: "c-none", firstName: "Someone", lastName: "Else", email: "else@example.com", phone: "999" }
  ];
  const matches = matchContactsForLead(contacts, lead);
  assert.deepEqual(
    matches.map((contact) => contact.id),
    ["c-email", "c-phone", "c-name"]
  );
});

test("normalizeName and normalizePhone strip formatting differences", () => {
  assert.equal(normalizeName("  Acme Corp "), "acme corp");
  assert.equal(normalizePhone("+1 (415) 555-0100"), "14155550100");
  assert.equal(normalizePhone(null), "");
});

test("phoneMatchKey ignores country codes and rejects fragments", () => {
  assert.equal(phoneMatchKey("+1 (415) 555-0100"), phoneMatchKey("415-555-0100"));
  assert.equal(phoneMatchKey("999"), "", "too short to be a real number");
  assert.notEqual(phoneMatchKey("415-555-0100"), phoneMatchKey("415-555-0199"));
});

test("splitCollidingRows drops rows whose key the target already holds", () => {
  const rows = [
    { id: "m1", campaignId: "camp-1" },
    { id: "m2", campaignId: "camp-2" },
    { id: "m3", campaignId: "camp-3" }
  ];
  const { moveIds, dropIds } = splitCollidingRows(rows, (row) => row.campaignId, ["camp-2"]);
  assert.deepEqual(moveIds, ["m1", "m3"]);
  assert.deepEqual(dropIds, ["m2"]);
});

test("splitCollidingRows also de-duplicates within the moving set", () => {
  const rows = [
    { id: "l1", label: "hot" },
    { id: "l2", label: "hot" }
  ];
  const { moveIds, dropIds } = splitCollidingRows(rows, (row) => row.label, []);
  assert.deepEqual(moveIds, ["l1"]);
  assert.deepEqual(dropIds, ["l2"]);
});
