import assert from "node:assert/strict";
import test from "node:test";
import { isRecordRecentlyViewed, recentlyViewedEntryForRecord, recentSearchHistoryEntries } from "@/lib/recent-records";

test("builds a persistent recently-viewed entry for a created Contact", () => {
  const entry = recentlyViewedEntryForRecord("Contact", {
    id: "contact-123",
    salutation: "Mr.",
    firstName: "John",
    lastName: "Smith"
  });

  assert.deepEqual(entry, {
    label: "Mr. John Smith",
    context: "Contact",
    href: "/lightning/r/Contact/contact-123/view",
    category: "Recently Viewed"
  });
});

test("matches created records against recently-viewed entries by record route", () => {
  const account = { id: "account-123", name: "One Piece Collectibles" };
  const recent = recentlyViewedEntryForRecord("Account", account);

  assert.ok(recent);
  assert.equal(isRecordRecentlyViewed("Account", account, [recent]), true);
  assert.equal(isRecordRecentlyViewed("Account", { id: "account-456", name: "Other" }, [recent]), false);
});

test("supports every CRM object that has a record detail page", () => {
  const records = [
    ["Account", { id: "account-1", name: "Account" }],
    ["Contact", { id: "contact-1", firstName: "Contact", lastName: "Person" }],
    ["Lead", { id: "lead-1", firstName: "Lead", lastName: "Person" }],
    ["Opportunity", { id: "opportunity-1", name: "Opportunity" }],
    ["Product2", { id: "product-1", name: "Product" }],
    ["Pricebook2", { id: "price-book-1", name: "Price Book" }],
    ["Case", { id: "case-1", caseNumber: "00000001" }],
    ["MessagingSession", { id: "messaging-1", name: "Messaging Session" }],
    ["Knowledge__kav", { id: "knowledge-1", title: "Knowledge Article" }],
    ["ListEmail", { id: "list-email-1", subject: "List Email" }],
    ["Campaign", { id: "campaign-1", name: "Campaign" }],
    ["Invoice", { id: "invoice-1", invoiceNumber: "INV-000001" }],
    ["VideoCall", { id: "video-call-1", name: "Video Call" }]
  ] as const;

  for (const [object, record] of records) {
    const entry = recentlyViewedEntryForRecord(object, record);
    assert.ok(entry, `${object} should produce a recently-viewed entry`);
    assert.equal(entry.href, `/lightning/r/${object}/${record.id}/view`);
    assert.equal(entry.category, "Recently Viewed");
  }
});

test("does not create recently-viewed entries for objects without record routes", () => {
  assert.equal(recentlyViewedEntryForRecord("Event", { id: "event-123", subject: "Meeting" }), null);
  assert.equal(recentlyViewedEntryForRecord("QuickText", { id: "quick-text-123", name: "Greeting" }), null);
});

test("keeps record views out of Recent Searches and caps the displayed search history", () => {
  const searches = Array.from({ length: 10 }, (_, index) => ({
    id: `search-${index}`,
    query: `query ${index}`,
    href: `/search/${index}`
  }));
  const recordView = recentlyViewedEntryForRecord("Account", { id: "account-1", name: "Account" });

  assert.ok(recordView);
  const displayed = recentSearchHistoryEntries([recordView, ...searches]);
  assert.equal(displayed.length, 8);
  assert.ok(displayed.every((entry) => typeof entry.query === "string"));
});
