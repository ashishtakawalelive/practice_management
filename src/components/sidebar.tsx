"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  LayoutDashboard,
  ListChecks,
  FolderKanban,
  Building2,
  CalendarDays,
  ReceiptIndianRupee,
  FileText,
  Package,
  Users,
  Settings,
} from "lucide-react";
import { Logo } from "./logo";

type Item = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number };

export function Sidebar({
  projects,
  pendingApprovals,
  canManage,
}: {
  projects: { key: string; name: string }[];
  pendingApprovals: number;
  canManage: boolean;
}) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const groups: { title?: string; items: Item[] }[] = [
    {
      items: [
        { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/my-work", label: "My work", icon: ListChecks },
      ],
    },
    {
      title: "Work",
      items: [
        { href: "/projects", label: "Projects", icon: FolderKanban },
        { href: "/clients", label: "Clients", icon: Building2 },
      ],
    },
    {
      title: "People",
      items: [
        { href: "/availability", label: "Availability", icon: CalendarDays, badge: canManage ? pendingApprovals : 0 },
        { href: "/team", label: "Team", icon: Users },
      ],
    },
    {
      title: "Billing",
      items: [
        { href: "/invoices", label: "Invoices", icon: ReceiptIndianRupee },
        { href: "/quotations", label: "Quotations", icon: FileText },
        { href: "/items", label: "Items & services", icon: Package },
      ],
    },
  ];

  return (
    <aside className="no-print flex h-full w-60 shrink-0 flex-col border-r border-line bg-white">
      <div className="flex h-14 items-center border-b border-line px-4">
        <Link href="/dashboard">
          <Logo />
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {groups.map((g, i) => (
          <div key={i} className="mb-4">
            {g.title && <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted/80">{g.title}</p>}
            {g.items.map((it) => (
              <NavLink key={it.href} item={it} active={isActive(it.href)} />
            ))}
            {g.title === "Work" && projects.length > 0 && (
              <div className="mt-1 ml-4 border-l border-line pl-2">
                {projects.slice(0, 8).map((p) => {
                  const href = `/projects/${p.key}`;
                  return (
                    <Link
                      key={p.key}
                      href={`${href}/board`}
                      className={clsx(
                        "flex items-center gap-2 rounded px-2 py-1 text-xs transition",
                        isActive(href) ? "bg-brand-50 font-medium text-brand-800" : "text-muted hover:bg-canvas hover:text-ink",
                      )}
                    >
                      <span className="font-mono text-[10px] text-muted">{p.key}</span>
                      <span className="truncate">{p.name}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </nav>
      <div className="border-t border-line px-2 py-2">
        <NavLink item={{ href: "/settings", label: "Firm settings", icon: Settings }} active={isActive("/settings")} />
      </div>
    </aside>
  );
}

function NavLink({ item, active }: { item: Item; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={clsx(
        "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition",
        active ? "bg-brand-50 font-medium text-brand-800" : "text-slate-600 hover:bg-canvas hover:text-ink",
      )}
    >
      <Icon className={clsx("h-4 w-4", active ? "text-brand-600" : "text-slate-400")} />
      <span className="flex-1">{item.label}</span>
      {!!item.badge && <span className="rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-800">{item.badge}</span>}
    </Link>
  );
}
