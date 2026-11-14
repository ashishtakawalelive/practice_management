import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatDate, formatMinutes, todayIST, addDays } from "@/lib/dates";
import { Card, CardHeader, EmptyState, PageHeader, cn } from "@/components/ui";
import { TypeIcon, StatusBadge, PriorityIcon } from "@/components/issue-bits";

export const metadata = { title: "My work" };

export default async function MyWorkPage() {
  const user = await requireUser();
  const today = todayIST();
  const [issues, logs] = await Promise.all([
    db.issue.findMany({
      where: { orgId: user.orgId, assigneeId: user.id, status: { category: { not: "DONE" } }, type: { not: "EPIC" } },
      include: { status: true, project: true },
    }),
    db.workLog.findMany({ where: { userId: user.id, date: { gte: addDays(today, -6) } } }),
  ]);
  issues.sort((a, b) => (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity));

  const groups = [
    { title: "Overdue", items: issues.filter((i) => i.dueDate && i.dueDate < today), tone: "red" },
    { title: "Due in the next 7 days", items: issues.filter((i) => i.dueDate && i.dueDate >= today && i.dueDate <= addDays(today, 7)) },
    { title: "Later", items: issues.filter((i) => i.dueDate && i.dueDate > addDays(today, 7)) },
    { title: "No due date", items: issues.filter((i) => !i.dueDate) },
  ];
  const weekMins = logs.reduce((s, l) => s + l.minutes, 0);

  return (
    <>
      <PageHeader title="My work" subtitle={`${issues.length} open issues assigned to you · ${formatMinutes(weekMins)} logged in the last 7 days`} />
      {issues.length === 0 ? (
        <Card>
          <EmptyState title="Nothing assigned to you">Enjoy the quiet — or pick something up from a project backlog.</EmptyState>
        </Card>
      ) : (
        <div className="space-y-4">
          {groups
            .filter((g) => g.items.length)
            .map((g) => (
              <Card key={g.title}>
                <CardHeader title={<span className={g.tone === "red" ? "text-red-700" : undefined}>{g.title} · {g.items.length}</span>} />
                <ul className="divide-y divide-line">
                  {g.items.map((i) => (
                    <li key={i.id} className="flex items-center gap-3 px-4 py-2.5">
                      <TypeIcon type={i.type} size={14} />
                      <Link href={`/issues/${i.project.key}-${i.number}`} className="w-16 font-mono text-xs text-muted hover:underline">
                        {i.project.key}-{i.number}
                      </Link>
                      <Link href={`/issues/${i.project.key}-${i.number}`} className="flex-1 truncate text-sm hover:text-brand-700">
                        {i.title}
                      </Link>
                      <span className="hidden text-xs text-muted md:inline">{i.project.name}</span>
                      <PriorityIcon priority={i.priority} />
                      <StatusBadge name={i.status.name} category={i.status.category} />
                      <span className={cn("w-24 text-right text-xs", g.tone === "red" ? "font-medium text-red-600" : "text-muted")}>{formatDate(i.dueDate)}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
        </div>
      )}
    </>
  );
}
