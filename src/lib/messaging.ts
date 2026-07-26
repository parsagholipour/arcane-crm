import "server-only";

import { AppAuthorizationError, assertOrganizationRecord, assertOrganizationUser } from "@/lib/organization-context";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const MESSAGING_CHANNELS = ["Web Chat", "Email", "SMS", "WhatsApp", "Social", "Other"] as const;
export const MESSAGING_STATUSES = ["Open", "Waiting", "Closed"] as const;

export const messagingSessionInclude = {
  account: { select: { id: true, name: true } },
  contact: { select: { id: true, firstName: true, lastName: true, email: true } },
  participants: {
    include: { contact: { select: { id: true, firstName: true, lastName: true, email: true } } },
    orderBy: { joinedAt: "asc" }
  },
  messages: { orderBy: { sentAt: "asc" } }
} satisfies Prisma.MessagingSessionInclude;

export class MessagingValidationError extends Error {
  constructor(
    message: string,
    readonly status = 400
  ) {
    super(message);
    this.name = "MessagingValidationError";
  }
}

export function messagingErrorResponse(error: unknown) {
  if (!(error instanceof MessagingValidationError)) return null;
  return { error: error.message, status: error.status };
}

export function requireMessagingChannel(value: unknown) {
  const channel = String(value ?? "Web Chat");
  if (!(MESSAGING_CHANNELS as readonly string[]).includes(channel))
    throw new MessagingValidationError("Choose a valid messaging channel.");
  return channel;
}

export function requireMessagingStatus(value: unknown) {
  const status = String(value ?? "Open");
  if (!(MESSAGING_STATUSES as readonly string[]).includes(status))
    throw new MessagingValidationError("Choose a valid messaging status.");
  return status;
}

export async function validateMessagingReferences(
  organizationId: string,
  userId: string,
  values: Record<string, unknown>
) {
  const ownerId = String(values.ownerId ?? userId);
  await assertOrganizationUser(organizationId, ownerId);
  if (values.accountId) await assertOrganizationRecord(organizationId, "account", String(values.accountId));
  if (values.contactId) await assertOrganizationRecord(organizationId, "contact", String(values.contactId));
  const contactIds = Array.isArray(values.participants)
    ? values.participants
        .map((participant) =>
          participant && typeof participant === "object"
            ? String((participant as Record<string, unknown>).contactId ?? "")
            : ""
        )
        .filter(Boolean)
    : [];
  const uniqueIds = [...new Set(contactIds)];
  if (uniqueIds.length) {
    const count = await prisma.contact.count({ where: { organizationId, id: { in: uniqueIds } } });
    if (count !== uniqueIds.length)
      throw new AppAuthorizationError("One or more messaging participants were not found.", 404);
  }
  return ownerId;
}

export async function buildMessagingParticipants(organizationId: string, participants: unknown) {
  if (!Array.isArray(participants)) return [];
  const values = participants.filter((item): item is Record<string, unknown> =>
    Boolean(item && typeof item === "object")
  );
  const contactIds = [...new Set(values.map((item) => String(item.contactId ?? "")).filter(Boolean))];
  const contacts = await prisma.contact.findMany({
    where: { organizationId, id: { in: contactIds } },
    select: { id: true, firstName: true, lastName: true, email: true }
  });
  const contactsById = new Map(contacts.map((contact) => [contact.id, contact]));
  return values.map((participant, index) => {
    const contactId = String(participant.contactId ?? "") || null;
    const contact = contactId ? contactsById.get(contactId) : undefined;
    const name = String(participant.name ?? [contact?.firstName, contact?.lastName].filter(Boolean).join(" ")).trim();
    if (!name) throw new MessagingValidationError(`Participant ${index + 1} needs a name.`);
    return {
      organizationId,
      contactId,
      name,
      address: String(participant.address ?? contact?.email ?? "").trim() || null,
      role: String(participant.role ?? "Customer")
    };
  });
}

export async function findMessagingSession(organizationId: string, id: string) {
  return prisma.messagingSession.findFirst({ where: { id, organizationId }, include: messagingSessionInclude });
}

export async function requireMessagingSession(organizationId: string, id: string) {
  const session = await findMessagingSession(organizationId, id);
  if (!session) throw new AppAuthorizationError("Messaging session not found.", 404);
  return session;
}

export async function createMessagingNotification(
  organizationId: string,
  userId: string,
  title: string,
  body: string,
  id: string
) {
  return prisma.notification.create({
    data: {
      organizationId,
      userId,
      title,
      body,
      href: `/lightning/r/MessagingSession/${id}/view`,
      category: "Activity"
    }
  });
}
