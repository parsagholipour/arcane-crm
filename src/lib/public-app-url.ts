type PublicAppEnvironment = {
  AUTH_URL?: string;
  NODE_ENV?: string;
  PUBLIC_APP_URL?: string;
  RAILWAY_PUBLIC_DOMAIN?: string;
};

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function resolvePublicAppUrl(
  override?: string,
  environment: PublicAppEnvironment = process.env
) {
  const railwayUrl = environment.RAILWAY_PUBLIC_DOMAIN
    ? `https://${environment.RAILWAY_PUBLIC_DOMAIN.replace(/^https?:\/\//, "")}`
    : undefined;
  const candidate =
    override?.trim() ||
    environment.PUBLIC_APP_URL?.trim() ||
    railwayUrl ||
    environment.AUTH_URL?.trim() ||
    "http://localhost:3000";

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error("PUBLIC_APP_URL must be a valid absolute URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("PUBLIC_APP_URL must use http or https.");
  }
  if (environment.NODE_ENV === "production" && LOOPBACK_HOSTS.has(url.hostname)) {
    throw new Error("PUBLIC_APP_URL must use a public host in production.");
  }

  return url.origin;
}
