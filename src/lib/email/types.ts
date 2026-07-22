export type EmailAddress = {
  email: string;
  name?: string;
};

export type EmailAttachment = {
  filename: string;
  content: Uint8Array;
  contentType: string;
  disposition?: "attachment" | "inline";
};

export type OutboundEmail = {
  from: EmailAddress;
  to: EmailAddress[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
  scheduledAt?: Date;
  customArgs?: Record<string, string>;
};

export type EmailSendResult = {
  provider: string;
  acceptedAt: Date;
  acceptedCount: number;
  messageId?: string;
};

export interface EmailAdapter {
  send(message: OutboundEmail): Promise<EmailSendResult>;
}
