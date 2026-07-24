import assert from "node:assert/strict";
import test from "node:test";
import { AppAuthorizationError } from "@/lib/authorization-errors";
import { activateOrganizationForUser } from "@/lib/organization-activation";

test("organization activation rejects unavailable memberships without changing state", async () => {
  let touched = false;
  await assert.rejects(
    () => activateOrganizationForUser("user-1", "org-1", 403, {
      async findMembership() {
        return null;
      },
      async touchMembership() {
        touched = true;
      }
    }),
    (error: unknown) => error instanceof AppAuthorizationError && error.status === 403
  );
  assert.equal(touched, false);
});

test("organization switching preserves its existing 404 contract", async () => {
  await assert.rejects(
    () => activateOrganizationForUser("user-1", "org-1", 404, {
      async findMembership() {
        return null;
      }
    }),
    (error: unknown) => error instanceof AppAuthorizationError && error.status === 404
  );
});

test("organization activation records access before returning the selected organization", async () => {
  const accessedAt = new Date("2026-07-24T12:30:00.000Z");
  let touched: { membershipId: string; timestamp: Date } | undefined;
  const membership = {
    id: "membership-1",
    organizationId: "org-1",
    userId: "user-1",
    role: "ADMIN" as const,
    status: "ACTIVE" as const,
    invitedAt: new Date(),
    inviteSentAt: null,
    lastAccessedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    organization: {
      id: "org-1",
      name: "Example",
      slug: "example",
      status: "ACTIVE" as const,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  };
  const result = await activateOrganizationForUser("user-1", "org-1", 403, {
    async findMembership() {
      return membership;
    },
    now: () => accessedAt,
    async touchMembership(membershipId, timestamp) {
      touched = { membershipId, timestamp };
    }
  });
  assert.equal(result.organization.slug, "example");
  assert.deepEqual(touched, { membershipId: "membership-1", timestamp: accessedAt });
});
