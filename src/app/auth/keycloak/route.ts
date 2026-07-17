import { AuthError } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { signIn } from "@/lib/auth";
import { safeCallbackUrl } from "@/lib/auth-sign-in";

export async function GET(request: NextRequest) {
  const redirectTo = safeCallbackUrl(request.nextUrl.searchParams.get("callbackUrl"), request.nextUrl.origin);
  try {
    await signIn("keycloak", { redirectTo });
    return NextResponse.redirect(new URL(redirectTo, request.url));
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.redirect(new URL(`/auth/error?error=${encodeURIComponent(error.type)}`, request.url));
    }
    throw error;
  }
}
