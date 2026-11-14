import { db } from "@/lib/db";
import { getProject } from "@/lib/projects";
import { addDays, formatDateShort, formatMinutes, todayIST } from "@/lib/dates";
import { Avatar, Card, CardHeader, EmptyState } from "@/components/ui";

export const metadata = { title: "Reports" };

export default async function ReportsPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const { project } = await getProject(key);
  const today = todayIST();
  const since = addDays(today, -27);
  const activeSprint = project.sprints.find((s) => s.state === "ACTIVE");

  const [issues, logs] = await Promise.all([
    db.issue.findMany({
      where: { projectId: project.id, type: { not: "EPIC" } },
      include: { status: true, assignee: true },
    }),
    db.workLog.findMany({ where: { issue: { projectId: project.id }, date: { gte: since } }, include: { user: true } }),
  ]);

  // Status breakdown
  const byCategory = { TODO: 0, IN_PROGRESS: 0, DONE: 0 } as Record<string, number>;
  for (const i of issues) byCategory[i.status.category]++;
  const total = issues.length || 1;

  // Workload by assignee (open issues)
  const load = new Map<string, { name: string; open: number; points: number; overdue: number }>();
  for (const i of issues) {
    if (i.status.category === "DONE") continue;
    const k = i.assignee?.name ?? "Unassigned";
    const row = load.get(k) ?? { name: k, open: 0, points: 0, overdue: 0 };
    row.open++;
    row.points += i.storyPoints ?? 0;
    if (i.dueDate && i.dueDate < today) row.overdue++;
    load.set(k, row);
  }
  const loadRows = [...load.values()].sort((a, b) => b.open - a.open);
  const maxOpen = Math.max(1, ...loadRows.map((r) => r.open));

  // Created vs resolved, by week (4 weeks)
  const weeks = [0, 1, 2, 3].map((w) => {
    const start = addDays(since, w * 7);
    const end = addDays(start, 7);
    return {
      label: formatDateShort(start),
      created: issues.filter((i) => i.createdAt >= start && i.createdAt < end).length,
      resolved: issues.filter((i) => i.resolvedAt && i.resolvedAt >= start && i.resolvedAt < end).length,
    };
  });
  const maxWeek = Math.max(1, ...weeks.flatMap((w) => [w.created, w.resolved]));

  // Time logged per person
  const time = new Map<string, number>();
  for (const l of logs) time.set(l.user.name, (time.get(l.user.name) ?? 0) + l.minutes);
  const timeRows = [...time.entries()].sort((a, b) => b[1] - a[1]);
  const maxTime = Math.max(1, ...timeRows.map((r) => r[1]));

  // Sprint burndown (story points)
  let burndown: { day: Date; remaining: number }[] = [];
  let sprintPoints = 0;
  if (activeSprint?.startDate && activeSprint.endDate) {
    const sprintIssues = issues.filter((i) => i.sprintId === activeSprint.id);
    sprintPoints = sprintIssues.reduce((s, i) => s + (i.storyPoints ?? 0), 0);
    const days = Math.round((activeSprint.endDate.getTime() - activeSprint.startDate.getTime()) / 86400000) + 1;
    for (let d = 0; d < days; d++) {
      const day = addDays(activeSprint.startDate, d);
      if (day > today) break;
      const endOfDay = addDays(day, 1);
      const done = sprintIssues.filter((i) => i.status.category === "DONE" && i.resolvedAt && i.resolvedAt < endOfDay).reduce((s, i) => s + (i.storyPoints ?? 0), 0);
      burndown.push({ day, remaining: sprintPoints - done });
    }
    if (sprintPoints === 0) burndown = [];
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader title="Issues by status" subtitle={`${issues.length} issues (excluding epics)`} />
        <div className="p-4">
          <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
            <div className="bg-slate-400" style={{ width: `${(byCategory.TODO / total) * 100}%` }} />
            <div className="bg-sky-500" style={{ width: `${(byCategory.IN_PROGRESS / total) * 100}%` }} />
            <div className="bg-emerald-500" style={{ width: `${(byCategory.DONE / total) * 100}%` }} />
          </div>
          <div className="mt-3 flex gap-5 text-sm">
            <Legend color="bg-slate-400" label="To do" value={byCategory.TODO} />
            <Legend color="bg-sky-500" label="In progress" value={byCategory.IN_PROGRESS} />
            <Legend color="bg-emerald-500" label="Done" value={byCategory.DONE} />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title={activeSprint ? `Burndown — ${activeSprint.name}` : "Sprint burndown"} subtitle="Story points remaining" />
        {burndown.length > 0 && activeSprint?.startDate && activeSprint.endDate ? (
          <Burndown
            points={burndown}
            total={sprintPoints}
            days={Math.round((activeSprint.endDate.getTime() - activeSprint.startDate.getTime()) / 86400000) + 1}
            start={activeSprint.startDate}
          />
        ) : (
          <EmptyState title="No active sprint with story points">Start a sprint and estimate issues to see the burndown.</EmptyState>
        )}
      </Card>

      <Card>
        <CardHeader title="Workload" subtitle="Open issues per person" />
        <div className="space-y-2.5 p-4">
          {loadRows.length === 0 && <p className="text-sm text-muted">No open issues.</p>}
          {loadRows.map((r) => (
            <div key={r.name} className="flex items-center gap-3">
              <Avatar name={r.name === "Unassigned" ? null : r.name} size={22} />
              <span className="w-36 truncate text-sm">{r.name}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-brand-500" style={{ width: `${(r.open / maxOpen) * 100}%` }} />
              </div>
              <span className="w-24 text-right text-xs tabular-nums text-muted">
                {r.open} open{r.overdue ? <span className="text-red-600"> · {r.overdue} late</span> : null}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Created vs resolved" subtitle="Last 4 weeks" />
        <div className="flex h-44 items-end gap-6 px-6 pt-4 pb-2">
          {weeks.map((w) => (
            <div key={w.label} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-32 w-full items-end justify-center gap-1">
                <div title={`${w.created} created`} className="w-5 rounded-t bg-amber-400" style={{ height: `${(w.created / maxWeek) * 100}%` }} />
                <div title={`${w.resolved} resolved`} className="w-5 rounded-t bg-emerald-500" style={{ height: `${(w.resolved / maxWeek) * 100}%` }} />
              </div>
              <span className="text-[10px] text-muted">wk of {w.label}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-5 px-4 pb-3 text-xs">
          <Legend color="bg-amber-400" label="Created" />
          <Legend color="bg-emerald-500" label="Resolved" />
        </div>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader title="Time logged" subtitle="Last 28 days, all issues in this project" />
        <div className="space-y-2.5 p-4">
          {timeRows.length === 0 && <p className="text-sm text-muted">No time logged yet.</p>}
          {timeRows.map(([name, mins]) => (
            <div key={name} className="flex items-center gap-3">
              <Avatar name={name} size={22} />
              <span className="w-36 truncate text-sm">{name}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-sky-500" style={{ width: `${(mins / maxTime) * 100}%` }} />
              </div>
              <span className="w-16 text-right text-xs tabular-nums text-muted">{formatMinutes(mins)}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value?: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-sm ${color}`} />
      <span className="text-muted">{label}</span>
      {value != null && <span className="font-medium tabular-nums">{value}</span>}
    </span>
  );
}

function Burndown({ points, total, days, start }: { points: { day: Date; remaining: number }[]; total: number; days: number; start: Date }) {
  const W = 520;
  const H = 180;
  const pad = 28;
  const x = (d: number) => pad + (d / Math.max(1, days - 1)) * (W - pad * 2);
  const y = (v: number) => H - pad - (v / Math.max(1, total)) * (H - pad * 2);
  const actual = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.remaining)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full p-2">
      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} className="stroke-slate-200" />
      <line x1={pad} y1={pad} x2={pad} y2={H - pad} className="stroke-slate-200" />
      <line x1={x(0)} y1={y(total)} x2={x(days - 1)} y2={y(0)} strokeDasharray="4 4" className="stroke-slate-400" />
      <path d={actual} fill="none" strokeWidth={2.5} className="stroke-brand-600" />
      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.remaining)} r={3} className="fill-brand-600" />
      ))}
      <text x={pad - 6} y={y(total) + 4} textAnchor="end" className="fill-slate-500 text-[10px]">
        {total}
      </text>
      <text x={pad - 6} y={H - pad + 4} textAnchor="end" className="fill-slate-500 text-[10px]">
        0
      </text>
      <text x={x(0)} y={H - 8} className="fill-slate-500 text-[10px]">
        {formatDateShort(start)}
      </text>
      <text x={x(days - 1)} y={H - 8} textAnchor="end" className="fill-slate-500 text-[10px]">
        {formatDateShort(addDays(start, days - 1))}
      </text>
    </svg>
  );
}
