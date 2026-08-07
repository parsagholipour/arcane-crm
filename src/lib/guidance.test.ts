import assert from "node:assert/strict";
import test from "node:test";
import { BUILT_IN_GUIDANCE_ITEMS, builtInGuidanceItemById } from "@/lib/guidance";

test("provides the Add a lead fallback as a persistable guidance item", () => {
  assert.deepEqual(builtInGuidanceItemById("lead"), {
    id: "lead",
    title: "Add a lead",
    body: "First enter and save a few details about the lead. You can add a sample lead, snooze this guidance, drag it, or dismiss it.",
    href: "/lightning/o/Lead/list?filterName=AllOpenLeads",
    target: "Lead"
  });
});

test("does not treat arbitrary IDs as built-in guidance", () => {
  assert.equal(builtInGuidanceItemById("missing"), undefined);
  assert.equal(new Set(BUILT_IN_GUIDANCE_ITEMS.map((item) => item.id)).size, BUILT_IN_GUIDANCE_ITEMS.length);
});
