export function keycloakSignInPath(callbackUrl: string) {
  return `/auth/keycloak?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}

export function safeCallbackUrl(raw: string | null, origin: string) {
  if (!raw) return "/";
  try {
    const candidate = new URL(raw, origin);
    return candidate.origin === origin ? `${candidate.pathname}${candidate.search}${candidate.hash}` : "/";
  } catch {
    return "/";
  }
}
