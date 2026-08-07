import assert from "node:assert/strict";
import test from "node:test";
import { isServerSortableListColumn } from "./record-list-sorting";

test("Lead list sorting uses persisted columns and rejects derived owner aliases", () => {
  for (const column of ["displayName", "company", "state", "phone", "email", "status", "createdAt"]) {
    assert.equal(isServerSortableListColumn("Lead", column), true, column);
  }
  assert.equal(isServerSortableListColumn("Lead", "ownerAlias"), false);
});

test("relation-backed names are globally sortable while external status is not", () => {
  assert.equal(isServerSortableListColumn("Contact", "accountName"), true);
  assert.equal(isServerSortableListColumn("Invoice", "opportunityName"), true);
  assert.equal(isServerSortableListColumn("Opportunity", "trackingStatus"), false);
});
