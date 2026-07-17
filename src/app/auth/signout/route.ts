import { auth, signOut } from "@/lib/auth";
import { revokeAppSession } from "@/lib/app-sessions";
import { deleteKeycloakSession } from "@/lib/keycloak-admin";

async function logout() {
  const session = await auth();
  if (session?.appSessionId) {
    await revokeAppSession(session.appSessionId, session.user?.id).catch((error) => console.warn("Unable to revoke app session", error));
  }
  if (session?.keycloakSessionId) {
    await deleteKeycloakSession(session.keycloakSessionId).catch((error) => console.warn("Unable to revoke Keycloak session", error));
  }
  await signOut({ redirectTo: "/auth/signed-out" });
}

export async function GET() {
  return logout();
}

export async function POST() {
  return logout();
}
