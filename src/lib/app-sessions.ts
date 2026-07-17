import "server-only";

import { prisma } from "@/lib/prisma";

const APP_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type AppSessionTouchResult = "active" | "revoked" | "unavailable";

function cutoff() {
  return new Date(Date.now() - APP_SESSION_TTL_MS);
}

function truncate(value: string | null | undefined, length: number) {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, length) : null;
}

export async function touchAppSession(input: {
  id: string;
  userId: string;
  keycloakSub: string;
  keycloakSessionId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<AppSessionTouchResult> {
  try {
    const now = new Date();
    const existing = await prisma.appSession.findUnique({ where: { id: input.id } });
    if (existing) {
      if (existing.userId !== input.userId || existing.revokedAt || existing.lastSeenAt < cutoff()) {
        if (!existing.revokedAt) {
          await prisma.appSession.update({ where: { id: input.id }, data: { revokedAt: now } });
        }
        return "revoked";
      }
      await prisma.appSession.update({
        where: { id: input.id },
        data: {
          keycloakSessionId: input.keycloakSessionId ?? null,
          ipAddress: truncate(input.ipAddress, 128),
          userAgent: truncate(input.userAgent, 512),
          lastSeenAt: now
        }
      });
      return "active";
    }

    await prisma.appSession.create({
      data: {
        id: input.id,
        userId: input.userId,
        keycloakSub: input.keycloakSub,
        keycloakSessionId: input.keycloakSessionId ?? null,
        ipAddress: truncate(input.ipAddress, 128),
        userAgent: truncate(input.userAgent, 512),
        lastSeenAt: now
      }
    });
    return "active";
  } catch (error) {
    console.warn("[auth] app-session registry unavailable", error);
    return "unavailable";
  }
}

export function listActiveAppSessions(userId: string) {
  return prisma.appSession.findMany({
    where: { userId, revokedAt: null, lastSeenAt: { gte: cutoff() } },
    orderBy: { lastSeenAt: "desc" }
  });
}

export async function revokeAppSession(id: string, userId?: string) {
  await prisma.appSession.updateMany({
    where: { id, ...(userId ? { userId } : {}), revokedAt: null },
    data: { revokedAt: new Date() }
  });
}

export async function revokeAllAppSessions(userId: string, exceptId?: string) {
  return prisma.appSession.updateMany({
    where: { userId, revokedAt: null, ...(exceptId ? { id: { not: exceptId } } : {}) },
    data: { revokedAt: new Date() }
  });
}
