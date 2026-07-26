import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listActiveAppSessions, revokeAllAppSessions, revokeAppSession } from "@/lib/app-sessions";
import { deleteKeycloakSession, listKeycloakSessions } from "@/lib/keycloak-admin";
import { authorizationErrorResponse, requireAuthenticatedUser } from "@/lib/organization-context";

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    const session = await auth();
    const [appSessions, keycloakSessions] = await Promise.all([
      listActiveAppSessions(user.id),
      user.keycloakSub ? listKeycloakSessions(user.keycloakSub).catch(() => []) : Promise.resolve([])
    ]);
    return NextResponse.json({
      appSessions: appSessions.map((row) => ({ ...row, current: row.id === session?.appSessionId })),
      keycloakSessions: keycloakSessions.map((row) => ({ ...row, current: row.id === session?.keycloakSessionId }))
    });
  } catch (error) {
    return (
      authorizationErrorResponse(error) ?? NextResponse.json({ error: "Unable to list sessions." }, { status: 500 })
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const current = await auth();
    const payload = (await request.json()) as { action?: string; source?: string; sessionId?: string };
    if (payload.action === "logout-others") {
      await revokeAllAppSessions(user.id, current?.appSessionId ?? undefined);
      const sessions = user.keycloakSub ? await listKeycloakSessions(user.keycloakSub).catch(() => []) : [];
      await Promise.all(
        sessions
          .filter((row) => row.id !== current?.keycloakSessionId)
          .map((row) => deleteKeycloakSession(row.id).catch(() => undefined))
      );
      return NextResponse.json({ ok: true });
    }
    if (payload.action !== "revoke" || !payload.sessionId)
      return NextResponse.json({ error: "Invalid session action." }, { status: 400 });
    if (payload.source === "app") {
      if (payload.sessionId === current?.appSessionId)
        return NextResponse.json({ error: "Use sign out for the current session." }, { status: 400 });
      await revokeAppSession(payload.sessionId, user.id);
    } else if (payload.source === "keycloak") {
      if (payload.sessionId === current?.keycloakSessionId)
        return NextResponse.json({ error: "Use sign out for the current session." }, { status: 400 });
      const owned = user.keycloakSub
        ? (await listKeycloakSessions(user.keycloakSub)).some((row) => row.id === payload.sessionId)
        : false;
      if (!owned) return NextResponse.json({ error: "Session not found." }, { status: 404 });
      await deleteKeycloakSession(payload.sessionId);
    } else {
      return NextResponse.json({ error: "Invalid session source." }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return (
      authorizationErrorResponse(error) ?? NextResponse.json({ error: "Unable to update sessions." }, { status: 500 })
    );
  }
}
