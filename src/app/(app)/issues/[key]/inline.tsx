"use client";

import { useState, useTransition } from "react";
import clsx from "clsx";

/** Click-to-edit text for the issue title and description. */
export function InlineText({
  action,
  value,
  multiline,
  placeholder,
  className,
}: {
  action: (data: FormData) => Promise<void>;
  value: string;
  multiline?: boolean;
  placeholder: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [pending, startTransition] = useTransition();

  function save() {
    const fd = new FormData();
    fd.set("value", draft);
    startTransition(async () => {
      await action(fd);
      setEditing(false);
    });
  }

  if (!editing)
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        onKeyDown={(e) => e.key === "Enter" && setEditing(true)}
        className={clsx("-mx-2 cursor-text rounded-md px-2 py-1 transition hover:bg-slate-100", className, !value && "text-muted")}
      >
        {multiline ? <div className="text-sm leading-relaxed whitespace-pre-wrap">{value || placeholder}</div> : value || placeholder}
      </div>
    );

  return (
    <div className="space-y-2">
      {multiline ? (
        <textarea autoFocus rows={6} value={draft} onChange={(e) => setDraft(e.target.value)} className="field leading-relaxed" placeholder={placeholder} />
      ) : (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
          className={clsx("field", className)}
        />
      )}
      <div className="flex gap-2">
        <button onClick={save} disabled={pending} className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
          {pending ? "Saving…" : "Save"}
        </button>
        <button onClick={() => setEditing(false)} className="rounded-md px-3 py-1.5 text-xs text-muted hover:bg-canvas">
          Cancel
        </button>
      </div>
    </div>
  );
}

/** Tabs for comments / work log / history. */
export function ActivityTabs({ tabs }: { tabs: { id: string; label: string; content: React.ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0].id);
  return (
    <div>
      <div className="mb-3 flex gap-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className={clsx("rounded-md px-2.5 py-1 text-xs font-medium transition", active === t.id ? "bg-brand-50 text-brand-800" : "text-muted hover:bg-slate-100")}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.find((t) => t.id === active)?.content}
    </div>
  );
}
