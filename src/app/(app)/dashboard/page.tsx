import Link from "next/link";
import { db } from "@/lib/db";
import { canManage, requireUser } from "@/lib/auth";
import { availabilityOn } from "@/lib/availability";
import { addDays, formatDate, formatDateShort, todayIST } from "@/lib/dates";
import { formatINR } from "@/lib/gst";
import { Avatar, Badge, Card, CardHeader, Stat, cn } from "@/components/ui";
import { TypeIcon, PriorityIcon, StatusBadge } from "@/components/issue-bits";
import { InvoiceStatusBadge } from "../invoices/status";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  const today = todayIST();
  const manager = canManage(user);

  const [myOpen, orgOverdue, dueThisWeek, away, pendingLeave, invoices, recent, members] = await Promise.all([
    db.issue.findMany({
      where: { orgId: user.orgId, assigneeId: user.id, status: { category: { not: "DONE" } }, type: { not: "EPIC" } },
      include: { project: true, status: true },
      orderBy: [{ dueDate: "asc" }],
      take: 8,
    }),
    db.issue.count({ where: { orgId: user.orgId, status: { category: { not: "DONE" } }, dueDate: { lt: today } } }),
    db.issue.findMany({
      where: { orgId: user.orgId, status: { category: { not: "DONE" } }, dueDate: { gte: today, lte: addDays(today, 7) } },
      include: { project: true, assignee: true, status: true },
      orderBy: { dueDate: "asc" },
      take: 8,
    }),
    availabilityOn(user.orgId, today),
    manager ? db.availabilityEntry.count({ where: { orgId: user.orgId, status: "PENDING" } }) : Promise.resolve(0),
    db.invoice.findMany({
      where: { orgId: user.orgId, docType: "INVOICE", status: { in: ["SENT", "PARTIAL"] } },
      include: { client: true },
      orderBy: { dueDate: "asc" },
    }),
    db.activity.findMany({
      where: { issue: { orgId: user.orgId } },
      include: { actor: true, issue: { include: { project: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    db.user.findMany({ where: { orgId: user.orgId, active: true }, orderBy: { name: "asc" } }),
  ]);

  const outstanding = invoices.reduce((s, i) => s + i.total - i.amountPaid, 0);
  const overdueInv = invoices.filter((i) => i.dueDate && i.dueDate < today);
  const hour = new Date(Date.now() + 5.5 * 3600 * 1000).getUTCHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <>
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight">
          {greeting}, {user.name.split(" ")[0]}
        </h1>
        <p className="text-sm text-muted">{formatDate(today)} · {user.org.name}</p>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="My open issues" value={myOpen.length} href="/my-work" />
        <Stat label="Overdue issues (firm)" value={orgOverdue} tone={orgOverdue ? "red" : undefined} />
        <Stat label="Out today" value={[...away.values()].filter((a) => a.unavailable).length} hint={`of ${members.length} people`} href="/availability" />
        <Stat
          label="Outstanding receivables"
          value={formatINR(outstanding)}
          hint={overdueInv.length ? `${overdueInv.length} overdue` : "Nothing overdue"}
          tone={overdueInv.length ? "amber" : undefined}
          href="/invoices?filter=unpaid"
        />
      </div>

      {manager && pendingLeave > 0 && (
        <Link href="/availability" className="mb-5 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 hover:bg-amber-100">
          <span>
            <strong>{pendingLeave}</strong> leave request{pendingLeave > 1 ? "s" : ""} waiting for your approval
          </span>
          <span className="font-medium">Review →</span>
        </Link>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Assigned to me" action={<Link href="/my-work" className="text-xs font-medium text-brand-700 hover:underline">View all</Link>} />
          {myOpen.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">You&apos;re all caught up.</p>
          ) : (
            <ul className="divide-y divide-line">
              {myOpen.map((i) => {
                const overdue = i.dueDate && i.dueDate < today;
                return (
                  <li key={i.id} className="flex items-center gap-3 px-4 py-2.5">
                    <TypeIcon type={i.type} size={14} />
                    <Link href={`/issues/${i.project.key}-${i.number}`} className="w-16 font-mono text-xs text-muted hover:underline">
                      {i.project.key}-{i.number}
                    </Link>
                    <Link href={`/issues/${i.project.key}-${i.number}`} className="flex-1 truncate text-sm hover:text-brand-700">
                      {i.title}
                    </Link>
                    <PriorityIcon priority={i.priority} />
                    <StatusBadge name={i.status.name} category={i.status.category} />
                    <span className={cn("w-16 text-right text-xs", overdue ? "font-medium text-red-600" : "text-muted")}>{i.dueDate ? formatDateShort(i.dueDate) : "—"}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Team today" action={<Link href="/availability" className="text-xs font-medium text-brand-700 hover:underline">Calendar</Link>} />
          <ul className="divide-y divide-line">
            {members.map((m) => {
              const a = away.get(m.id);
              return (
                <li key={m.id} className="flex items-center gap-2.5 px-4 py-2">
                  <Avatar name={m.name} size={24} />
                  <span className="flex-1 truncate text-sm">{m.name}</span>
                  {a ? (
                    <Badge tone={a.type === "WFH" ? "blue" : a.type === "ABSENT" ? "red" : a.type === "OOO" ? "violet" : "amber"} title={a.note ?? undefined}>
                      {a.label}
                    </Badge>
                  ) : (
                    <Badge tone="green">In office</Badge>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Due in the next 7 days" subtitle="Across all projects" />
          {dueThisWeek.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">No deadlines this week.</p>
          ) : (
            <ul className="divide-y divide-line">
              {dueThisWeek.map((i) => {
                const a = i.assigneeId ? away.get(i.assigneeId) : undefined;
                return (
                  <li key={i.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="w-14 text-xs font-medium text-muted">{formatDateShort(i.dueDate)}</span>
                    <Link href={`/issues/${i.project.key}-${i.number}`} className="flex-1 truncate text-sm hover:text-brand-700">
                      {i.title}
                    </Link>
                    <span className="hidden text-xs text-muted sm:inline">{i.project.key}</span>
                    {a?.unavailable && <Badge tone="amber">{a.label}</Badge>}
                    <Avatar name={i.assignee?.name} size={22} />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Unpaid invoices" action={<Link href="/invoices?filter=unpaid" className="text-xs font-medium text-brand-700 hover:underline">All</Link>} />
          {invoices.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">Everything is paid.</p>
          ) : (
            <ul className="divide-y divide-line">
              {invoices.slice(0, 6).map((inv) => (
                <li key={inv.id} className="px-4 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/invoices/${inv.id}`} className="truncate text-sm hover:text-brand-700">
                      {inv.client.name}
                    </Link>
                    <span className="text-sm font-medium tabular-nums">{formatINR(inv.total - inv.amountPaid)}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                    <span className="font-mono">{inv.number}</span> · due {formatDateShort(inv.dueDate)}
                    <span className="ml-auto">
                      <InvoiceStatusBadge invoice={inv} />
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader title="Recent activity" />
          <ul className="divide-y divide-line">
            {recent.map((a) => (
              <li key={a.id} className="flex items-center gap-2.5 px-4 py-2 text-sm">
                <Avatar name={a.actor.name} size={22} />
                <span className="font-medium">{a.actor.name}</span>
                <span className="text-muted">
                  {a.action === "created" ? "created" : a.action === "logged_work" ? "logged work on" : a.action === "commented" ? "commented on" : `changed ${a.field} on`}
                </span>
                <Link href={`/issues/${a.issue.project.key}-${a.issue.number}`} className="min-w-0 flex-1 truncate hover:text-brand-700">
                  <span className="font-mono text-xs text-muted">
                    {a.issue.project.key}-{a.issue.number}
                  </span>{" "}
                  {a.issue.title}
                </Link>
                {a.action === "updated" && a.toValue && a.field !== "description" && <span className="hidden text-xs text-muted md:inline">→ {a.toValue}</span>}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
