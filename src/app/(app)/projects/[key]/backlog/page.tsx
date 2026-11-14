import Link from "next/link";
import { db } from "@/lib/db";
import { getProject } from "@/lib/projects";
import { formatDate, isoDate, todayIST } from "@/lib/dates";
import { ISSUE_TYPE_LABEL } from "@/lib/constants";
import { Avatar, Badge, Card, buttonClass } from "@/components/ui";
import { TypeIcon, StatusBadge, PriorityIcon } from "@/components/issue-bits";
import { ActionForm, AutoSubmitSelect, SubmitButton } from "@/components/form-bits";
import { createSprint, startSprint, completeSprint, deleteSprint, setIssueSprint } from "../../actions";
import { createIssue } from "../../../issues/actions";

export const metadata = { title: "Backlog" };

type Row = Awaited<ReturnType<typeof loadIssues>>[number];

async function loadIssues(projectId: string) {
  return db.issue.findMany({
    where: { projectId, type: { notIn: ["EPIC", "SUBTASK"] } },
    include: { status: true, assignee: true, epic: { select: { title: true } } },
    orderBy: [{ position: "asc" }],
  });
}

export default async function BacklogPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const { project } = await getProject(key);
  const [issues, epics] = await Promise.all([
    loadIssues(project.id),
    db.issue.findMany({
      where: { projectId: project.id, type: "EPIC" },
      include: { status: true, epicChildren: { select: { status: { select: { category: true } } } } },
      orderBy: { number: "asc" },
    }),
  ]);
  const sprints = [...project.sprints].sort((a, b) => (a.state === "ACTIVE" ? -1 : b.state === "ACTIVE" ? 1 : 0));
  const futureSprints = sprints.filter((s) => s.state === "FUTURE");
  const hasActive = sprints.some((s) => s.state === "ACTIVE");
  const backlog = issues.filter((i) => !i.sprintId && i.status.category !== "DONE");
  const sprintOptions = sprints.map((s) => ({ id: s.id, name: s.name }));

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_280px]">
      <div className="space-y-4">
        {sprints.map((s) => {
          const list = issues.filter((i) => i.sprintId === s.id);
          const points = list.reduce((sum, i) => sum + (i.storyPoints ?? 0), 0);
          const donePoints = list.filter((i) => i.status.category === "DONE").reduce((sum, i) => sum + (i.storyPoints ?? 0), 0);
          return (
            <Card key={s.id}>
              <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold">{s.name}</h2>
                    {s.state === "ACTIVE" ? <Badge tone="brand">Active</Badge> : <Badge>Planned</Badge>}
                    <span className="text-xs text-muted">
                      {list.length} issues · {donePoints}/{points} pts
                    </span>
                  </div>
                  <p className="text-xs text-muted">
                    {s.startDate ? `${formatDate(s.startDate)} → ${formatDate(s.endDate)}` : "Not started"}
                    {s.goal && ` · ${s.goal}`}
                  </p>
                </div>
                {s.state === "ACTIVE" ? (
                  <details className="relative">
                    <summary className={buttonClass("secondary", "sm", "cursor-pointer list-none")}>Complete sprint</summary>
                    <form action={completeSprint.bind(null, s.id)} className="absolute right-0 z-10 mt-1 w-72 space-y-2 rounded-lg border border-line bg-white p-3 shadow-lg">
                      <p className="text-xs text-muted">
                        {list.filter((i) => i.status.category !== "DONE").length} unfinished issues will move to:
                      </p>
                      <select name="moveTo" className="field">
                        <option value="">Backlog</option>
                        {futureSprints.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                      <SubmitButton size="sm" className="w-full">
                        Complete {s.name}
                      </SubmitButton>
                    </form>
                  </details>
                ) : (
                  <div className="flex items-center gap-1">
                    {!hasActive && (
                      <details className="relative">
                        <summary className={buttonClass("primary", "sm", "cursor-pointer list-none")}>Start sprint</summary>
                        <div className="absolute right-0 z-10 mt-1 w-80 rounded-lg border border-line bg-white p-3 shadow-lg">
                          <ActionForm action={startSprint.bind(null, s.id)} className="space-y-2">
                            <input name="name" defaultValue={s.name} className="field" />
                            <input name="goal" placeholder="Sprint goal" defaultValue={s.goal ?? ""} className="field" />
                            <div className="grid grid-cols-2 gap-2">
                              <input type="date" name="startDate" defaultValue={isoDate(todayIST())} className="field" />
                              <select name="weeks" defaultValue="2" className="field">
                                <option value="1">1 week</option>
                                <option value="2">2 weeks</option>
                                <option value="3">3 weeks</option>
                                <option value="4">4 weeks</option>
                              </select>
                            </div>
                            <SubmitButton size="sm" className="w-full">
                              Start
                            </SubmitButton>
                          </ActionForm>
                        </div>
                      </details>
                    )}
                    <form action={deleteSprint.bind(null, s.id)}>
                      <button className={buttonClass("ghost", "sm")} title="Delete sprint (issues return to backlog)">
                        Delete
                      </button>
                    </form>
                  </div>
                )}
              </div>
              <IssueRows rows={list} projectKey={project.key} sprints={sprintOptions} empty="Plan work by moving issues here from the backlog." />
            </Card>
          );
        })}

        <Card>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold">
              Backlog <span className="font-normal text-muted">· {backlog.length} issues</span>
            </h2>
            <form action={createSprint.bind(null, project.id)}>
              <button className={buttonClass("secondary", "sm")}>Create sprint</button>
            </form>
          </div>
          <IssueRows rows={backlog} projectKey={project.key} sprints={sprintOptions} empty="The backlog is empty." />
          <ActionForm action={createIssue} resetOnSuccess className="flex gap-2 border-t border-line px-4 py-2.5">
            <input type="hidden" name="projectId" value={project.id} />
            <input type="hidden" name="stay" value="1" />
            <select name="type" defaultValue="TASK" className="field h-8 w-28 py-1 text-xs">
              {["STORY", "TASK", "BUG"].map((t) => (
                <option key={t} value={t}>
                  {ISSUE_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
            <input name="title" placeholder="+ Add an issue to the backlog" className="field h-8 flex-1 py-1 text-sm" />
            <SubmitButton size="sm" variant="secondary">
              Add
            </SubmitButton>
          </ActionForm>
        </Card>
      </div>

      <Card className="self-start">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">Epics</h2>
        </div>
        <div className="divide-y divide-line">
          {epics.length === 0 && <p className="px-4 py-4 text-xs text-muted">No epics. Create one to group related stories and tasks.</p>}
          {epics.map((e) => {
            const total = e.epicChildren.length;
            const done = e.epicChildren.filter((c) => c.status.category === "DONE").length;
            return (
              <Link key={e.id} href={`/issues/${project.key}-${e.number}`} className="block px-4 py-2.5 hover:bg-canvas/60">
                <div className="flex items-center gap-2">
                  <TypeIcon type="EPIC" size={14} />
                  <span className="truncate text-sm">{e.title}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full bg-violet-500" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
                  </div>
                  <span className="text-[10px] tabular-nums text-muted">
                    {done}/{total}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
        <div className="border-t border-line px-4 py-2.5">
          <Link href={`/issues/new?project=${project.id}&type=EPIC`} className="text-xs font-medium text-brand-700 hover:underline">
            + Create epic
          </Link>
        </div>
      </Card>
    </div>
  );
}

function IssueRows({ rows, projectKey, sprints, empty }: { rows: Row[]; projectKey: string; sprints: { id: string; name: string }[]; empty: string }) {
  if (rows.length === 0) return <p className="px-4 py-4 text-center text-xs text-muted">{empty}</p>;
  return (
    <ul className="divide-y divide-line">
      {rows.map((i) => (
        <li key={i.id} className="flex items-center gap-3 px-4 py-2 hover:bg-canvas/50">
          <TypeIcon type={i.type} size={14} />
          <Link href={`/issues/${projectKey}-${i.number}`} className="w-16 shrink-0 font-mono text-xs text-muted hover:underline">
            {projectKey}-{i.number}
          </Link>
          <Link href={`/issues/${projectKey}-${i.number}`} className="min-w-0 flex-1 truncate text-sm hover:text-brand-700">
            {i.title}
          </Link>
          {i.epic && <span className="hidden max-w-36 truncate rounded bg-violet-50 px-1.5 text-[10px] font-medium text-violet-700 md:inline">{i.epic.title}</span>}
          <StatusBadge name={i.status.name} category={i.status.category} />
          <PriorityIcon priority={i.priority} />
          <span className="w-6 text-center text-xs tabular-nums text-muted">{i.storyPoints ?? "–"}</span>
          <Avatar name={i.assignee?.name} size={22} />
          <form action={setIssueSprint.bind(null, i.id)}>
            <AutoSubmitSelect name="value" defaultValue={i.sprintId ?? ""} className="h-7 rounded border border-transparent bg-transparent px-1 text-xs text-muted hover:border-line">
              <option value="">Backlog</option>
              {sprints.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </AutoSubmitSelect>
          </form>
        </li>
      ))}
    </ul>
  );
}
