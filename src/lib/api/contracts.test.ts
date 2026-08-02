import test from "node:test";
import assert from "node:assert/strict";
import { accountDtoSchema, leadDtoSchema, listQuerySchema } from "./contracts";

test("listQuerySchema supplies bounded defaults and validates direction", () => {
  assert.deepEqual(listQuerySchema.parse({}), {
    limit: 50,
    search: "",
    view: "",
    sort: "",
    direction: "asc"
  });
  assert.equal(listQuerySchema.parse({ limit: "200", direction: "desc" }).limit, 200);
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
