import "server-only";

import { randomUUID } from "node:crypto";
import NextAuth from "next-auth";
import type { JWT } from "next-auth/jwt";
import { headers } from "next/headers";
import authConfig from "@/auth.config";
import { clearForceSignOut, markForceSignOut } from "@/lib/auth-session";
import { touchAppSession } from "@/lib/app-sessions";
import { prisma } from "@/lib/prisma";
import { isSuperAdminEmail, normalizeEmail } from "@/lib/super-admin-constants";

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function stringClaim(value: unknown, keys: string[]) {
  const source = record(value);
  for (const key of keys) {
    const claim = source?.[key];
    if (typeof claim === "string" && claim.trim()) return claim.trim();
  }
  return null;
}

function decodedJwtClaim(value: unknown, keys: string[]) {
  if (typeof value !== "string") return null;
  try {
    const payload = JSON.parse(Buffer.from(value.split(".")[1] ?? "", "base64url").toString("utf8"));
    return stringClaim(payload, keys);
  } catch {
    return null;
  }
}

function keycloakSessionId(profile: unknown, account: unknown) {
  const accountRecord = record(account);
  return (
    stringClaim(profile, ["sid", "session_state"]) ??
    stringClaim(account, ["session_state"]) ??
    decodedJwtClaim(accountRecord?.id_token, ["sid", "session_state"]) ??
    decodedJwtClaim(accountRecord?.access_token, ["sid", "session_state"])
  );
}

function profileEmail(profile: unknown) {
  return normalizeEmail(stringClaim(profile, ["email"]));
}

function profileName(profile: unknown, email: string) {
  return stringClaim(profile, ["name", "preferred_username"]) ?? email.split("@")[0] ?? "Reloriq User";
}

function aliasFrom(name: string, email: string) {
  const compact = name.replace(/[^a-z0-9]/gi, "");
  return (compact || email.split("@")[0] || "User").slice(0, 8);
}

async function resolveLoginUser(sub: string, profile: unknown) {
  const email = profileEmail(profile);
  if (!email) return null;
  const name = profileName(profile, email);
  const bySub = await prisma.user.findUnique({ where: { keycloakSub: sub } });
  const byEmail = bySub ? null : await prisma.user.findUnique({ where: { email } });
  const existing = bySub ?? byEmail;

  if (!existing) {
    if (!isSuperAdminEmail(email)) return null;
    return prisma.user.create({
      data: { keycloakSub: sub, email, name, alias: aliasFrom(name, email), status: "ACTIVE", lastLoginAt: new Date() }
    });
  }

  if (existing.status === "SUSPENDED") return null;
  return prisma.user.update({
    where: { id: existing.id },
    data: { keycloakSub: sub, email, name, lastLoginAt: new Date() }
  });
}

async function resolveTokenUser(token: JWT, sub: string | null) {
  if (typeof token.appUserId === "string") {
    const byId = await prisma.user.findUnique({ where: { id: token.appUserId } });
    if (byId) return byId;
    delete token.appUserId;
  }
  if (!sub) return null;
  return prisma.user.findUnique({ where: { keycloakSub: sub } });
}

async function requestMetadata() {
  try {
    const values = await headers();
    return {
      ipAddress: values.get("x-forwarded-for")?.split(",")[0]?.trim() ?? values.get("x-real-ip"),
      userAgent: values.get("user-agent")
    };
  } catch {
    return { ipAddress: null, userAgent: null };
  }
}

function applyUser(token: JWT, user: { id: string; email: string | null; status: "ACTIVE" | "SUSPENDED" }) {
  token.appUserId = user.id;
  token.userStatus = user.status;
  token.isSuperAdmin = isSuperAdminEmail(user.email);
}

async function registerSession(token: JWT, user: { id: string; keycloakSub: string | null }) {
  if (!user.keycloakSub) return "revoked" as const;
  if (typeof token.appSessionId !== "string") token.appSessionId = randomUUID();
  const metadata = await requestMetadata();
  return touchAppSession({
    id: token.appSessionId,
    userId: user.id,
    keycloakSub: user.keycloakSub,
    keycloakSessionId: typeof token.keycloakSessionId === "string" ? token.keycloakSessionId : null,
    ...metadata
  });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ account, profile }) {
      if (account?.provider !== "keycloak" || typeof profile?.sub !== "string") return false;
      try {
        return Boolean(await resolveLoginUser(profile.sub, profile));
      } catch (error) {
        console.error("[auth] Keycloak user synchronization failed", error);
        return false;
      }
    },
    async jwt({ token, account, profile }) {
      const initialSub = account?.provider === "keycloak" && typeof profile?.sub === "string" ? profile.sub : null;
      const sub = initialSub ?? (typeof token.sub === "string" ? token.sub : null);
      if (initialSub) {
        token.appSessionId = randomUUID();
        token.keycloakSessionId = keycloakSessionId(profile, account);
      }

      try {
        const user = await resolveTokenUser(token, sub);
        if (!user || user.status !== "ACTIVE" || !user.keycloakSub) {
          markForceSignOut(token);
          return token;
        }
        applyUser(token, user);
        const sessionState = await registerSession(token, user);
        if (sessionState !== "active") markForceSignOut(token);
        else clearForceSignOut(token);
      } catch (error) {
        console.error("[auth] application identity resolution failed", error);
        markForceSignOut(token);
      }
      return token;
    },
    async session({ session, token }) {
      session.appSessionId = typeof token.appSessionId === "string" ? token.appSessionId : null;
      session.keycloakSessionId = typeof token.keycloakSessionId === "string" ? token.keycloakSessionId : null;
      if (token.forceSignOut || !session.user || typeof token.appUserId !== "string") {
        session.forceSignOut = true;
        delete (session as { user?: unknown }).user;
        return session;
      }

      try {
        const user = await prisma.user.findUnique({ where: { id: token.appUserId } });
        if (!user || user.status !== "ACTIVE") {
          session.forceSignOut = true;
          delete (session as { user?: unknown }).user;
          return session;
        }
        session.user.id = user.id;
        session.user.name = user.name;
        session.user.email = user.email ?? "";
        session.user.image = user.avatarUrl;
        session.user.status = user.status;
        session.user.isSuperAdmin = isSuperAdminEmail(user.email);
      } catch (error) {
        console.error("[auth] session materialization failed", error);
        session.forceSignOut = true;
        delete (session as { user?: unknown }).user;
      }
      return session;
    }
  }
});
