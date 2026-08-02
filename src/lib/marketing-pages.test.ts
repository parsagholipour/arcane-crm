import assert from "node:assert/strict";
import test from "node:test";
import { landingPageFields } from "@/lib/marketing-pages";

test("marketing lead forms require only email", () => {
  assert.deepEqual(landingPageFields([]), ["email"]);
  assert.deepEqual(landingPageFields(["company", "lastName"]), ["lastName", "email", "company"]);
});
