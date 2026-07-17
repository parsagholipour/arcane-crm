import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import authConfig, { isPublicAuthPath } from "./auth.config";
import { keycloakSignInPath } from "./lib/auth-sign-in";
import { isSuperAdminEmail } from "./lib/super-admin-constants";

const { auth } = NextAuth(authConfig);

export default auth((request) => {
  const pathname = request.nextUrl.pathname;
  if (!request.auth?.user && !isPublicAuthPath(pathname)) {
    return NextResponse.redirect(new URL(keycloakSignInPath(request.nextUrl.href), request.url));
  }

  if (pathname.startsWith("/super-admin") && request.auth?.user?.email && !isSuperAdminEmail(request.auth.user.email)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|ttf|otf|woff|woff2|eot)$).*)"]
};
