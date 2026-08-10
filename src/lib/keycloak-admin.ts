import "server-only";

import { splitDisplayName } from "@/lib/auth-display-name";
import { resolvePublicAppUrl } from "@/lib/public-app-url";
import { normalizeEmail } from "@/lib/super-admin-constants";

type KeycloakLocation = {
  baseUrl: string;
  realm: string;
  tokenUrl: string;
  adminBaseUrl: string;
};

type KeycloakUser = {
  id?: string;
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled?: boolean;
  emailVerified?: boolean;
};

export type KeycloakSession = {
  id: string;
  ipAddress?: string;
  start?: number;
  lastAccess?: number;
  clients?: Record<string, string>;
};

export class KeycloakAdminError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "KeycloakAdminError";
  }
}

function location(): KeycloakLocation {
  const issuer = process.env.AUTH_KEYCLOAK_ISSUER?.replace(/\/$/, "");
  if (!issuer) throw new KeycloakAdminError("AUTH_KEYCLOAK_ISSUER is not configured.");
  const marker = "/realms/";
  const markerIndex = issuer.lastIndexOf(marker);
  if (markerIndex < 1) throw new KeycloakAdminError("AUTH_KEYCLOAK_ISSUER must include /realms/{realm}.");
  const baseUrl = issuer.slice(0, markerIndex);
  const realm = decodeURIComponent(issuer.slice(markerIndex + marker.length));
  return {
    baseUrl,
    realm,
    tokenUrl: `${issuer}/protocol/openid-connect/token`,
    adminBaseUrl: `${baseUrl}/admin/realms/${encodeURIComponent(realm)}`
  };
}

export function isKeycloakAdminConfigured() {
  return Boolean(
    process.env.AUTH_KEYCLOAK_ISSUER &&
    process.env.AUTH_KEYCLOAK_ADMIN_CLIENT_ID &&
    process.env.AUTH_KEYCLOAK_ADMIN_CLIENT_SECRET
  );
}

async function adminToken(config: KeycloakLocation) {
  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.AUTH_KEYCLOAK_ADMIN_CLIENT_ID ?? "",
      client_secret: process.env.AUTH_KEYCLOAK_ADMIN_CLIENT_SECRET ?? ""
    }),
    cache: "no-store"
  });
  if (!response.ok)
    throw new KeycloakAdminError("Unable to authenticate the Keycloak Admin API client.", response.status);
  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) throw new KeycloakAdminError("Keycloak Admin API returned no access token.");
  return payload.access_token;
}

async function adminFetch(path: string, init: RequestInit = {}) {
  const config = location();
  const token = await adminToken(config);
  const response = await fetch(`${config.adminBaseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers
    },
    cache: "no-store"
  });
  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new KeycloakAdminError(
      `Keycloak Admin API request failed${details ? `: ${details.slice(0, 300)}` : "."}`,
      response.status
    );
  }
  return response;
}

export async function findKeycloakUserByEmail(email: string) {
  const normalized = normalizeEmail(email);
  const response = await adminFetch(`/users?email=${encodeURIComponent(normalized)}&exact=true&max=20`);
  const rows = (await response.json()) as KeycloakUser[];
  return rows.find((row) => normalizeEmail(row.email) === normalized) ?? null;
}

export async function provisionKeycloakUser(input: { email: string; name: string }) {
  const email = normalizeEmail(input.email);
  const { firstName, lastName } = splitDisplayName(input.name);
  const existing = await findKeycloakUserByEmail(email);
  if (existing?.id) {
    if (!existing.firstName?.trim() && firstName) {
      await updateKeycloakIdentity(existing.id, { email, name: input.name });
      return { id: existing.id, created: false, user: { ...existing, firstName, lastName, email } };
    }
    return { id: existing.id, created: false, user: existing };
  }

  const response = await adminFetch("/users", {
    method: "POST",
    body: JSON.stringify({
      username: email,
      email,
      firstName,
      lastName: lastName || undefined,
      enabled: true,
      emailVerified: false,
      requiredActions: ["VERIFY_EMAIL", "UPDATE_PASSWORD"]
    })
  });
  const locationHeader = response.headers.get("location");
  const id = locationHeader?.split("/").filter(Boolean).pop() ?? (await findKeycloakUserByEmail(email))?.id;
  if (!id) throw new KeycloakAdminError("Keycloak created the user but returned no user ID.");
  return { id, created: true, user: { id, email, firstName, lastName, enabled: true } };
}

export async function updateKeycloakIdentity(id: string, input: { email: string; name: string }) {
  const email = normalizeEmail(input.email);
  const { firstName, lastName } = splitDisplayName(input.name);
  const currentResponse = await adminFetch(`/users/${encodeURIComponent(id)}`);
  const current = (await currentResponse.json()) as KeycloakUser & { access?: unknown };
  const { access: _access, ...writable } = current;
  void _access;
  await adminFetch(`/users/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({
      ...writable,
      email,
      firstName,
      lastName
    })
  });
}

export async function setKeycloakUserEnabled(id: string, enabled: boolean) {
  await adminFetch(`/users/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({ enabled })
  });
}

export async function sendKeycloakActionsEmail(
  id: string,
  actions: Array<"VERIFY_EMAIL" | "UPDATE_PASSWORD">,
  callbackPath = "/lightning/page/home"
) {
  const config = location();
  const lifespan = Number(process.env.KEYCLOAK_INVITE_LIFESPAN_SECONDS ?? 86400);
  const returnUrl = `${resolvePublicAppUrl()}/auth/keycloak?callbackUrl=${encodeURIComponent(callbackPath)}`;
  const query = new URLSearchParams({
    client_id: process.env.AUTH_KEYCLOAK_ID ?? "",
    redirect_uri: returnUrl,
    lifespan: String(Number.isFinite(lifespan) && lifespan > 0 ? Math.floor(lifespan) : 86400)
  });
  void config;
  await adminFetch(`/users/${encodeURIComponent(id)}/execute-actions-email?${query}`, {
    method: "PUT",
    body: JSON.stringify(actions)
  });
}

export async function listKeycloakSessions(userId: string) {
  const response = await adminFetch(`/users/${encodeURIComponent(userId)}/sessions`);
  return (await response.json()) as KeycloakSession[];
}

export async function deleteKeycloakSession(sessionId: string) {
  await adminFetch(`/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
}

export async function deleteKeycloakUser(userId: string) {
  await adminFetch(`/users/${encodeURIComponent(userId)}`, { method: "DELETE" });
}
