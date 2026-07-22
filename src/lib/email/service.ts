import "server-only";

import { EmailConfigurationError, EmailValidationError } from "@/lib/email/errors";
import { SendGridEmailAdapter } from "@/lib/email/sendgrid";
import type { EmailAdapter, EmailAddress, EmailSendResult, OutboundEmail } from "@/lib/email/types";

export const SENDGRID_SCHEDULE_LIMIT_MS = 72 * 60 * 60 * 1000;

export function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function normalizeEmailAddress(value: string) {
  return value.trim().toLowerCase();
}

export function emailDeliveryConfigured() {
  return Boolean(process.env.SENDGRID_API_KEY?.trim() && isValidEmail(process.env.SENDGRID_EMAIL));
}

export function validateScheduledAt(value: Date, now = new Date()) {
  const timestamp = value.getTime();
  if (!Number.isFinite(timestamp)) throw new EmailValidationError("Choose a valid schedule date and time.");
  if (timestamp <= now.getTime()) throw new EmailValidationError("Scheduled email must be in the future.");
  if (timestamp - now.getTime() > SENDGRID_SCHEDULE_LIMIT_MS) {
    throw new EmailValidationError("SendGrid can schedule email no more than 72 hours in advance.");
  }
  return value;
}

function configuredAdapter() {
  const apiKey = process.env.SENDGRID_API_KEY?.trim();
  if (!apiKey) throw new EmailConfigurationError("SENDGRID_API_KEY is not configured.");
  return new SendGridEmailAdapter(apiKey);
}

export type ConfiguredOutboundEmail = Omit<OutboundEmail, "from"> & { fromName: string };

export async function sendConfiguredEmail(
  message: ConfiguredOutboundEmail,
  dependencies: { adapter?: EmailAdapter; senderEmail?: string } = {}
): Promise<EmailSendResult> {
  const senderEmail = dependencies.senderEmail ?? process.env.SENDGRID_EMAIL?.trim() ?? "";
  if (!isValidEmail(senderEmail)) throw new EmailConfigurationError("SENDGRID_EMAIL must be a valid verified sender address.");
  if (!message.to.length) throw new EmailValidationError("Select at least one deliverable email recipient.");
  const recipients = new Map<string, EmailAddress>();
  for (const recipient of message.to) {
    if (!isValidEmail(recipient.email)) throw new EmailValidationError("One or more recipient email addresses are invalid.");
    const email = normalizeEmailAddress(recipient.email);
    if (!recipients.has(email)) recipients.set(email, { ...recipient, email });
  }
  const subject = message.subject.trim();
  if (!subject) throw new EmailValidationError("Email subject is required.");
  if (!message.text?.trim() && !message.html?.trim()) throw new EmailValidationError("Email body is required.");
  if (message.scheduledAt) validateScheduledAt(message.scheduledAt);

  return (dependencies.adapter ?? configuredAdapter()).send({
    ...message,
    from: { email: normalizeEmailAddress(senderEmail), name: message.fromName.trim() || undefined },
    to: [...recipients.values()],
    subject
  });
}
