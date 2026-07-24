import {
  addOrganizationMemberAction,
  createOrganizationAction,
  removeMembershipAction,
  resendOrganizationInvitationAction,
  revokeUserSessionsAction,
  sendUserActionsAction,
  setGlobalUserStatusAction,
  updateGlobalUserAction,
  updateMembershipAction,
  updateOrganizationAction
} from "@/app/super-admin/actions";
import { NameSlugFields } from "@/components/forms/NameSlugFields";
import { ORGANIZATION_INVITATION_SOURCE } from "@/lib/organization-invitations";
import { prisma } from "@/lib/prisma";

const inputClass = "h-9 rounded border border-[#c9c9c9] bg-white px-3 text-sm outline-none focus:border-brand-500";
const buttonClass = "inline-flex h-9 items-center justify-center rounded border border-brand-600 bg-white px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50";
const primaryClass = "inline-flex h-9 items-center justify-center rounded bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700";

export const dynamic = "force-dynamic";

export default async function SuperAdminPage({ searchParams }: { searchParams: Promise<{ message?: string; error?: string; q?: string }> }) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const [organizations, users, invitationDeliveries] = await Promise.all([
    prisma.organization.findMany({ include: { memberships: { include: { user: true }, orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "asc" } }),
    prisma.user.findMany({
      where: query ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { email: { contains: query, mode: "insensitive" } }] } : undefined,
      include: { memberships: { include: { organization: true } }, appSessions: { where: { revokedAt: null } } },
      orderBy: { createdAt: "asc" }
    }),
    prisma.emailDelivery.findMany({
      where: { sourceType: ORGANIZATION_INVITATION_SOURCE },
      orderBy: { acceptedAt: "desc" }
    })
  ]);
  const latestInvitationDeliveries = new Map<string, (typeof invitationDeliveries)[number]>();
  for (const delivery of invitationDeliveries) {
    if (delivery.sourceId && !latestInvitationDeliveries.has(delivery.sourceId)) latestInvitationDeliveries.set(delivery.sourceId, delivery);
  }

  return (
    <main className="mx-auto max-w-[1500px] space-y-6 p-5">
      <div>
        <h1 className="text-2xl font-semibold">Organizations and users</h1>
        <p className="text-sm text-[#706e6b]">Global identity operations affect every organization a user belongs to.</p>
      </div>
      {params.message && <div className="rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">{params.message}</div>}
      {params.error && <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">{params.error}</div>}

      <section className="rounded border border-[#d8dde6] bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Create organization</h2>
        <form action={createOrganizationAction} className="mt-3 grid gap-3 md:grid-cols-5">
          <NameSlugFields
            className="contents"
            nameClassName={inputClass}
            slugClassName={inputClass}
            namePlaceholder="Organization name"
            slugPlaceholder="organization-slug"
          />
          <input className={inputClass} name="adminName" placeholder="First administrator" required />
          <input className={inputClass} name="adminEmail" type="email" placeholder="admin@example.com" required />
          <button className={primaryClass}>Create and invite admin</button>
        </form>
      </section>

      <section className="rounded border border-[#d8dde6] bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Add organization member</h2>
        <form action={addOrganizationMemberAction} className="mt-3 grid gap-3 md:grid-cols-5">
          <select className={inputClass} name="organizationId" required>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select>
          <input className={inputClass} name="name" placeholder="Full name" required />
          <input className={inputClass} name="email" type="email" placeholder="user@example.com" required />
          <select className={inputClass} name="role"><option value="MEMBER">Member</option><option value="ADMIN">Administrator</option></select>
          <button className={primaryClass}>Invite or add</button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Organizations ({organizations.length})</h2>
        {organizations.map((organization) => {
          const activeAdmins = organization.memberships.filter((row) => row.role === "ADMIN" && row.status === "ACTIVE" && row.user.status === "ACTIVE").length;
          return (
            <article key={organization.id} className="rounded border border-[#d8dde6] bg-white p-4 shadow-sm">
              <form action={updateOrganizationAction.bind(null, organization.id)} className="grid gap-3 md:grid-cols-[1fr_1fr_160px_auto]">
                <NameSlugFields
                  className="contents"
                  nameClassName={inputClass}
                  slugClassName={inputClass}
                  nameDefault={organization.name}
                  slugDefault={organization.slug}
                  namePlaceholder="Organization name"
                  slugPlaceholder="organization-slug"
                />
                <select className={inputClass} name="status" defaultValue={organization.status}><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option></select>
                <button className={buttonClass}>Save organization</button>
              </form>
              <p className="mt-2 text-xs text-[#706e6b]">{organization.memberships.length} memberships · {activeAdmins} active admins · Created {organization.createdAt.toLocaleDateString()}</p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#f3f3f3] text-xs uppercase text-[#706e6b]"><tr><th className="p-2">User</th><th className="p-2">Access</th><th className="p-2">Invitation</th><th className="p-2">Actions</th></tr></thead>
                  <tbody>{organization.memberships.map((membership) => {
                    const delivery = latestInvitationDeliveries.get(membership.id);
                    const invitationStatus = delivery?.status ?? (membership.inviteSentAt ? "Accepted" : "Not sent");
                    const invitationFailed = ["Bounced", "Dropped", "Spam Report", "Unsubscribed"].includes(invitationStatus);
                    const invitationAt = delivery?.acceptedAt ?? membership.inviteSentAt;
                    return (
                    <tr key={membership.id} className="border-t align-top">
                      <td className="p-2"><div className="font-medium">{membership.user.name}</div><div className="text-xs text-[#706e6b]">{membership.user.email ?? "Legacy identity"}</div></td>
                      <td className="p-2">
                        <form action={updateMembershipAction.bind(null, membership.id)} className="flex flex-wrap gap-2">
                          <input type="hidden" name="organizationId" value={organization.id} />
                          <select className={inputClass} name="role" defaultValue={membership.role}><option value="ADMIN">Admin</option><option value="MEMBER">Member</option></select>
                          <select className={inputClass} name="status" defaultValue={membership.status}><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option></select>
                          <button className={buttonClass}>Update</button>
                        </form>
                      </td>
                      <td className="p-2">
                        <div className={invitationFailed ? "font-semibold text-red-700" : "font-semibold"}>{invitationStatus}</div>
                        {invitationAt && <div className="text-xs text-[#706e6b]">{invitationAt.toLocaleString()}</div>}
                        {delivery?.lastReason && <div className="max-w-xs text-xs text-red-700">{delivery.lastReason}</div>}
                      </td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-3">
                          <form action={resendOrganizationInvitationAction.bind(null, membership.id)}>
                            <input type="hidden" name="organizationId" value={organization.id} />
                            <button className="text-sm font-semibold text-brand-700 hover:underline disabled:opacity-50" disabled={membership.status !== "ACTIVE" || membership.user.status !== "ACTIVE"}>Resend invitation</button>
                          </form>
                          <form action={removeMembershipAction.bind(null, membership.id)}><input type="hidden" name="organizationId" value={organization.id} /><button className="text-sm font-semibold text-red-700 hover:underline">Remove</button></form>
                        </div>
                      </td>
                    </tr>
                  );})}</tbody>
                </table>
              </div>
            </article>
          );
        })}
      </section>

      <section className="rounded border border-[#d8dde6] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Global users ({users.length})</h2>
          <form className="flex gap-2"><input className={inputClass} name="q" defaultValue={query} placeholder="Search name or email" /><button className={buttonClass}>Search</button></form>
        </div>
        <div className="mt-3 space-y-3">
          {users.map((user) => (
            <article key={user.id} className="rounded border p-3">
              <div className="grid gap-3 xl:grid-cols-[1fr_auto]">
                <form action={updateGlobalUserAction.bind(null, user.id)} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                  <input className={inputClass} name="name" defaultValue={user.name} disabled={!user.keycloakSub} />
                  <input className={inputClass} name="email" type="email" defaultValue={user.email ?? ""} disabled={!user.keycloakSub} />
                  <button className={buttonClass} disabled={!user.keycloakSub}>Save identity</button>
                </form>
                <div className="flex flex-wrap gap-2">
                  <form action={setGlobalUserStatusAction.bind(null, user.id)}><input type="hidden" name="status" value={user.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"} /><button className={buttonClass} disabled={!user.keycloakSub}>{user.status === "ACTIVE" ? "Suspend globally" : "Reactivate"}</button></form>
                  <form action={sendUserActionsAction.bind(null, user.id)}><input type="hidden" name="kind" value="reset" /><button className={buttonClass} disabled={!user.keycloakSub}>Reset password</button></form>
                  <form action={sendUserActionsAction.bind(null, user.id)}><input type="hidden" name="kind" value="setup" /><button className={buttonClass} disabled={!user.keycloakSub}>Resend setup</button></form>
                  <form action={revokeUserSessionsAction.bind(null, user.id)}><button className={buttonClass}>Revoke sessions</button></form>
                </div>
              </div>
              <div className="mt-2 text-xs text-[#706e6b]">{user.status} · {user.appSessions.length} active app sessions · Last login {user.lastLoginAt?.toLocaleString() ?? "Never"} · Setup email {user.setupEmailSentAt?.toLocaleString() ?? "Not recorded"}</div>
              <div className="mt-2 flex flex-wrap gap-2">{user.memberships.map((membership) => <span key={membership.id} className="rounded bg-[#eef4ff] px-2 py-1 text-xs">{membership.organization.name}: {membership.role}/{membership.status}</span>)}</div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
