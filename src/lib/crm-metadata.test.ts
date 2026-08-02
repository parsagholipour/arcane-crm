import assert from "node:assert/strict";
import test from "node:test";
import { FORM_DEFINITIONS, OBJECT_DEFINITIONS } from "@/lib/crm-metadata";
import type { CrmObject } from "@/lib/crm-types";

test("record app landing views show populated All lists by default", () => {
  const expectedDefaults: Partial<Record<CrmObject, string>> = {
    Contact: "All Contacts",
    Account: "All Accounts",
    Opportunity: "All Opportunities",
    Product2: "All Products",
    Pricebook2: "All Price Books",
    MessagingSession: "All Messaging Sessions",
    Knowledge__kav: "All Articles",
    ListEmail: "All List Emails",
    VideoCall: "All Video Calls"
  };

  for (const [object, expectedDefault] of Object.entries(expectedDefaults) as [CrmObject, string][]) {
    const definition = OBJECT_DEFINITIONS[object];
    assert.equal(definition.defaultList, expectedDefault);
    assert.ok(
      definition.listViews.includes(expectedDefault),
      `${object} should expose its default list in the selector`
    );
    assert.ok(
      definition.listViews.some((view) => view.includes("Recently Viewed")),
      `${object} should keep Recently Viewed available`
    );
  }
});

test("work queues keep their purpose-built visible defaults", () => {
  assert.equal(OBJECT_DEFINITIONS.Lead.defaultList, "All Open Leads");
  assert.equal(OBJECT_DEFINITIONS.Case.defaultList, "All Open Cases");
  assert.equal(OBJECT_DEFINITIONS.Campaign.defaultList, "All Campaigns");
  assert.equal(OBJECT_DEFINITIONS.Invoice.defaultList, "All Invoices");
});

test("lead identity fields are optional in the record form", () => {
  const fields = FORM_DEFINITIONS.Lead?.fields ?? [];
  assert.equal(fields.find((field) => field.name === "lastName")?.required, undefined);
  assert.equal(fields.find((field) => field.name === "company")?.required, undefined);
});
