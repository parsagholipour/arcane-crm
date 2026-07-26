import type { NextAuthConfig } from "next-auth";
import Keycloak from "next-auth/providers/keycloak";

export function isPublicAuthPath(pathname: string) {
  return (
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/knowledge/") ||
    pathname.startsWith("/forms/") ||
    pathname === "/no-organization"
  );
}

export default {
  providers: [
    Keycloak({
      clientId: process.env.AUTH_KEYCLOAK_ID,
      clientSecret: process.env.AUTH_KEYCLOAK_SECRET,
      issuer: process.env.AUTH_KEYCLOAK_ISSUER
    })
  ],
  trustHost: true,
  pages: { error: "/auth/error" },
  callbacks: {
    session({ session, token }) {
      if (token.forceSignOut) {
        session.forceSignOut = true;
        delete (session as { user?: unknown }).user;
      }
      return session;
    }
  }
} satisfies NextAuthConfig;
