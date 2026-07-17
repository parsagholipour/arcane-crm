import type { NextAuthConfig } from "next-auth";
import Keycloak from "next-auth/providers/keycloak";
import { NextResponse } from "next/server";

export function isPublicAuthPath(pathname: string) {
  return pathname.startsWith("/auth/") || pathname === "/no-organization";
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
    },
    authorized({ auth, request }) {
      if (isPublicAuthPath(request.nextUrl.pathname)) return true;
      if (auth?.forceSignOut) {
        return NextResponse.redirect(new URL("/auth/signout", request.nextUrl.origin));
      }
      return Boolean(auth?.user);
    }
  }
} satisfies NextAuthConfig;
