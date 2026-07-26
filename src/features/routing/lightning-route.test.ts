import test from "node:test";
import assert from "node:assert/strict";
import { inferActiveApp, parseLightningRoute, pathnameWithSearch } from "./lightning-route";

function params(values: Record<string, string> = {}) {
  const search = new URLSearchParams(values);
  return {
    get: (name: string) => search.get(name),
    toString: () => search.toString()
  };
}

test("parseLightningRoute preserves app aliases and object routes", () => {
  assert.deepEqual(parseLightningRoute("/lightning/app/sales", params()), {
    kind: "list",
    activeApp: "sales",
    object: "Lead"
  });
  assert.deepEqual(parseLightningRoute("/lightning/o/Event/home", params()), {
    kind: "calendar",
    activeApp: "sales"
  });
  assert.deepEqual(parseLightningRoute("/lightning/r/Account/account-1/view", params()), {
    kind: "record",
    activeApp: "accounts",
    object: "Account",
    id: "account-1"
  });
});

test("parseLightningRoute falls back safely for unsupported routes", () => {
  assert.deepEqual(parseLightningRoute("/lightning/o/Unsupported/list", params()), {
    kind: "home",
    activeApp: "home"
  });
});

test("inferActiveApp honors service query context and path ownership", () => {
  assert.equal(inferActiveApp("/lightning/page/home", params({ app: "service" })), "service");
  assert.equal(inferActiveApp("/lightning/o/Invoice/list", params()), "sales");
  assert.equal(inferActiveApp("/lightning/o/Campaign/list", params()), "marketing");
});

test("pathnameWithSearch appends non-empty query strings", () => {
  assert.equal(pathnameWithSearch("/lightning/o/Lead/list", params()), "/lightning/o/Lead/list");
  assert.equal(
    pathnameWithSearch("/lightning/o/Lead/list", params({ search: "Acme" })),
    "/lightning/o/Lead/list?search=Acme"
  );
});
