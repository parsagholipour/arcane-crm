import "server-only";

import { AppAuthorizationError, assertOrganizationRecord, assertOrganizationUser } from "@/lib/organization-context";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const VIDEO_CALL_STATUSES = ["Scheduled", "In Progress", "Completed", "Cancelled"] as const;
export const VIDEO_CALL_PROVIDERS = ["External Link", "Zoom", "Google Meet", "Microsoft Teams", "Other"] as const;

export const videoCallInclude = {
  account: { select: { id: true, name: true } },
  contact: { select: { id: true, firstName: true, lastName: true, email: true } },
  opportunity: { select: { id: true, name: true } },
  participants: {
    include: { contact: { select: { id: true, firstName: true, lastName: true, email: true } } },
    orderBy: { createdAt: "asc" }
  }
} satisfies Prisma.VideoCallInclude;

export class VideoCallValidationError extends Error {
  constructor(
    message: string,
    readonly status = 400
  ) {
    super(message);
    this.name = "VideoCallValidationError";
  }
}

export function videoCallErrorResponse(error: unknown) {
  if (!(error instanceof VideoCallValidationError)) return null;
  return { error: error.message, status: error.status };
}

export function requireVideoProvider(value: unknown) {
  const provider = String(value ?? "External Link");
  if (!(VIDEO_CALL_PROVIDERS as readonly string[]).includes(provider))
    throw new VideoCallValidationError("Choose a valid video provider.");
  return provider;
}

export function validateWebUrl(value: unknown, label: string) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") throw new Error("invalid protocol");
    return url.toString();
  } catch {
    throw new VideoCallValidationError(`${label} must be a valid HTTPS URL.`);
  }
}

export function validateVideoDates(startValue: unknown, endValue: unknown) {
  const scheduledStartAt = new Date(String(startValue ?? ""));
  const scheduledEndAt = new Date(String(endValue ?? ""));
  if (!Number.isFinite(scheduledStartAt.getTime()) || !Number.isFinite(scheduledEndAt.getTime()))
    throw new VideoCallValidationError("Choose valid start and end times.");
  if (scheduledEndAt <= scheduledStartAt)
    throw new VideoCallValidationError("Video call end time must be after the start time.");
  return { scheduledStartAt, scheduledEndAt };
}

export async function validateVideoReferences(organizationId: string, userId: string, values: Record<string, unknown>) {
  const organizerId = String(values.organizerId ?? userId);
  await assertOrganizationUser(organizationId, organizerId);
  if (values.accountId) await assertOrganizationRecord(organizationId, "account", String(values.accountId));
  if (values.contactId) await assertOrganizationRecord(organizationId, "contact", String(values.contactId));
  if (values.opportunityId) await assertOrganizationRecord(organizationId, "opportunity", String(values.opportunityId));
  return organizerId;
}

export async function buildVideoParticipants(organizationId: string, participants: unknown) {
  if (!Array.isArray(participants)) return [];
  const values = participants.filter((item): item is Record<string, unknown> =>
    Boolean(item && typeof item === "object")
  );
  const contactIds = [...new Set(values.map((item) => String(item.contactId ?? "")).filter(Boolean))];
  const userIds = [...new Set(values.map((item) => String(item.userId ?? "")).filter(Boolean))];
  const [contacts, memberships] = await Promise.all([
    prisma.contact.findMany({
      where: { organizationId, id: { in: contactIds } },
      select: { id: true, firstName: true, lastName: true, email: true }
    }),
    prisma.organizationMembership.findMany({
      where: { organizationId, userId: { in: userIds }, status: "ACTIVE" },
      include: { user: true }
    })
  ]);
  if (contacts.length !== contactIds.length || memberships.length !== userIds.length)
    throw new AppAuthorizationError("One or more video-call participants were not found.", 404);
  const contactsById = new Map(contacts.map((contact) => [contact.id, contact]));
  const usersById = new Map(memberships.map((membership) => [membership.userId, membership.user]));
  return values.map((participant, index) => {
    const contactId = String(participant.contactId ?? "") || null;
    const userId = String(participant.userId ?? "") || null;
    const contact = contactId ? contactsById.get(contactId) : undefined;
    const user = userId ? usersById.get(userId) : undefined;
    const inferredName = [contact?.firstName, contact?.lastName].filter(Boolean).join(" ") || user?.name || "";
    const name = String(participant.name ?? inferredName).trim();
    if (!name) throw new VideoCallValidationError(`Participant ${index + 1} needs a name.`);
    return {
      organizationId,
      contactId,
      userId,
      name,
      email: String(participant.email ?? contact?.email ?? user?.email ?? "").trim() || null,
      role: String(participant.role ?? "Attendee"),
      attendance: String(participant.attendance ?? "Invited")
    };
  });
}

export async function findVideoCall(organizationId: string, id: string) {
  return prisma.videoCall.findFirst({ where: { id, organizationId }, include: videoCallInclude });
}

export async function requireVideoCall(organizationId: string, id: string) {
  const videoCall = await findVideoCall(organizationId, id);
  if (!videoCall) throw new AppAuthorizationError("Video call not found.", 404);
  return videoCall;
}

export async function createVideoCallNotification(
  organizationId: string,
  userId: string,
  title: string,
  body: string,
  id: string
) {
  return prisma.notification.create({
    data: { organizationId, userId, title, body, href: `/lightning/r/VideoCall/${id}/view`, category: "Activity" }
  });
}
