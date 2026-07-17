import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    forceSignOut?: boolean;
    appSessionId?: string | null;
    keycloakSessionId?: string | null;
    user: DefaultSession["user"] & {
      id: string;
      status: "ACTIVE" | "SUSPENDED";
      isSuperAdmin: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    appUserId?: string;
    userStatus?: "ACTIVE" | "SUSPENDED";
    isSuperAdmin?: boolean;
    appSessionId?: string | null;
    keycloakSessionId?: string | null;
    forceSignOut?: boolean;
  }
}
