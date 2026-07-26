import "server-only";

import { prisma } from "@/lib/prisma";
import { EmailValidationError } from "@/lib/email/errors";
import { resolveListEmailRecipients } from "@/lib/email/recipients";
import { isValidEmail, validateScheduledAt } from "@/lib/email/service";
import { sendTrackedEmail } from "@/lib/email/tracking";
import { caseNotificationTemplate } from "@/lib/email/templates";
import type { EmailAdapter } from "@/lib/email/types";

type EmailDependencies = { adapter?: EmailAdapter; senderEmail?: string };

export async function deliverListEmail(
  input: {
    organizationId: string;
    organizationName: string;
    userId: string;
    sourceId?: string;
    subject: unknown;
    body: unknown;
    recipients: unknown;
    scheduledAt?: unknown;
  },
  dependencies: EmailDependencies = {}
) {
  const subject = String(input.subject ?? "").trim();
  const body = String(input.body ?? "").trim();
  const recipientReferences = Array.isArray(input.recipients) ? input.recipients.map(String) : [];
  const scheduledAt = input.scheduledAt ? validateScheduledAt(new Date(String(input.scheduledAt))) : undefined;
  const resolved = await resolveListEmailRecipients(input.organizationId, recipientReferences);
  const delivery = await sendTrackedEmail(
    {
      fromName: input.organizationName,
      to: resolved.addresses,
      subject,
      text: body,
      scheduledAt
    },
    { organizationId: input.organizationId, userId: input.userId, sourceType: "ListEmail", sourceId: input.sourceId },
    dependencies
  );
  return { ...delivery, skipped: resolved.skipped };
}

export async function deliverCaseNotification(
  input: {
    organizationId: string;
    organizationName: string;
    userId: string;
    sourceId?: string;
    contactId: unknown;
    caseNumber: string;
    status: string;
    subject?: string | null;
    description?: string | null;
  },
  dependencies: EmailDependencies = {}
) {
  const contactId = String(input.contactId ?? "").trim();
  if (!contactId) throw new EmailValidationError("Select a contact before sending a case notification email.");
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, organizationId: input.organizationId },
    select: { firstName: true, lastName: true, email: true }
  });
  if (!contact) throw new EmailValidationError("The selected case contact was not found in this organization.");
  if (!isValidEmail(contact.email))
    throw new EmailValidationError("The selected case contact does not have a valid email address.");
  const template = caseNotificationTemplate(input);
  return sendTrackedEmail(
    {
      fromName: input.organizationName,
      to: [{ email: contact.email, name: [contact.firstName, contact.lastName].filter(Boolean).join(" ") }],
      subject: template.subject,
      text: template.text
    },
    { organizationId: input.organizationId, userId: input.userId, sourceType: "Case", sourceId: input.sourceId },
    dependencies
  );
}
