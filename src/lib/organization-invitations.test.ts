import assert from "node:assert/strict";
import test from "node:test";
import { sendOrganizationInvitation } from "@/lib/organization-invitations";
import { resolvePublicAppUrl } from "@/lib/public-app-url";
import { deliverMembershipOnboarding } from "@/lib/user-management";

const acceptedAt = new Date("2026-07-24T12:00:00.000Z");

function acceptedInvitation() {
  return {
    result: {
      provider: "fake",
      acceptedAt,
      acceptedCount: 1,
      messageId: "provider-message",
      trackingKey: "tracking-key",
      deliveryIds: ["delivery-1"]
    },
    invitationDelivery: {
      status: "Accepted" as const,
      acceptedAt,
      provider: "fake",
      providerMessageId: "provider-message",
      lastReason: null
    }
  };
}

test("organization invitation uses a tenant activation link and records provider acceptance", async () => {
  let trackedMessage: { html?: string; text?: string } | undefined;
  let trackedContext:
    { sourceType: string; sourceId?: string | null; organizationId: string; userId: string } | undefined;
  let marked: { membershipId: string; sentAt: Date } | undefined;
  const delivery = await sendOrganizationInvitation(
    {
      organizationId: "org-1",
      organizationName: "Example Organization",
      membershipId: "membership-1",
      recipientName: "Invited User",
      recipientEmail: "invitee@example.com",
      role: "MEMBER",
      initiatedByUserId: "actor-1",
      newIdentity: false
    },
    {
      appUrl: "https://crm.example.com/",
      async send(message, tracking) {
        trackedMessage = message;
        trackedContext = tracking;
        return acceptedInvitation().result;
      },
      async markSent(membershipId, sentAt) {
        marked = { membershipId, sentAt };
      }
    }
  );

  assert.match(
    trackedMessage?.text ?? "",
    /https:\/\/crm\.example\.com\/organizations\/activate\?organizationId=org-1/
  );
  assert.match(trackedMessage?.html ?? "", /Open CRM/);
  assert.deepEqual(trackedContext, {
    organizationId: "org-1",
    userId: "actor-1",
    sourceType: "OrganizationInvitation",
    sourceId: "membership-1"
  });
  assert.deepEqual(marked, { membershipId: "membership-1", sentAt: acceptedAt });
  assert.equal(delivery.invitationDelivery.status, "Accepted");
});

test("public app URL prefers explicit configuration and Railway's public domain", () => {
  assert.equal(
    resolvePublicAppUrl(undefined, {
      NODE_ENV: "production",
      PUBLIC_APP_URL: "https://configured.example.com/path",
      RAILWAY_PUBLIC_DOMAIN: "railway.example.com",
      AUTH_URL: "https://localhost:8080"
    }),
    "https://configured.example.com"
  );
  assert.equal(
    resolvePublicAppUrl(undefined, {
      NODE_ENV: "production",
      RAILWAY_PUBLIC_DOMAIN: "af-crm.up.railway.app",
      AUTH_URL: "https://localhost:8080"
    }),
    "https://af-crm.up.railway.app"
  );
});

test("public app URL refuses loopback links in production", () => {
  assert.throws(
    () =>
      resolvePublicAppUrl(undefined, {
        NODE_ENV: "production",
        AUTH_URL: "https://localhost:8080"
      }),
    /must use a public host in production/
  );
});

const onboardingInput = {
  organization: { id: "org-1", name: "Example Organization" },
  membership: { id: "membership-1", role: "ADMIN" as const },
  user: { id: "user-1", keycloakSub: "keycloak-1", email: "invitee@example.com", name: "Invited User" },
  initiatedByUserId: "actor-1",
  newIdentity: true
};

test("new identities attempt invitation and setup independently when invitation delivery fails", async () => {
  let setupCalled = false;
  let markedSetup: { userId: string; sentAt: Date } | undefined;
  const result = await deliverMembershipOnboarding(onboardingInput, {
    async sendInvitation() {
      throw new Error("SendGrid unavailable");
    },
    async sendSetup() {
      setupCalled = true;
    },
    now: () => acceptedAt,
    warn() {},
    async markSetupSent(userId, sentAt) {
      markedSetup = { userId, sentAt };
    }
  });

  assert.equal(setupCalled, true);
  assert.deepEqual(markedSetup, { userId: "user-1", sentAt: acceptedAt });
  assert.equal(result.invitationEmailSent, false);
  assert.equal(result.setupEmailSent, true);
  assert.match(result.warning ?? "", /invitation email could not be sent/);
});

test("new identities preserve a successful invitation when Keycloak setup delivery fails", async () => {
  const result = await deliverMembershipOnboarding(onboardingInput, {
    async sendInvitation() {
      return acceptedInvitation();
    },
    async sendSetup() {
      throw new Error("SMTP unavailable");
    },
    warn() {},
    async markSetupSent() {
      assert.fail("failed setup must not be marked sent");
    }
  });

  assert.equal(result.invitationEmailSent, true);
  assert.equal(result.setupEmailSent, false);
  assert.equal(result.invitationDelivery?.status, "Accepted");
  assert.match(result.warning ?? "", /account setup email could not be sent/);
});

test("existing identities receive membership invitations without credential setup", async () => {
  let setupCalled = false;
  const result = await deliverMembershipOnboarding(
    { ...onboardingInput, newIdentity: false },
    {
      async sendInvitation() {
        return acceptedInvitation();
      },
      async sendSetup() {
        setupCalled = true;
      }
    }
  );

  assert.equal(setupCalled, false);
  assert.equal(result.invitationEmailSent, true);
  assert.equal(result.setupEmailSent, false);
  assert.equal(result.warning, null);
});
