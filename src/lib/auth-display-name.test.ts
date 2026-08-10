import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  profileDisplayName,
  resolveSyncedDisplayName,
  splitDisplayName,
  welcomeFirstName
} from "@/lib/auth-display-name";

describe("profileDisplayName", () => {
  it("prefers given_name + family_name over preferred_username", () => {
    const result = profileDisplayName(
      { given_name: "Parsa", family_name: "Gholipourjamnani", preferred_username: "admin", name: "admin" },
      "12parsa@gmail.com"
    );
    assert.deepEqual(result, { name: "Parsa Gholipourjamnani", quality: "full" });
  });

  it("ignores name when it is only preferred_username", () => {
    const result = profileDisplayName({ name: "admin", preferred_username: "admin" }, "12parsa@gmail.com", "CRM User");
    assert.deepEqual(result, { name: "12parsa", quality: "fallback" });
  });
});

describe("resolveSyncedDisplayName", () => {
  it("does not clobber a real name with a username fallback", () => {
    assert.equal(
      resolveSyncedDisplayName({
        incoming: "admin",
        quality: "fallback",
        existingName: "Parsa Gholipourjamnani",
        preferredUsername: "admin",
        email: "12parsa@gmail.com"
      }),
      "Parsa Gholipourjamnani"
    );
  });

  it("replaces a username-like stored name when a full IdP name arrives", () => {
    assert.equal(
      resolveSyncedDisplayName({
        incoming: "Parsa Gholipourjamnani",
        quality: "full",
        existingName: "admin",
        preferredUsername: "admin",
        email: "12parsa@gmail.com"
      }),
      "Parsa Gholipourjamnani"
    );
  });
});

describe("welcomeFirstName", () => {
  it("returns the first token of a full name", () => {
    assert.equal(welcomeFirstName("Parsa Gholipourjamnani"), "Parsa");
  });

  it("falls back when empty", () => {
    assert.equal(welcomeFirstName("  "), "there");
  });
});

describe("splitDisplayName", () => {
  it("splits first and remaining tokens", () => {
    assert.deepEqual(splitDisplayName("Parsa Gholipourjamnani"), {
      firstName: "Parsa",
      lastName: "Gholipourjamnani"
    });
  });
});
