"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

export function ProjectTabs({ projectKey }: { projectKey: string }) {
  const pathname = usePathname();
  const tabs = [
    { href: `/projects/${projectKey}/board`, label: "Board" },
    { href: `/projects/${projectKey}/backlog`, label: "Backlog & sprints" },
    { href: `/projects/${projectKey}/list`, label: "List" },
    { href: `/projects/${projectKey}/reports`, label: "Reports" },
    { href: `/projects/${projectKey}/settings`, label: "Settings" },
  ];
  return (
    <nav className="mt-4 flex gap-1 border-b border-line">
      {tabs.map((t) => {
        const active = pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={clsx(
              "-mb-px border-b-2 px-3 py-2 text-sm transition",
              active ? "border-brand-600 font-medium text-brand-800" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
