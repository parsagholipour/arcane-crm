import "server-only";

import { MailService, type MailDataRequired } from "@sendgrid/mail";
import { EmailDeliveryError } from "@/lib/email/errors";
import type { EmailAdapter, EmailSendResult, OutboundEmail } from "@/lib/email/types";

type SendGridResponse = {
  headers?: Record<string, string | string[] | undefined>;
};

type SendGridClient = {
  send(data: MailDataRequired): Promise<[SendGridResponse, unknown]>;
};

function messageIdFrom(response: SendGridResponse) {
  const value = response.headers?.["x-message-id"] ?? response.headers?.["X-Message-Id"];
  return Array.isArray(value) ? value[0] : value;
}

export function toSendGridMailData(message: OutboundEmail): MailDataRequired {
  const content = message.text ? { text: message.text, ...(message.html ? { html: message.html } : {}) } : { html: message.html ?? "" };
  return {
    from: message.from,
    personalizations: message.to.map((recipient) => ({ to: [recipient], ...(message.customArgs ? { customArgs: message.customArgs } : {}) })),
    subject: message.subject,
    ...content,
    ...(message.attachments?.length
      ? {
          attachments: message.attachments.map((attachment) => ({
            filename: attachment.filename,
            type: attachment.contentType,
            disposition: attachment.disposition ?? "attachment",
            content: Buffer.from(attachment.content).toString("base64")
          }))
        }
      : {}),
    ...(message.scheduledAt ? { sendAt: Math.floor(message.scheduledAt.getTime() / 1000) } : {})
  } as MailDataRequired;
}

export class SendGridEmailAdapter implements EmailAdapter {
  private readonly client: SendGridClient;

  constructor(apiKey: string, client?: SendGridClient) {
    if (client) {
      this.client = client;
      return;
    }
    const mail = new MailService();
    mail.setApiKey(apiKey);
    this.client = mail;
  }

  async send(message: OutboundEmail): Promise<EmailSendResult> {
    try {
      const [response] = await this.client.send(toSendGridMailData(message));
      return {
        provider: "sendgrid",
        acceptedAt: new Date(),
        acceptedCount: message.to.length,
        messageId: messageIdFrom(response)
      };
    } catch (error) {
      console.error("SendGrid rejected an outbound CRM email", error instanceof Error ? error.name : "Unknown provider error");
      throw new EmailDeliveryError();
    }
  }
}
