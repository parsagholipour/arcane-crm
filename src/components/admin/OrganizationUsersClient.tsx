"use client";

import { useState } from "react";

type Membership = {
  id: string;
  role: "ADMIN" | "MEMBER";
  status: "ACTIVE" | "SUSPENDED";
  inviteSentAt: string | null;
  invitationDelivery: {
    status: string;
    acceptedAt: string;
    lastReason: string | null;
  } | null;
  user: { id: string; name: string; email: string | null; status: "ACTIVE" | "SUSPENDED"; lastLoginAt: string | null };
};

const inputClass = "h-9 rounded border border-[#c9c9c9] bg-white px-3 text-sm outline-none focus:border-brand-500";
const buttonClass = "inline-flex h-9 items-center justify-center rounded border border-brand-600 bg-white px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50";

export function OrganizationUsersClient({ initialMemberships }: { initialMemberships: Membership[] }) {
  const [memberships, setMemberships] = useState(initialMemberships);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function request(path: string, init: RequestInit) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...init.headers } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "The operation could not be completed.");
      return payload;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The operation could not be completed.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function invite(formData: FormData) {
    const payload = await request("/api/organization/members", {
      method: "POST",
      body: JSON.stringify({ name: formData.get("name"), email: formData.get("email"), role: formData.get("role") })
    });
    if (!payload?.membership) return;
    const membership = { ...payload.membership, invitationDelivery: payload.invitationDelivery };
    setMemberships((current) => [...current.filter((row) => row.id !== membership.id), membership]);
    setMessage(payload.warning ?? "Organization invitation sent.");
  }

  async function update(membership: Membership, role: Membership["role"], status: Membership["status"]) {
    const payload = await request(`/api/organization/members/${membership.id}`, { method: "PATCH", body: JSON.stringify({ role, status }) });
    if (!payload?.membership) return;
    setMemberships((current) => current.map((row) => row.id === membership.id
      ? { ...payload.membership, invitationDelivery: row.invitationDelivery }
      : row));
    setMessage("Membership updated.");
  }

  async function remove(membership: Membership) {
    if (!window.confirm(`Remove ${membership.user.name} from this organization?`)) return;
    const payload = await request(`/api/organization/members/${membership.id}`, { method: "DELETE" });
    if (!payload?.ok) return;
    setMemberships((current) => current.filter((row) => row.id !== membership.id));
    setMessage("Membership removed.");
  }

  async function resend(membership: Membership) {
    const payload = await request(`/api/organization/members/${membership.id}/invitation`, { method: "POST" });
    if (!payload?.membership) return;
    const updated = { ...payload.membership, invitationDelivery: payload.invitationDelivery };
    setMemberships((current) => current.map((row) => row.id === membership.id ? updated : row));
    setMessage("Organization invitation resent.");
  }

  return (
    <div className="space-y-5">
      {message && <div className="rounded border border-[#9ac3e8] bg-[#eef4ff] p-3 text-sm">{message}</div>}
      <section className="rounded border border-[#d8dde6] bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Invite user</h2>
        <form action={invite} className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_180px_auto]">
          <input className={inputClass} name="name" placeholder="Full name" required />
          <input className={inputClass} name="email" type="email" placeholder="user@example.com" required />
          <select className={inputClass} name="role"><option value="MEMBER">Member</option><option value="ADMIN">Administrator</option></select>
          <button className={buttonClass} disabled={busy}>Invite or add</button>
        </form>
        <p className="mt-2 text-xs text-[#706e6b]">Every membership receives an organization invitation. New identities also receive a separate Keycloak setup email.</p>
      </section>

      <section className="overflow-hidden rounded border border-[#d8dde6] bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#f3f3f3] text-xs uppercase text-[#706e6b]"><tr><th className="p-3">User</th><th className="p-3">Global status</th><th className="p-3">Organization access</th><th className="p-3">Invitation</th><th className="p-3">Actions</th></tr></thead>
          <tbody>{memberships.map((membership) => (
            <MembershipRow key={membership.id} membership={membership} busy={busy} onUpdate={update} onRemove={remove} onResend={resend} />
          ))}</tbody>
        </table>
        {memberships.length === 0 && <div className="p-8 text-center text-sm text-[#706e6b]">No users belong to this organization.</div>}
      </section>
    </div>
  );
}

function MembershipRow({ membership, busy, onUpdate, onRemove, onResend }: {
  membership: Membership;
  busy: boolean;
  onUpdate: (membership: Membership, role: Membership["role"], status: Membership["status"]) => void;
  onRemove: (membership: Membership) => void;
  onResend: (membership: Membership) => void;
}) {
  const [role, setRole] = useState(membership.role);
  const [status, setStatus] = useState(membership.status);
  return (
    <tr className="border-t align-top">
      <td className="p-3"><div className="font-semibold">{membership.user.name}</div><div className="text-xs text-[#706e6b]">{membership.user.email}</div><div className="text-xs text-[#706e6b]">Last login: {membership.user.lastLoginAt ? new Date(membership.user.lastLoginAt).toLocaleString() : "Never"}</div></td>
      <td className="p-3">{membership.user.status}</td>
      <td className="p-3"><div className="flex flex-wrap gap-2"><select className={inputClass} value={role} onChange={(event) => setRole(event.target.value as Membership["role"])}><option value="ADMIN">Admin</option><option value="MEMBER">Member</option></select><select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value as Membership["status"])}><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option></select></div></td>
      <td className="p-3"><InvitationStatus membership={membership} /></td>
      <td className="p-3"><div className="flex flex-wrap gap-2"><button className={buttonClass} disabled={busy} onClick={() => onUpdate(membership, role, status)}>Save</button><button className={buttonClass} disabled={busy || membership.status !== "ACTIVE" || membership.user.status !== "ACTIVE"} onClick={() => onResend(membership)}>Resend invitation</button><button className="h-9 rounded px-3 text-sm font-semibold text-red-700 hover:bg-red-50" disabled={busy} onClick={() => onRemove(membership)}>Remove</button></div></td>
    </tr>
  );
}

function InvitationStatus({ membership }: { membership: Membership }) {
  const delivery = membership.invitationDelivery;
  const status = delivery?.status ?? (membership.inviteSentAt ? "Accepted" : "Not sent");
  const failed = ["Bounced", "Dropped", "Spam Report", "Unsubscribed"].includes(status);
  const timestamp = delivery?.acceptedAt ?? membership.inviteSentAt;
  return (
    <div>
      <div className={failed ? "font-semibold text-red-700" : "font-semibold"}>{status}</div>
      {timestamp && <div className="text-xs text-[#706e6b]">{new Date(timestamp).toLocaleString()}</div>}
      {delivery?.lastReason && <div className="mt-1 max-w-xs text-xs text-red-700">{delivery.lastReason}</div>}
    </div>
  );
}
