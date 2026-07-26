import assert from "node:assert/strict";
import test from "node:test";
import { EmailConfigurationError, EmailDeliveryError, EmailValidationError } from "@/lib/email/errors";
import { resolveRecipientRecords } from "@/lib/email/recipients";
import { sendConfiguredEmail, validateScheduledAt } from "@/lib/email/service";
import { SendGridEmailAdapter, toSendGridMailData } from "@/lib/email/sendgrid";
import {
  calendarReminderTemplate,
  caseNotificationTemplate,
  organizationInvitationTemplate
} from "@/lib/email/templates";
import { sendGridDeliveryState } from "@/lib/email/tracking";
import type { EmailAdapter, OutboundEmail } from "@/lib/email/types";

const baseMessage: OutboundEmail = {
  from: { email: "sender@example.com", name: "Example CRM" },
  to: [
    { email: "first@example.com", name: "First" },
    { email: "second@example.com", name: "Second" }
  ],
  subject: "Private recipients",
  text: "Message body"
};

test("SendGrid mapping uses private personalizations, scheduling, and base64 attachments", () => {
  const scheduledAt = new Date("2026-07-22T12:00:00.000Z");
  const mapped = toSendGridMailData({
    ...baseMessage,
    scheduledAt,
    customArgs: { crm_email_batch_id: "batch-1" },
    attachments: [
      { filename: "invoice.pdf", contentType: "application/pdf", content: new Uint8Array([37, 80, 68, 70]) }
    ]
  });
  assert.equal(mapped.personalizations?.length, 2);
  assert.deepEqual(
    mapped.personalizations?.map((item) => {
      const recipients = Array.isArray(item.to) ? item.to : item.to ? [item.to] : [];
      return recipients.map((recipient) => (typeof recipient === "string" ? recipient : recipient.email));
    }),
    [["first@example.com"], ["second@example.com"]]
  );
  assert.equal(mapped.sendAt, Math.floor(scheduledAt.getTime() / 1000));
  assert.deepEqual(
    mapped.personalizations?.map((item) => item.customArgs),
    [{ crm_email_batch_id: "batch-1" }, { crm_email_batch_id: "batch-1" }]
  );
  assert.equal(mapped.attachments?.[0].content, Buffer.from([37, 80, 68, 70]).toString("base64"));
});

test("SendGrid event names map to truthful delivery states", () => {
  assert.deepEqual(sendGridDeliveryState("processed"), { status: "Processing", failed: false });
  assert.deepEqual(sendGridDeliveryState("delivered"), { status: "Delivered", failed: false });
  assert.deepEqual(sendGridDeliveryState("bounce"), { status: "Bounced", failed: true });
  assert.deepEqual(sendGridDeliveryState("spamreport"), { status: "Spam Report", failed: true });
  assert.equal(sendGridDeliveryState("open"), null);
});

test("SendGrid adapter returns provider acceptance metadata", async () => {
  let received: unknown;
  const adapter = new SendGridEmailAdapter("unused-test-key", {
    async send(message) {
      received = message;
      return [{ headers: { "x-message-id": "sg-message-1" } }, {}];
    }
  });
  const result = await adapter.send(baseMessage);
  assert.ok(received);
  assert.equal(result.provider, "sendgrid");
  assert.equal(result.acceptedCount, 2);
  assert.equal(result.messageId, "sg-message-1");
});

test("SendGrid adapter hides provider failures behind a delivery error", async () => {
  const adapter = new SendGridEmailAdapter("unused-test-key", {
    async send() {
      throw new Error("secret provider response");
    }
  });
  await assert.rejects(() => adapter.send(baseMessage), EmailDeliveryError);
});

test("configured email validates sender, deduplicates recipients, and supports adapter injection", async () => {
  let delivered: OutboundEmail | undefined;
  const adapter: EmailAdapter = {
    async send(message) {
      delivered = message;
      return { provider: "fake", acceptedAt: new Date(), acceptedCount: message.to.length };
    }
  };
  const result = await sendConfiguredEmail(
    {
      fromName: "Example CRM",
      to: [{ email: "Customer@Example.com" }, { email: "customer@example.com" }],
      subject: "Subject",
      text: "Body"
    },
    { adapter, senderEmail: "verified@example.com" }
  );
  assert.equal(result.acceptedCount, 1);
  assert.equal(delivered?.from.email, "verified@example.com");
  assert.deepEqual(
    delivered?.to.map((recipient) => recipient.email),
    ["customer@example.com"]
  );
  await assert.rejects(
    () =>
      sendConfiguredEmail(
        { fromName: "CRM", to: [{ email: "a@example.com" }], subject: "Subject", text: "Body" },
        { adapter, senderEmail: "invalid" }
      ),
    EmailConfigurationError
  );
});

test("scheduled delivery validates the SendGrid 72-hour window", () => {
  const now = new Date("2026-07-22T00:00:00.000Z");
  assert.equal(
    validateScheduledAt(new Date(now.getTime() + 72 * 60 * 60 * 1000), now).toISOString(),
    "2026-07-25T00:00:00.000Z"
  );
  assert.throws(() => validateScheduledAt(new Date(now.getTime() - 1), now), EmailValidationError);
  assert.throws(
    () => validateScheduledAt(new Date(now.getTime() + 72 * 60 * 60 * 1000 + 1), now),
    EmailValidationError
  );
});

test("recipient resolution supports typed and legacy IDs, account expansion, deduplication, and skips", () => {
  const records = {
    leads: [{ id: "lead-1", firstName: "Lee", lastName: "Lead", email: "shared@example.com" }],
    contacts: [
      { id: "contact-1", firstName: "Connie", lastName: "Contact", email: "SHARED@example.com" },
      { id: "contact-2", firstName: "No", lastName: "Email", email: null }
    ],
    accounts: [
      {
        id: "account-1",
        name: "Acme",
        contacts: [{ id: "contact-3", firstName: "Account", lastName: "Person", email: "account@example.com" }]
      }
    ]
  };
  const resolved = resolveRecipientRecords(
    ["lead:lead-1", "contact-1", "contact:contact-2", "account:account-1"],
    records
  );
  assert.deepEqual(resolved.addresses.map((address) => address.email).sort(), [
    "account@example.com",
    "shared@example.com"
  ]);
  assert.equal(resolved.skipped.length, 1);
  assert.equal(resolved.skipped[0].reference, "contact:contact-2");
  assert.throws(() => resolveRecipientRecords(["lead:outside-org"], records), EmailValidationError);
});

test("case notifications include the case identity and customer-facing details", () => {
  const message = caseNotificationTemplate({
    organizationName: "Example CRM",
    caseNumber: "00001234",
    status: "New",
    subject: "Login issue",
    description: "Cannot sign in."
  });
  assert.equal(message.subject, "Case 00001234: Login issue");
  assert.match(message.text, /Status: New/);
  assert.match(message.text, /Cannot sign in\./);
});

test("calendar reminder emails include localized schedule details and an event link", () => {
  const message = calendarReminderTemplate({
    organizationName: "Example CRM",
    eventSubject: "Customer review",
    startText: "Thursday, August 20, 2026 at 2:00 PM",
    endText: "Thursday, August 20, 2026 at 3:00 PM",
    allDay: false,
    location: "Conference Room",
    eventUrl: "https://crm.example.com/lightning/o/Event/home?eventId=event-1"
  });
  assert.equal(message.subject, "Reminder: Customer review");
  assert.match(message.text, /Starts: Thursday, August 20/);
  assert.match(message.text, /Location: Conference Room/);
  assert.match(message.html, /Open event/);
  assert.match(message.html, /eventId=event-1/);
});

test("organization invitations are branded, role-aware, and HTML escaped", () => {
  const message = organizationInvitationTemplate({
    recipientName: "Ava <Admin>",
    organizationName: "Research & Development",
    role: "ADMIN",
    activationUrl: "https://crm.example.com/organizations/activate?organizationId=org%201",
    newIdentity: true
  });
  assert.equal(message.subject, "You've been invited to Research & Development in Reloriq");
  assert.match(message.text, /administrator access/);
  assert.match(message.text, /separate Reloriq account setup email/);
  assert.match(message.html, /Ava &lt;Admin&gt;/);
  assert.match(message.html, /Research &amp; Development/);
  assert.doesNotMatch(message.html, /Ava <Admin>/);
});

test("organization invitations tell existing identities to use current credentials", () => {
  const message = organizationInvitationTemplate({
    recipientName: "Existing User",
    organizationName: "Example",
    role: "MEMBER",
    activationUrl: "https://crm.example.com/organizations/activate?organizationId=org-1",
    newIdentity: false
  });
  assert.match(message.text, /member access/);
  assert.match(message.text, /existing Reloriq account/);
});
