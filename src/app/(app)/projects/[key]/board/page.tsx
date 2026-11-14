import Link from "next/link";
import { db } from "@/lib/db";
import { getProject, issueWhere, type IssueFilters } from "@/lib/projects";
import { availabilityOn } from "@/lib/availability";
import { formatDate, formatDateShort, todayIST, addDays } from "@/lib/dates";
import { FilterBar } from "@/components/filter-bar";
import { Badge, buttonClass } from "@/components/ui";
import { Board, type BoardIssue } from "./board";

export const metadata = { title: "Board" };

export default async function BoardPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<IssueFilters> }) {
  const { key } = await params;
  const filters = await searchParams;
  const { user, project } = await getProject(key);
  const activeSprint = project.sprints.find((s) => s.state === "ACTIVE") ?? null;
  const today = todayIST();

  const doneIds = project.statuses.filter((s) => s.category === "DONE").map((s) => s.id);
  const [issues, users, away] = await Promise.all([
    db.issue.findMany({
      where: {
        projectId: project.id,
        type: { not: "EPIC" },
        ...(activeSprint ? { sprintId: activeSprint.id } : {}),
        // Kanban mode: hide work finished more than 14 days ago
        ...(activeSprint ? {} : { OR: [{ statusId: { notIn: doneIds } }, { resolvedAt: { gte: addDays(today, -14) } }, { resolvedAt: null }] }),
        ...issueWhere(filters, user.id),
      },
      include: {
        assignee: { select: { id: true, name: true } },
        epic: { select: { title: true } },
        subTasks: { select: { status: { select: { category: true } } } },
        _count: { select: { comments: true } },
      },
    }),
    db.user.findMany({ where: { orgId: user.orgId, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    availabilityOn(user.orgId, today),
  ]);

  const data: BoardIssue[] = issues.map((i) => ({
    id: i.id,
    key: `${project.key}-${i.number}`,
    title: i.title,
    type: i.type,
    priority: i.priority,
    statusId: i.statusId,
    position: i.position,
    assignee: i.assignee,
    assigneeAway: i.assigneeId && away.get(i.assigneeId)?.unavailable ? away.get(i.assigneeId)!.label : null,
    dueDate: i.dueDate ? formatDateShort(i.dueDate) : null,
    overdue: !!i.dueDate && i.dueDate < today && !doneIds.includes(i.statusId),
    labels: (i.labels ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    storyPoints: i.storyPoints,
    comments: i._count.comments,
    subTasks: { total: i.subTasks.length, done: i.subTasks.filter((s) => s.status.category === "DONE").length },
    epic: i.epic?.title ?? null,
  }));

  const daysLeft = activeSprint?.endDate ? Math.round((activeSprint.endDate.getTime() - today.getTime()) / 86400000) : null;

  return (
    <>
      {activeSprint ? (
        <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
          <Badge tone="brand">Active sprint</Badge>
          <span className="font-medium">{activeSprint.name}</span>
          {activeSprint.goal && <span className="text-muted">— {activeSprint.goal}</span>}
          <span className="text-xs text-muted">
            {formatDate(activeSprint.startDate)} → {formatDate(activeSprint.endDate)}
            {daysLeft != null && <> · {daysLeft >= 0 ? `${daysLeft} days left` : `${-daysLeft} days over`}</>}
          </span>
          <Link href={`/projects/${project.key}/backlog`} className={buttonClass("secondary", "sm", "ml-auto")}>
            Complete sprint
          </Link>
        </div>
      ) : (
        <p className="mb-3 text-xs text-muted">Kanban view — all open work, plus anything finished in the last 14 days. Start a sprint from the Backlog to switch this board to Scrum.</p>
      )}
      <FilterBar users={users} meId={user.id} />
      <Board
        columns={project.statuses.map((s) => ({ id: s.id, name: s.name, category: s.category, wipLimit: s.wipLimit }))}
        issues={data}
        projectId={project.id}
        sprintId={activeSprint?.id ?? null}
      />
    </>
  );
}
