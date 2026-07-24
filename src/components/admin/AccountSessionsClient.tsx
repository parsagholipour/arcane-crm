"use client";

import { useEffect, useState } from "react";

type AppSessionRow = { id: string; ipAddress: string | null; userAgent: string | null; createdAt: string; lastSeenAt: string; current: boolean };
type KeycloakSessionRow = { id: string; ipAddress?: string; start?: number; lastAccess?: number; current: boolean; clients?: Record<string, string> };

export function AccountSessionsClient() {
  const [appSessions, setAppSessions] = useState<AppSessionRow[]>([]);
  const [keycloakSessions, setKeycloakSessions] = useState<KeycloakSessionRow[]>([]);
  const [message, setMessage] = useState("Loading sessions...");

  async function load() {
    const response = await fetch("/api/account/sessions", { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(payload.error ?? "Unable to load sessions.");
    setAppSessions(payload.appSessions ?? []);
    setKeycloakSessions(payload.keycloakSessions ?? []);
    setMessage("");
  }

  useEffect(() => { void load(); }, []);

  async function action(body: Record<string, string>) {
    const response = await fetch("/api/account/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Session access updated." : payload.error ?? "Unable to update sessions.");
    if (response.ok) await load();
  }

  return (
    <div className="space-y-5">
      {message && <div className="rounded border border-[#9ac3e8] bg-[#eef4ff] p-3 text-sm">{message}</div>}
      <button className="rounded bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700" onClick={() => void action({ action: "logout-others" })}>Log out other sessions</button>
      <SessionTable title="Application sessions" rows={appSessions.map((row) => ({ id: row.id, current: row.current, primary: row.userAgent || "Unknown browser", secondary: `${row.ipAddress || "Unknown IP"} · Last seen ${new Date(row.lastSeenAt).toLocaleString()}`, source: "app" }))} onRevoke={action} />
      <SessionTable title="Keycloak sessions" rows={keycloakSessions.map((row) => ({ id: row.id, current: row.current, primary: Object.values(row.clients ?? {}).join(", ") || "Keycloak session", secondary: `${row.ipAddress || "Unknown IP"}${row.lastAccess ? ` · Last seen ${new Date(row.lastAccess).toLocaleString()}` : ""}`, source: "keycloak" }))} onRevoke={action} />
    </div>
  );
}

function SessionTable({ title, rows, onRevoke }: { title: string; rows: Array<{ id: string; current: boolean; primary: string; secondary: string; source: string }>; onRevoke: (body: Record<string, string>) => void }) {
  return (
    <section className="overflow-hidden rounded border border-[#d8dde6] bg-white shadow-sm">
      <h2 className="border-b bg-[#f3f3f3] p-3 font-semibold">{title}</h2>
      {rows.map((row) => <div key={row.id} className="flex items-center gap-3 border-b p-3 last:border-b-0"><div className="min-w-0 flex-1"><div className="font-medium">{row.primary} {row.current && <span className="ml-2 rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">Current</span>}</div><div className="truncate text-xs text-[#706e6b]">{row.secondary}</div></div>{!row.current && <button className="rounded border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-700" onClick={() => onRevoke({ action: "revoke", source: row.source, sessionId: row.id })}>Revoke</button>}</div>)}
      {rows.length === 0 && <div className="p-5 text-sm text-[#706e6b]">No active sessions reported.</div>}
    </section>
  );
}
