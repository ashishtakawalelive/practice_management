"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import clsx from "clsx";
import { CalendarClock, MessageSquare, Plus } from "lucide-react";
import { Avatar } from "@/components/ui";
import { TypeIcon, PriorityIcon } from "@/components/issue-bits";
import { moveIssue, createIssue } from "../../../issues/actions";

export type BoardIssue = {
  id: string;
  key: string;
  title: string;
  type: string;
  priority: string;
  statusId: string;
  position: number;
  assignee: { id: string; name: string } | null;
  assigneeAway: string | null;
  dueDate: string | null;
  overdue: boolean;
  labels: string[];
  storyPoints: number | null;
  comments: number;
  subTasks: { done: number; total: number };
  epic: string | null;
};
export type BoardColumn = { id: string; name: string; category: string; wipLimit: number | null };

export function Board({
  columns,
  issues: initial,
  projectId,
  sprintId,
}: {
  columns: BoardColumn[];
  issues: BoardIssue[];
  projectId: string;
  sprintId: string | null;
}) {
  const [issues, setIssues] = useState(initial);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<{ col: string; index: number } | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => setIssues(initial), [initial]);

  function columnIssues(colId: string) {
    return issues.filter((i) => i.statusId === colId).sort((a, b) => a.position - b.position);
  }

  function drop(colId: string, index: number) {
    if (!dragId) return;
    const list = columnIssues(colId).filter((i) => i.id !== dragId);
    const before = list[index - 1]?.position;
    const after = list[index]?.position;
    let position: number;
    if (before === undefined && after === undefined) position = 1000;
    else if (before === undefined) position = after! - 1000;
    else if (after === undefined) position = before + 1000;
    else position = (before + after) / 2;

    const id = dragId;
    setIssues((prev) => prev.map((i) => (i.id === id ? { ...i, statusId: colId, position } : i)));
    setDragId(null);
    setOver(null);
    startTransition(() => moveIssue(id, colId, position));
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {columns.map((col, ci) => {
        const list = columnIssues(col.id);
        const overLimit = col.wipLimit != null && list.length > col.wipLimit;
        return (
          <div
            key={col.id}
            onDragOver={(e) => {
              e.preventDefault();
              if (!over || over.col !== col.id) setOver({ col: col.id, index: list.length });
            }}
            onDrop={(e) => {
              e.preventDefault();
              drop(col.id, over?.col === col.id ? over.index : list.length);
            }}
            className={clsx(
              "flex w-72 shrink-0 flex-col rounded-lg bg-slate-100/80 transition",
              over?.col === col.id && "bg-brand-50 ring-1 ring-brand-200",
              overLimit && "bg-red-50",
            )}
          >
            <div className="flex items-center justify-between px-3 pt-3 pb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                {col.name} <span className="ml-1 font-normal text-muted">{list.length}</span>
              </span>
              {col.wipLimit != null && (
                <span className={clsx("text-[10px] font-medium", overLimit ? "text-red-700" : "text-muted")}>Max {col.wipLimit}</span>
              )}
            </div>
            <div className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">
              {list.map((issue, idx) => (
                <div
                  key={issue.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    const index = e.clientY < rect.top + rect.height / 2 ? idx : idx + 1;
                    if (over?.col !== col.id || over.index !== index) setOver({ col: col.id, index });
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    drop(col.id, over?.col === col.id ? over.index : idx);
                  }}
                >
                  {over?.col === col.id && over.index === idx && dragId && dragId !== issue.id && <DropLine />}
                  <Card issue={issue} dragging={dragId === issue.id} onDragStart={() => setDragId(issue.id)} onDragEnd={() => { setDragId(null); setOver(null); }} />
                  {over?.col === col.id && over.index === idx + 1 && idx === list.length - 1 && dragId && dragId !== issue.id && <DropLine />}
                </div>
              ))}
              {ci === 0 && <QuickCreate projectId={projectId} statusId={col.id} sprintId={sprintId} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DropLine() {
  return <div className="my-1 h-0.5 rounded bg-brand-500" />;
}

function Card({ issue, dragging, onDragStart, onDragEnd }: { issue: BoardIssue; dragging: boolean; onDragStart: () => void; onDragEnd: () => void }) {
  return (
    <Link
      href={`/issues/${issue.key}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={clsx(
        "block cursor-grab rounded-md border border-line bg-white p-2.5 shadow-xs transition hover:border-brand-300 hover:shadow-sm active:cursor-grabbing",
        dragging && "opacity-40",
      )}
    >
      {issue.epic && <span className="mb-1.5 inline-block max-w-full truncate rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">{issue.epic}</span>}
      <p className="text-sm leading-snug text-ink">{issue.title}</p>
      {issue.labels.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {issue.labels.map((l) => (
            <span key={l} className="rounded bg-slate-100 px-1.5 text-[10px] text-slate-600">
              {l}
            </span>
          ))}
        </div>
      )}
      <div className="mt-2 flex items-center gap-2">
        <TypeIcon type={issue.type} size={14} />
        <span className="font-mono text-[11px] text-muted">{issue.key}</span>
        <PriorityIcon priority={issue.priority} />
        {issue.dueDate && (
          <span className={clsx("inline-flex items-center gap-0.5 text-[11px]", issue.overdue ? "font-medium text-red-600" : "text-muted")}>
            <CalendarClock className="h-3 w-3" />
            {issue.dueDate}
          </span>
        )}
        {issue.comments > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[11px] text-muted">
            <MessageSquare className="h-3 w-3" />
            {issue.comments}
          </span>
        )}
        {issue.subTasks.total > 0 && (
          <span className="text-[11px] text-muted">
            {issue.subTasks.done}/{issue.subTasks.total}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1.5">
          {issue.storyPoints != null && <span className="rounded-full bg-slate-100 px-1.5 text-[10px] font-medium text-slate-600">{issue.storyPoints}</span>}
          <span className="relative">
            <Avatar name={issue.assignee?.name} size={22} title={issue.assignee ? issue.assignee.name + (issue.assigneeAway ? ` — ${issue.assigneeAway} today` : "") : "Unassigned"} />
            {issue.assigneeAway && <span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-amber-500" />}
          </span>
        </span>
      </div>
    </Link>
  );
}

function QuickCreate({ projectId, statusId, sprintId }: { projectId: string; statusId: string; sprintId: string | null }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted hover:bg-white hover:text-ink">
        <Plus className="h-3.5 w-3.5" /> Create issue
      </button>
    );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        const fd = new FormData();
        fd.set("projectId", projectId);
        fd.set("statusId", statusId);
        fd.set("title", title);
        fd.set("type", "TASK");
        fd.set("stay", "1");
        if (sprintId) fd.set("sprintId", sprintId);
        startTransition(async () => {
          await createIssue(undefined, fd);
          setTitle("");
        });
      }}
      className="rounded-md border border-brand-300 bg-white p-2 shadow-sm"
    >
      <textarea
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            e.currentTarget.form?.requestSubmit();
          }
          if (e.key === "Escape") setOpen(false);
        }}
        rows={2}
        placeholder="What needs to be done?"
        className="w-full resize-none text-sm outline-none"
      />
      <div className="flex justify-end gap-1">
        <button type="button" onClick={() => setOpen(false)} className="rounded px-2 py-1 text-xs text-muted hover:bg-canvas">
          Cancel
        </button>
        <button disabled={pending} className="rounded bg-brand-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-50">
          {pending ? "Adding…" : "Add"}
        </button>
      </div>
    </form>
  );
}
