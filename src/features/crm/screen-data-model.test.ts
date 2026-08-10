import assert from "node:assert/strict";
import test from "node:test";
import {
  calendarEditorLookups,
  editorLookupObjects,
  mergeScopedRecordCollections,
  needsPriceBookEntries
} from "@/server/screens/screen-data-model";

test("list editors load every cross-object lookup collection they render", () => {
  assert.deepEqual(editorLookupObjects("Invoice", false), [
    "Account",
    "Contact",
    "Opportunity",
    "Product2",
    "Pricebook2"
  ]);
  assert.deepEqual(editorLookupObjects("VideoCall", false), ["Account", "Contact", "Opportunity"]);
  assert.deepEqual(editorLookupObjects("ListEmail", false), ["Account", "Contact", "Lead"]);
  assert.deepEqual(calendarEditorLookups, [
    "Account",
    "Contact",
    "Lead",
    "Opportunity",
    "Case",
    "Campaign",
    "Invoice",
    "ListEmail",
    "Product2"
  ]);
});

test("record editors retain same-object lookup collections", () => {
  assert.deepEqual(editorLookupObjects("Account", true), ["Account", "Contact"]);
  assert.deepEqual(editorLookupObjects("Contact", true), ["Account", "Contact"]);
  assert.deepEqual(editorLookupObjects("Campaign", true), ["Account", "Contact", "Campaign"]);
});

test("opportunity product editors load catalogue products and price book entries", () => {
  assert.deepEqual(editorLookupObjects("Opportunity", true), ["Account", "Contact", "Product2"]);
  assert.deepEqual(editorLookupObjects("Opportunity", false), ["Account", "Contact", "Product2"]);
  assert.equal(needsPriceBookEntries("Opportunity", "record"), true);
  assert.equal(needsPriceBookEntries("Opportunity", "list"), false);
});

test("list lookup batches do not replace the current filtered list collection", () => {
  assert.deepEqual(editorLookupObjects("Account", false), ["Contact"]);
  assert.deepEqual(editorLookupObjects("Contact", false), ["Account"]);
  assert.deepEqual(editorLookupObjects("Campaign", false), ["Account", "Contact"]);
});

test("record detail collections win duplicate ids without discarding other lookup choices", () => {
  const merged = mergeScopedRecordCollections(
    {
      accounts: [
        { id: "account-current", name: "Lookup copy" },
        { id: "account-parent", name: "Parent account" }
      ],
      contacts: [{ id: "contact-other", firstName: "Other" }]
    },
    {
      accounts: [{ id: "account-current", name: "Detailed current account", description: "Full detail" }],
      contacts: [{ id: "contact-related", firstName: "Related" }]
    }
  );

  assert.deepEqual(merged.accounts, [
    { id: "account-current", name: "Detailed current account", description: "Full detail" },
    { id: "account-parent", name: "Parent account" }
  ]);
  assert.deepEqual(merged.contacts, [
    { id: "contact-related", firstName: "Related" },
    { id: "contact-other", firstName: "Other" }
  ]);
});
