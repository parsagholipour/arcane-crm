import { describe, expect, it } from "vitest";
import { createCrmQueryClient, crmQueryKeys } from "@/lib/query/core";

describe("CRM query configuration", () => {
  it("builds organization-scoped stable keys", () => {
    expect(crmQueryKeys.shell("org-a")).toEqual(["crm", "org-a", "shell"]);
    expect(crmQueryKeys.record("org-a", "Account", "account-1")).toEqual([
      "crm",
      "org-a",
      "records",
      "Account",
      "detail",
      "account-1"
    ]);
    expect(crmQueryKeys.list("org-a", "Lead", {})).not.toEqual(crmQueryKeys.list("org-b", "Lead", {}));
  });

  it("retries reads once and never retries mutations", () => {
    const client = createCrmQueryClient();
    expect(client.getDefaultOptions().queries?.retry).toBe(1);
    expect(client.getDefaultOptions().mutations?.retry).toBe(false);
  });
});
