"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import clsx from "clsx";
import { Avatar } from "./ui";
import { ISSUE_TYPE_LABEL, PRIORITY_LABEL } from "@/lib/constants";

/** URL-driven issue filters shared by the board and list views. */
export function FilterBar({ users, meId, extra }: { users: { id: string; name: string }[]; meId: string; extra?: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  function set(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get("q") ?? "") !== q) set("q", q || null);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const assignee = params.get("assignee");
  const active = ["q", "assignee", "type", "priority", "label"].some((k) => params.get(k));

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter issues" className="field h-8 w-48 py-1 pl-7 text-xs" />
      </div>
      <div className="flex items-center -space-x-1">
        {users.map((u) => (
          <button
            key={u.id}
            title={u.name}
            onClick={() => set("assignee", assignee === u.id ? null : u.id)}
            className={clsx("rounded-full ring-2 transition hover:z-10 hover:-translate-y-0.5", assignee === u.id ? "z-10 ring-brand-500" : "ring-white")}
          >
            <Avatar name={u.name} size={28} />
          </button>
        ))}
      </div>
      <button
        onClick={() => set("assignee", assignee === "me" ? null : "me")}
        className={clsx("h-8 rounded-md px-2.5 text-xs font-medium transition", assignee === "me" ? "bg-brand-600 text-white" : "text-muted hover:bg-white hover:text-ink")}
      >
        Only my issues
      </button>
      <select value={params.get("type") ?? ""} onChange={(e) => set("type", e.target.value || null)} className="field h-8 w-auto py-1 text-xs">
        <option value="">All types</option>
        {Object.entries(ISSUE_TYPE_LABEL).map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      <select value={params.get("priority") ?? ""} onChange={(e) => set("priority", e.target.value || null)} className="field h-8 w-auto py-1 text-xs">
        <option value="">All priorities</option>
        {Object.entries(PRIORITY_LABEL).map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      {active && (
        <button
          onClick={() => {
            setQ("");
            router.replace(pathname, { scroll: false });
          }}
          className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs text-muted hover:text-ink"
        >
          <X className="h-3.5 w-3.5" /> Clear
        </button>
      )}
      {extra && <div className="ml-auto flex items-center gap-2">{extra}</div>}
      <span className="hidden">{meId}</span>
    </div>
  );
}
