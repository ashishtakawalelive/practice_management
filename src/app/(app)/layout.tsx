import Link from "next/link";
import { LogOut, Plus, Search } from "lucide-react";
import { requireUser, canManage } from "@/lib/auth";
import { db } from "@/lib/db";
import { Sidebar } from "@/components/sidebar";
import { Avatar, buttonClass } from "@/components/ui";
import { ROLE_LABEL } from "@/lib/constants";
import { logout } from "../(auth)/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [projects, pendingApprovals] = await Promise.all([
    db.project.findMany({ where: { orgId: user.orgId, archived: false }, select: { key: true, name: true }, orderBy: { name: "asc" } }),
    db.availabilityEntry.count({ where: { orgId: user.orgId, status: "PENDING" } }),
  ]);

  return (
    <div className="app-shell flex h-screen overflow-hidden">
      <Sidebar projects={projects} pendingApprovals={pendingApprovals} canManage={canManage(user)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print flex h-14 shrink-0 items-center gap-3 border-b border-line bg-white px-5">
          <form action="/search" className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              name="q"
              placeholder="Search issues, clients, invoices…"
              className="h-9 w-full rounded-md border border-line bg-canvas pr-3 pl-8 text-sm outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
            />
          </form>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/issues/new" className={buttonClass("primary", "sm")}>
              <Plus className="h-3.5 w-3.5" /> Create
            </Link>
            <div className="ml-2 flex items-center gap-2 border-l border-line pl-3">
              <Avatar name={user.name} size={28} />
              <div className="hidden leading-tight sm:block">
                <div className="text-xs font-medium">{user.name}</div>
                <div className="text-[10px] text-muted">
                  {ROLE_LABEL[user.role]} · {user.org.name}
                </div>
              </div>
              <form action={logout}>
                <button title="Sign out" className="ml-1 rounded p-1.5 text-muted hover:bg-canvas hover:text-ink">
                  <LogOut className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1400px] px-6 py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
