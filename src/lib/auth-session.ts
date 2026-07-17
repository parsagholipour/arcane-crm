import type { JWT } from "next-auth/jwt";

export function markForceSignOut(token: JWT) {
  token.forceSignOut = true;
}

export function clearForceSignOut(token: JWT) {
  delete token.forceSignOut;
}
