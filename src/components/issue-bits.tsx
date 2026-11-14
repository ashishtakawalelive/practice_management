import Link from "next/link";
import clsx from "clsx";
import { Bookmark, Bug, CheckSquare, Zap, CornerDownRight, ChevronsUp, ChevronUp, Equal, ChevronDown, ChevronsDown } from "lucide-react";
import { ISSUE_TYPE_LABEL, PRIORITY_LABEL } from "@/lib/constants";
import { Badge } from "./ui";

const typeStyle: Record<string, { icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  EPIC: { icon: Zap, cls: "bg-violet-600" },
  STORY: { icon: Bookmark, cls: "bg-emerald-600" },
  TASK: { icon: CheckSquare, cls: "bg-sky-600" },
  BUG: { icon: Bug, cls: "bg-red-600" },
  SUBTASK: { icon: CornerDownRight, cls: "bg-sky-500" },
};

export function TypeIcon({ type, size = 16 }: { type: string; size?: number }) {
  const s = typeStyle[type] ?? typeStyle.TASK;
  const Icon = s.icon;
  return (
    <span
      title={ISSUE_TYPE_LABEL[type]}
      style={{ width: size, height: size }}
      className={clsx("inline-flex shrink-0 items-center justify-center rounded-[4px] text-white", s.cls)}
    >
      <Icon className="h-[70%] w-[70%]" />
    </span>
  );
}

const prio: Record<string, { icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  HIGHEST: { icon: ChevronsUp, cls: "text-red-600" },
  HIGH: { icon: ChevronUp, cls: "text-orange-500" },
  MEDIUM: { icon: Equal, cls: "text-amber-500" },
  LOW: { icon: ChevronDown, cls: "text-sky-500" },
  LOWEST: { icon: ChevronsDown, cls: "text-sky-400" },
};

export function PriorityIcon({ priority, withLabel }: { priority: string; withLabel?: boolean }) {
  const p = prio[priority] ?? prio.MEDIUM;
  const Icon = p.icon;
  return (
    <span className="inline-flex items-center gap-1" title={`${PRIORITY_LABEL[priority]} priority`}>
      <Icon className={clsx("h-4 w-4", p.cls)} />
      {withLabel && <span className="text-sm">{PRIORITY_LABEL[priority]}</span>}
    </span>
  );
}

export function StatusBadge({ name, category }: { name: string; category: string }) {
  const tone = category === "DONE" ? "green" : category === "IN_PROGRESS" ? "blue" : "gray";
  return (
    <Badge tone={tone} className="uppercase tracking-wide">
      {name}
    </Badge>
  );
}

export function IssueKey({ projectKey, number, className }: { projectKey: string; number: number; className?: string }) {
  const key = `${projectKey}-${number}`;
  return (
    <Link href={`/issues/${key}`} className={clsx("font-mono text-xs text-muted hover:text-brand-700 hover:underline", className)}>
      {key}
    </Link>
  );
}

export function Labels({ labels }: { labels?: string | null }) {
  if (!labels) return null;
  return (
    <>
      {labels
        .split(",")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => (
          <Badge key={l} tone="gray" className="font-normal">
            {l}
          </Badge>
        ))}
    </>
  );
}
