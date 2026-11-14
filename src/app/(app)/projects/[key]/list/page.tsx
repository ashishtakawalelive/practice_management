import Link from "next/link";
import { Download } from "lucide-react";
import { db } from "@/lib/db";
import { getProject, issueWhere, type IssueFilters } from "@/lib/projects";
import { formatDate, relativeTime, todayIST } from "@/lib/dates";
import { PRIORITY_RANK } from "@/lib/constants";
import { FilterBar } from "@/components/filter-bar";
import { Avatar, Card, EmptyState, Table, Td, Th, buttonClass, cn } from "@/components/ui";
import { TypeIcon, StatusBadge, PriorityIcon, Labels } from "@/components/issue-bits";

export const metadata = { title: "Issues" };

const SORTS: Record<string, string> = { key: "Key", priority: "Priority", due: "Due", updated: "Updated", status: "Status" };

export default async function ListPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<IssueFilters & { sort?: string; done?: string }>;
}) {
  const { key } = await params;
  const sp = await searchParams;
  const { user, project } = await getProject(key);
  const sort = sp.sort && SORTS[sp.sort] ? sp.sort : "key";
  const today = todayIST();

  const [issues, users] = await Promise.all([
    db.issue.findMany({
      where: {
        projectId: project.id,
        ...(sp.done === "1" ? {} : { status: { category: { not: "DONE" } } }),
        ...issueWhere(sp, user.id),
      },
      include: { status: true, assignee: true, sprint: true, parent: { select: { number: true } } },
    }),
    db.user.findMany({ where: { orgId: user.orgId, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const statusPos = new Map(project.statuses.map((s) => [s.id, s.position]));
  issues.sort((a, b) => {
    switch (sort) {
      case "priority":
        return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      case "due":
        return (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity);
      case "updated":
        return b.updatedAt.getTime() - a.updatedAt.getTime();
      case "status":
        return (statusPos.get(a.statusId) ?? 0) - (statusPos.get(b.statusId) ?? 0);
      default:
        return b.number - a.number;
    }
  });

  const qs = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...extra }).filter(([, v]) => v) as [string, string][]);
    return `?${p.toString()}`;
  };

  return (
    <>
      <FilterBar
        users={users}
        meId={user.id}
        extra={
          <>
            <Link href={qs({ done: sp.done === "1" ? undefined : "1" })} className="text-xs text-muted hover:text-ink">
              {sp.done === "1" ? "Hide done" : "Show done"}
            </Link>
            <a href={`/projects/${project.key}/export`} className={buttonClass("secondary", "sm")}>
              <Download className="h-3.5 w-3.5" /> CSV
            </a>
          </>
        }
      />
      <Card>
        {issues.length === 0 ? (
          <EmptyState title="No issues match these filters" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th className="w-8" />
                {(["key"] as const).map((s) => (
                  <Th key={s}>
                    <SortLink label="Key" active={sort === "key"} href={qs({ sort: "key" })} />
                  </Th>
                ))}
                <Th>Summary</Th>
                <Th>
                  <SortLink label="Status" active={sort === "status"} href={qs({ sort: "status" })} />
                </Th>
                <Th>Assignee</Th>
                <Th>
                  <SortLink label="Priority" active={sort === "priority"} href={qs({ sort: "priority" })} />
                </Th>
                <Th>
                  <SortLink label="Due" active={sort === "due"} href={qs({ sort: "due" })} />
                </Th>
                <Th>Sprint</Th>
                <Th>
                  <SortLink label="Updated" active={sort === "updated"} href={qs({ sort: "updated" })} />
                </Th>
              </tr>
            </thead>
            <tbody>
              {issues.map((i) => {
                const overdue = i.dueDate && i.dueDate < today && i.status.category !== "DONE";
                return (
                  <tr key={i.id} className="hover:bg-canvas/50">
                    <Td>
                      <TypeIcon type={i.type} size={14} />
                    </Td>
                    <Td className="font-mono text-xs whitespace-nowrap">
                      <Link href={`/issues/${project.key}-${i.number}`} className="text-muted hover:underline">
                        {project.key}-{i.number}
                      </Link>
                    </Td>
                    <Td>
                      <Link href={`/issues/${project.key}-${i.number}`} className="hover:text-brand-700">
                        {i.parent && <span className="mr-1 text-xs text-muted">{project.key}-{i.parent.number} /</span>}
                        {i.title}
                      </Link>
                      <span className="ml-2 inline-flex gap-1">
                        <Labels labels={i.labels} />
                      </span>
                    </Td>
                    <Td>
                      <StatusBadge name={i.status.name} category={i.status.category} />
                    </Td>
                    <Td>
                      <span className="flex items-center gap-1.5 whitespace-nowrap text-sm">
                        <Avatar name={i.assignee?.name} size={20} />
                        {i.assignee?.name ?? <span className="text-muted">Unassigned</span>}
                      </span>
                    </Td>
                    <Td>
                      <PriorityIcon priority={i.priority} withLabel />
                    </Td>
                    <Td className={cn("whitespace-nowrap text-sm", overdue ? "font-medium text-red-600" : "text-muted")}>{formatDate(i.dueDate)}</Td>
                    <Td className="text-xs whitespace-nowrap text-muted">{i.sprint?.name ?? "—"}</Td>
                    <Td className="text-xs whitespace-nowrap text-muted">{relativeTime(i.updatedAt)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
      <p className="mt-2 text-xs text-muted">{issues.length} issues</p>
    </>
  );
}

function SortLink({ label, active, href }: { label: string; active: boolean; href: string }) {
  return (
    <Link href={href} className={cn("hover:text-ink", active && "text-brand-700")}>
      {label}
      {active && " ↓"}
    </Link>
  );
}
