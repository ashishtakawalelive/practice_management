import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Eye, EyeOff, Trash2, X } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { availabilityOn, conflictFor } from "@/lib/availability";
import { ISSUE_TYPE_LABEL, PRIORITY_LABEL, LINK_TYPES, AVAILABILITY_LABEL } from "@/lib/constants";
import { formatDate, formatDateTime, formatMinutes, isoDate, relativeTime, todayIST } from "@/lib/dates";
import { Avatar, Card, Badge } from "@/components/ui";
import { TypeIcon, StatusBadge, PriorityIcon } from "@/components/issue-bits";
import { ActionForm, AutoSubmitSelect, SubmitButton, ConfirmButton } from "@/components/form-bits";
import { InlineText, ActivityTabs } from "./inline";
import {
  updateIssueField,
  addComment,
  deleteComment,
  logWork,
  deleteWorkLog,
  addLink,
  removeLink,
  toggleWatch,
  deleteIssue,
  createIssue,
} from "../actions";

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }) {
  return { title: decodeURIComponent((await params).key) };
}

export default async function IssuePage({ params }: { params: Promise<{ key: string }> }) {
  const raw = decodeURIComponent((await params).key).toUpperCase();
  const m = raw.match(/^([A-Z0-9]+)-(\d+)$/);
  if (!m) notFound();
  const user = await requireUser();

  const issue = await db.issue.findFirst({
    where: { orgId: user.orgId, number: parseInt(m[2], 10), project: { key: m[1] } },
    include: {
      project: { include: { statuses: { orderBy: { position: "asc" } }, sprints: { where: { state: { not: "CLOSED" } } } } },
      status: true,
      assignee: true,
      reporter: true,
      parent: { select: { number: true, title: true, type: true } },
      epic: { select: { number: true, title: true } },
      sprint: true,
      subTasks: { include: { status: true, assignee: true }, orderBy: { number: "asc" } },
      epicChildren: { include: { status: true, assignee: true }, orderBy: { number: "asc" } },
      comments: { include: { author: true }, orderBy: { createdAt: "asc" } },
      activities: { include: { actor: true }, orderBy: { createdAt: "desc" }, take: 50 },
      workLogs: { include: { user: true }, orderBy: { date: "desc" } },
      watchers: { include: { user: true } },
      linksOut: { include: { to: { include: { project: true, status: true } } } },
      linksIn: { include: { from: { include: { project: true, status: true } } } },
    },
  });
  if (!issue) notFound();

  const pk = issue.project.key;
  const [users, epics, away] = await Promise.all([
    db.user.findMany({ where: { orgId: user.orgId, active: true }, orderBy: { name: "asc" } }),
    db.issue.findMany({ where: { projectId: issue.projectId, type: "EPIC" }, select: { id: true, number: true, title: true } }),
    availabilityOn(user.orgId),
  ]);
  const dueConflict = issue.assigneeId && issue.dueDate && issue.status.category !== "DONE" ? await conflictFor(issue.assigneeId, issue.dueDate) : null;
  const assigneeToday = issue.assigneeId ? away.get(issue.assigneeId) : undefined;

  const logged = issue.workLogs.reduce((s, w) => s + w.minutes, 0);
  const watching = issue.watchers.some((w) => w.userId === user.id);
  const overdue = issue.dueDate && issue.dueDate < todayIST() && issue.status.category !== "DONE";
  const set = (field: string) => updateIssueField.bind(null, issue.id, field);
  const children = issue.type === "EPIC" ? issue.epicChildren : issue.subTasks;

  const links = [
    ...issue.linksOut.map((l) => ({ id: l.id, label: LINK_TYPES[l.type].out, other: l.to })),
    ...issue.linksIn.map((l) => ({ id: l.id, label: LINK_TYPES[l.type].in, other: l.from })),
  ];

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs text-muted">
        <Link href="/projects" className="hover:underline">
          Projects
        </Link>
        /
        <Link href={`/projects/${pk}/board`} className="hover:underline">
          {issue.project.name}
        </Link>
        {issue.epic && (
          <>
            /
            <Link href={`/issues/${pk}-${issue.epic.number}`} className="inline-flex items-center gap-1 hover:underline">
              <TypeIcon type="EPIC" size={12} /> {pk}-{issue.epic.number}
            </Link>
          </>
        )}
        {issue.parent && (
          <>
            /
            <Link href={`/issues/${pk}-${issue.parent.number}`} className="inline-flex items-center gap-1 hover:underline">
              <TypeIcon type={issue.parent.type} size={12} /> {pk}-{issue.parent.number}
            </Link>
          </>
        )}
        /
        <span className="inline-flex items-center gap-1 font-mono text-ink">
          <TypeIcon type={issue.type} size={12} /> {pk}-{issue.number}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Main column */}
        <div className="min-w-0 space-y-6">
          <InlineText action={set("title")} value={issue.title} placeholder="Summary" className="text-2xl font-semibold tracking-tight" />

          {(dueConflict || assigneeToday?.unavailable) && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                {assigneeToday?.unavailable && (
                  <p>
                    {issue.assignee?.name} is <strong>{assigneeToday.label.toLowerCase()}</strong> today{assigneeToday.note ? ` (${assigneeToday.note})` : ""}.
                  </p>
                )}
                {dueConflict && (
                  <p>
                    The due date ({formatDate(issue.dueDate)}) falls on {issue.assignee?.name}&apos;s {AVAILABILITY_LABEL[dueConflict.type].toLowerCase()}
                    {dueConflict.status === "PENDING" ? " (pending approval)" : ""}. Consider reassigning or moving the date.
                  </p>
                )}
              </div>
            </div>
          )}

          <section>
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">Description</h3>
            <InlineText action={set("description")} value={issue.description ?? ""} multiline placeholder="Add a description…" />
          </section>

          {(issue.type !== "SUBTASK" || children.length > 0) && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
                {issue.type === "EPIC" ? "Issues in this epic" : "Sub-tasks"}
                {children.length > 0 && (
                  <span className="ml-2 font-normal normal-case">
                    {children.filter((c) => c.status.category === "DONE").length}/{children.length} done
                  </span>
                )}
              </h3>
              <Card>
                <ul className="divide-y divide-line">
                  {children.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 px-3 py-2">
                      <TypeIcon type={c.type} size={14} />
                      <Link href={`/issues/${pk}-${c.number}`} className="font-mono text-xs text-muted hover:underline">
                        {pk}-{c.number}
                      </Link>
                      <Link href={`/issues/${pk}-${c.number}`} className={`flex-1 truncate text-sm hover:text-brand-700 ${c.status.category === "DONE" ? "text-muted line-through" : ""}`}>
                        {c.title}
                      </Link>
                      <Avatar name={c.assignee?.name} size={20} />
                      <StatusBadge name={c.status.name} category={c.status.category} />
                    </li>
                  ))}
                </ul>
                {issue.type !== "SUBTASK" && (
                  <ActionForm action={createIssue} resetOnSuccess className="flex gap-2 border-t border-line px-3 py-2">
                    <input type="hidden" name="projectId" value={issue.projectId} />
                    <input type="hidden" name="stay" value="1" />
                    {issue.type === "EPIC" ? (
                      <>
                        <input type="hidden" name="type" value="TASK" />
                        <input type="hidden" name="epicId" value={issue.id} />
                      </>
                    ) : (
                      <>
                        <input type="hidden" name="type" value="SUBTASK" />
                        <input type="hidden" name="parentId" value={issue.id} />
                        {issue.sprintId && <input type="hidden" name="sprintId" value={issue.sprintId} />}
                      </>
                    )}
                    <input name="title" placeholder={issue.type === "EPIC" ? "+ Add a task to this epic" : "+ Add a sub-task"} className="field h-8 flex-1 py-1" />
                    <select name="assigneeId" className="field h-8 w-36 py-1 text-xs">
                      <option value="">Unassigned</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                    <SubmitButton size="sm" variant="secondary">
                      Add
                    </SubmitButton>
                  </ActionForm>
                )}
              </Card>
            </section>
          )}

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Linked issues</h3>
            <Card>
              {links.length > 0 && (
                <ul className="divide-y divide-line">
                  {links.map((l) => (
                    <li key={l.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <span className="w-28 text-xs text-muted">{l.label}</span>
                      <Link href={`/issues/${l.other.project.key}-${l.other.number}`} className="font-mono text-xs text-muted hover:underline">
                        {l.other.project.key}-{l.other.number}
                      </Link>
                      <span className="flex-1 truncate">{l.other.title}</span>
                      <StatusBadge name={l.other.status.name} category={l.other.status.category} />
                      <form action={removeLink.bind(null, l.id)}>
                        <button className="rounded p-1 text-muted hover:bg-canvas hover:text-ink" title="Remove link">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
              <ActionForm action={addLink.bind(null, issue.id)} resetOnSuccess className="flex flex-wrap gap-2 border-t border-line px-3 py-2 first:border-t-0">
                <select name="direction" className="field h-8 w-auto py-1 text-xs">
                  <option value="out">This issue</option>
                  <option value="in">Other issue</option>
                </select>
                <select name="type" className="field h-8 w-auto py-1 text-xs">
                  {Object.entries(LINK_TYPES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.out}
                    </option>
                  ))}
                </select>
                <input name="target" placeholder="Issue key, e.g. GST-3" className="field h-8 w-40 py-1 font-mono text-xs uppercase" />
                <SubmitButton size="sm" variant="secondary">
                  Link
                </SubmitButton>
              </ActionForm>
            </Card>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Activity</h3>
            <ActivityTabs
              tabs={[
                {
                  id: "comments",
                  label: `Comments (${issue.comments.length})`,
                  content: (
                    <div className="space-y-4">
                      {issue.comments.map((c) => (
                        <div key={c.id} className="flex gap-3">
                          <Avatar name={c.author.name} size={28} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="font-medium text-ink">{c.author.name}</span>
                              <span className="text-muted">{relativeTime(c.createdAt)}</span>
                              {c.authorId === user.id && (
                                <form action={deleteComment.bind(null, c.id)} className="ml-auto">
                                  <button className="text-muted hover:text-red-700">Delete</button>
                                </form>
                              )}
                            </div>
                            <p className="mt-1 text-sm whitespace-pre-wrap">{c.body}</p>
                          </div>
                        </div>
                      ))}
                      <ActionForm action={addComment.bind(null, issue.id)} resetOnSuccess className="flex gap-3">
                        <Avatar name={user.name} size={28} />
                        <div className="flex-1 space-y-2">
                          <textarea name="body" rows={2} placeholder="Add a comment… (mention a colleague by name)" className="field" />
                          <SubmitButton size="sm">Comment</SubmitButton>
                        </div>
                      </ActionForm>
                    </div>
                  ),
                },
                {
                  id: "work",
                  label: `Work log (${formatMinutes(logged)})`,
                  content: (
                    <div className="space-y-3">
                      <ActionForm action={logWork.bind(null, issue.id)} resetOnSuccess className="flex flex-wrap items-end gap-2 rounded-md border border-line bg-white p-3">
                        <label className="w-28">
                          <span className="label">Time spent</span>
                          <input name="time" placeholder="1h 30m" className="field h-8 py-1" />
                        </label>
                        <label className="w-36">
                          <span className="label">Date</span>
                          <input name="date" type="date" defaultValue={isoDate(todayIST())} className="field h-8 py-1" />
                        </label>
                        <label className="min-w-40 flex-1">
                          <span className="label">What did you do?</span>
                          <input name="note" className="field h-8 py-1" />
                        </label>
                        <label className="flex h-8 items-center gap-1.5 text-xs">
                          <input type="checkbox" name="billable" defaultChecked /> Billable
                        </label>
                        <SubmitButton size="sm">Log</SubmitButton>
                      </ActionForm>
                      {issue.workLogs.length === 0 && <p className="text-sm text-muted">No time logged yet.</p>}
                      <ul className="divide-y divide-line">
                        {issue.workLogs.map((w) => (
                          <li key={w.id} className="flex items-center gap-3 py-2 text-sm">
                            <Avatar name={w.user.name} size={22} />
                            <span className="w-32 truncate">{w.user.name}</span>
                            <span className="w-16 font-medium tabular-nums">{formatMinutes(w.minutes)}</span>
                            <span className="w-24 text-xs text-muted">{formatDate(w.date)}</span>
                            <span className="flex-1 truncate text-muted">{w.note}</span>
                            {w.billable ? <Badge tone="green">Billable</Badge> : <Badge>Non-billable</Badge>}
                            {w.userId === user.id && (
                              <form action={deleteWorkLog.bind(null, w.id)}>
                                <button className="text-xs text-muted hover:text-red-700">Delete</button>
                              </form>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ),
                },
                {
                  id: "history",
                  label: "History",
                  content: (
                    <ul className="space-y-2.5">
                      {issue.activities.map((a) => (
                        <li key={a.id} className="flex items-start gap-2.5 text-sm">
                          <Avatar name={a.actor.name} size={22} />
                          <div>
                            <span className="font-medium">{a.actor.name}</span>{" "}
                            {a.action === "created" && <span className="text-muted">created the issue</span>}
                            {a.action === "logged_work" && <span className="text-muted">logged {formatMinutes(Number(a.toValue))}</span>}
                            {a.action === "updated" && (
                              <span className="text-muted">
                                changed <span className="text-ink">{a.field}</span>
                                {a.field !== "description" && (
                                  <>
                                    {" "}
                                    from <span className="text-ink">{a.fromValue ?? "none"}</span> to <span className="text-ink">{a.toValue ?? "none"}</span>
                                  </>
                                )}
                              </span>
                            )}
                            <div className="text-xs text-muted">{formatDateTime(a.createdAt)}</div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ),
                },
              ]}
            />
          </section>
        </div>

        {/* Details sidebar */}
        <aside className="space-y-4">
          <div className="flex items-center gap-2">
            <form action={set("statusId")} className="flex-1">
              <AutoSubmitSelect
                name="value"
                defaultValue={issue.statusId}
                className={`field font-medium ${issue.status.category === "DONE" ? "border-emerald-300 bg-emerald-50 text-emerald-800" : issue.status.category === "IN_PROGRESS" ? "border-sky-300 bg-sky-50 text-sky-800" : ""}`}
              >
                {issue.project.statuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </AutoSubmitSelect>
            </form>
            <form action={toggleWatch.bind(null, issue.id)}>
              <button title={watching ? "Stop watching" : "Watch"} className="flex h-9 items-center gap-1 rounded-md border border-line bg-white px-2.5 text-xs text-muted hover:text-ink">
                {watching ? <Eye className="h-4 w-4 text-brand-600" /> : <EyeOff className="h-4 w-4" />} {issue.watchers.length}
              </button>
            </form>
          </div>

          <Card className="divide-y divide-line text-sm">
            <Detail label="Assignee">
              <form action={set("assigneeId")}>
                <AutoSubmitSelect name="value" defaultValue={issue.assigneeId ?? ""} className="w-full rounded border border-transparent bg-transparent py-0.5 hover:border-line">
                  <option value="">Unassigned</option>
                  {users.map((u) => {
                    const a = away.get(u.id);
                    return (
                      <option key={u.id} value={u.id}>
                        {u.name}
                        {a ? ` — ${a.label}` : ""}
                      </option>
                    );
                  })}
                </AutoSubmitSelect>
              </form>
            </Detail>
            <Detail label="Reporter">
              <span className="flex items-center gap-1.5">
                <Avatar name={issue.reporter.name} size={20} /> {issue.reporter.name}
              </span>
            </Detail>
            <Detail label="Type">
              <form action={set("type")} className="flex items-center gap-1.5">
                <TypeIcon type={issue.type} size={14} />
                <AutoSubmitSelect name="value" defaultValue={issue.type} className="flex-1 rounded border border-transparent bg-transparent py-0.5 hover:border-line">
                  {Object.entries(ISSUE_TYPE_LABEL)
                    .filter(([k]) => (issue.type === "SUBTASK") === (k === "SUBTASK"))
                    .map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                </AutoSubmitSelect>
              </form>
            </Detail>
            <Detail label="Priority">
              <form action={set("priority")} className="flex items-center gap-1.5">
                <PriorityIcon priority={issue.priority} />
                <AutoSubmitSelect name="value" defaultValue={issue.priority} className="flex-1 rounded border border-transparent bg-transparent py-0.5 hover:border-line">
                  {Object.entries(PRIORITY_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </AutoSubmitSelect>
              </form>
            </Detail>
            <Detail label="Due date">
              <form action={set("dueDate")} className="flex items-center gap-1">
                <input type="date" name="value" defaultValue={isoDate(issue.dueDate)} className={`flex-1 rounded border border-transparent bg-transparent py-0.5 hover:border-line ${overdue ? "font-medium text-red-600" : ""}`} />
                <SubmitButton size="sm" variant="ghost" className="h-6 px-1.5" pendingText="…">
                  Set
                </SubmitButton>
              </form>
            </Detail>
            <Detail label="Start date">
              <form action={set("startDate")} className="flex items-center gap-1">
                <input type="date" name="value" defaultValue={isoDate(issue.startDate)} className="flex-1 rounded border border-transparent bg-transparent py-0.5 hover:border-line" />
                <SubmitButton size="sm" variant="ghost" className="h-6 px-1.5" pendingText="…">
                  Set
                </SubmitButton>
              </form>
            </Detail>
            {issue.type !== "EPIC" && issue.type !== "SUBTASK" && (
              <>
                <Detail label="Sprint">
                  <form action={set("sprintId")}>
                    <AutoSubmitSelect name="value" defaultValue={issue.sprintId ?? ""} className="w-full rounded border border-transparent bg-transparent py-0.5 hover:border-line">
                      <option value="">Backlog</option>
                      {issue.sprint && issue.sprint.state === "CLOSED" && <option value={issue.sprint.id}>{issue.sprint.name} (closed)</option>}
                      {issue.project.sprints.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </AutoSubmitSelect>
                  </form>
                </Detail>
                <Detail label="Epic">
                  <form action={set("epicId")}>
                    <AutoSubmitSelect name="value" defaultValue={issue.epicId ?? ""} className="w-full rounded border border-transparent bg-transparent py-0.5 hover:border-line">
                      <option value="">None</option>
                      {epics.map((e) => (
                        <option key={e.id} value={e.id}>
                          {pk}-{e.number} {e.title}
                        </option>
                      ))}
                    </AutoSubmitSelect>
                  </form>
                </Detail>
              </>
            )}
            <Detail label="Labels">
              <form action={set("labels")} className="flex items-center gap-1">
                <input name="value" defaultValue={issue.labels ?? ""} placeholder="gstr1, monthly" className="min-w-0 flex-1 rounded border border-transparent bg-transparent py-0.5 hover:border-line" />
                <SubmitButton size="sm" variant="ghost" className="h-6 px-1.5" pendingText="…">
                  Set
                </SubmitButton>
              </form>
            </Detail>
            <Detail label="Story points">
              <form action={set("storyPoints")} className="flex items-center gap-1">
                <input name="value" type="number" min={0} defaultValue={issue.storyPoints ?? ""} className="w-16 rounded border border-transparent bg-transparent py-0.5 hover:border-line" />
                <SubmitButton size="sm" variant="ghost" className="h-6 px-1.5" pendingText="…">
                  Set
                </SubmitButton>
              </form>
            </Detail>
            <Detail label="Time tracking">
              <div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${issue.estimateMins && logged > issue.estimateMins ? "bg-amber-500" : "bg-sky-500"}`}
                    style={{ width: `${issue.estimateMins ? Math.min(100, (logged / issue.estimateMins) * 100) : logged ? 100 : 0}%` }}
                  />
                </div>
                <div className="mt-1 flex justify-between text-xs text-muted">
                  <span>{formatMinutes(logged)} logged</span>
                  <form action={set("estimateMins")} className="flex items-center gap-1">
                    <span>est.</span>
                    <input name="value" defaultValue={issue.estimateMins ? formatMinutes(issue.estimateMins) : ""} placeholder="—" className="w-14 rounded border border-transparent bg-transparent text-right hover:border-line" />
                  </form>
                </div>
              </div>
            </Detail>
          </Card>

          <div className="space-y-0.5 px-1 text-xs text-muted">
            <p>Created {formatDateTime(issue.createdAt)}</p>
            <p>Updated {relativeTime(issue.updatedAt)}</p>
            {issue.resolvedAt && <p>Resolved {formatDateTime(issue.resolvedAt)}</p>}
          </div>

          <form action={deleteIssue.bind(null, issue.id)} className="px-1">
            <ConfirmButton message={`Delete ${pk}-${issue.number}? This can't be undone.`} className="inline-flex items-center gap-1 text-xs text-muted hover:text-red-700">
              <Trash2 className="h-3.5 w-3.5" /> Delete issue
            </ConfirmButton>
          </form>
        </aside>
      </div>
    </>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_1fr] items-center gap-2 px-3 py-2">
      <span className="text-xs text-muted">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
