import Link from "next/link";
import { requireSuperAdminPage } from "@/lib/super-admin";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSuperAdminPage();
  return (
    <div className="min-h-screen bg-[#f3f3f3] text-[#181818]">
      <header className="flex min-h-14 items-center gap-4 border-b border-[#d8dde6] bg-[#032d60] px-5 text-white">
        <Link className="text-lg font-semibold" href="/super-admin">CRM Super Admin</Link>
        <span className="rounded bg-white/15 px-2 py-1 text-xs">{user.email}</span>
        <div className="ml-auto flex gap-3 text-sm">
          <Link className="hover:underline" href="/lightning/page/home">Open CRM</Link>
          <Link className="hover:underline" href="/auth/signout">Sign out</Link>
        </div>
      </header>
      {children}
    </div>
  );
}
