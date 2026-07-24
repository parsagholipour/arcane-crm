import { pathToFileURL } from "node:url";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

export function desiredSmtpConfig(environment) {
  return {
    host: "smtp.sendgrid.net",
    port: "587",
    from: String(environment.SENDGRID_EMAIL ?? "").trim(),
    fromDisplayName: "Reloriq",
    replyTo: String(environment.SENDGRID_EMAIL ?? "").trim(),
    replyToDisplayName: "Reloriq",
    auth: "true",
    user: "apikey",
    password: String(environment.SENDGRID_API_KEY ?? "").trim(),
    starttls: "true",
    ssl: "false"
  };
}

export function validateEmailEnvironment(environment) {
  const required = [
    "AUTH_KEYCLOAK_ISSUER",
    "SENDGRID_API_KEY",
    "SENDGRID_EMAIL"
  ];
  const missing = required.filter((key) => !String(environment[key] ?? "").trim());
  if (!String(environment.KEYCLOAK_REALM_ADMIN_CLIENT_ID || environment.AUTH_KEYCLOAK_ADMIN_CLIENT_ID || "").trim()) {
    missing.push("KEYCLOAK_REALM_ADMIN_CLIENT_ID or AUTH_KEYCLOAK_ADMIN_CLIENT_ID");
  }
  if (!String(environment.KEYCLOAK_REALM_ADMIN_CLIENT_SECRET || environment.AUTH_KEYCLOAK_ADMIN_CLIENT_SECRET || "").trim()) {
    missing.push("KEYCLOAK_REALM_ADMIN_CLIENT_SECRET or AUTH_KEYCLOAK_ADMIN_CLIENT_SECRET");
  }
  if (missing.length) throw new Error(`Missing required configuration: ${missing.join(", ")}`);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(environment.SENDGRID_EMAIL))) {
    throw new Error("SENDGRID_EMAIL must be a valid email address.");
  }
}

function keycloakLocation(environment) {
  const issuer = String(environment.AUTH_KEYCLOAK_ISSUER).replace(/\/$/, "");
  const marker = "/realms/";
  const markerIndex = issuer.lastIndexOf(marker);
  if (markerIndex < 1) throw new Error("AUTH_KEYCLOAK_ISSUER must include /realms/{realm}.");
  return {
    issuer,
    baseUrl: issuer.slice(0, markerIndex),
    realm: decodeURIComponent(issuer.slice(markerIndex + marker.length))
  };
}

async function adminToken(environment, location) {
  const clientId = environment.KEYCLOAK_REALM_ADMIN_CLIENT_ID || environment.AUTH_KEYCLOAK_ADMIN_CLIENT_ID;
  const clientSecret = environment.KEYCLOAK_REALM_ADMIN_CLIENT_SECRET || environment.AUTH_KEYCLOAK_ADMIN_CLIENT_SECRET;
  const response = await fetch(`${location.issuer}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret
    })
  });
  if (!response.ok) throw new Error(`Unable to authenticate the Keycloak Admin API client (HTTP ${response.status}).`);
  const payload = await response.json();
  if (!payload.access_token) throw new Error("Keycloak returned no admin access token.");
  return payload.access_token;
}

async function realmRequest(environment, method = "GET", body) {
  const location = keycloakLocation(environment);
  const token = await adminToken(environment, location);
  const response = await fetch(`${location.baseUrl}/admin/realms/${encodeURIComponent(location.realm)}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  if (!response.ok) {
    if (response.status === 403 && method === "PUT") {
      throw new Error("Keycloak denied the SMTP update. The configuration service account must have the realm-management manage-realm role.");
    }
    throw new Error(`Keycloak realm request failed (HTTP ${response.status}).`);
  }
  return method === "GET" ? response.json() : null;
}

export function smtpConfigMatches(actual, desired) {
  const expectedKeys = ["host", "port", "from", "fromDisplayName", "replyTo", "replyToDisplayName", "auth", "user", "starttls", "ssl"];
  return expectedKeys.every((key) => String(actual?.[key] ?? "") === String(desired[key]))
    && Boolean(actual?.password);
}

async function verifiedSenderStatus(environment) {
  const response = await fetch("https://api.sendgrid.com/v3/verified_senders", {
    headers: { Authorization: `Bearer ${environment.SENDGRID_API_KEY}` }
  });
  if (!response.ok) return { apiStatus: response.status, configuredSenderVerified: false };
  const payload = await response.json();
  const configured = environment.SENDGRID_EMAIL.trim().toLowerCase();
  const senders = Array.isArray(payload.results) ? payload.results : [];
  const match = senders.find((sender) => String(sender.from_email ?? "").trim().toLowerCase() === configured);
  return { apiStatus: response.status, configuredSenderVerified: Boolean(match?.verified) };
}

export async function checkKeycloakEmailConfiguration(environment) {
  validateEmailEnvironment(environment);
  const [realm, sender] = await Promise.all([realmRequest(environment), verifiedSenderStatus(environment)]);
  const smtp = desiredSmtpConfig(environment);
  return {
    realmSmtpConfigured: smtpConfigMatches(realm.smtpServer, smtp),
    sendGridApiStatus: sender.apiStatus,
    configuredSenderVerified: sender.configuredSenderVerified
  };
}

export async function configureKeycloakEmail(environment) {
  validateEmailEnvironment(environment);
  const realm = await realmRequest(environment);
  await realmRequest(environment, "PUT", { ...realm, smtpServer: desiredSmtpConfig(environment) });
  return checkKeycloakEmailConfiguration(environment);
}

async function main() {
  loadEnvConfig(process.cwd());
  const checkOnly = process.argv.includes("--check");
  const result = checkOnly
    ? await checkKeycloakEmailConfiguration(process.env)
    : await configureKeycloakEmail(process.env);
  console.log(JSON.stringify({ mode: checkOnly ? "check" : "configure", ...result }, null, 2));
  if (!result.realmSmtpConfigured || !result.configuredSenderVerified) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Keycloak email configuration failed.");
    process.exitCode = 1;
  });
}
