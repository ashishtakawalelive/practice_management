import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { availabilityOn } from "@/lib/availability";
import { ISSUE_TYPE_LABEL, PRIORITY_LABEL } from "@/lib/constants";
import { Card, EmptyState, Field, LinkButton, PageHeader } from "@/components/ui";
import { ActionForm, AutoSubmitSelect, SubmitButton } from "@/components/form-bits";
import { createIssue } from "../actions";

export const metadata = { title: "Create issue" };

export default async function NewIssuePage({ searchParams }: { searchParams: Promise<{ project?: string; type?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const projects = await db.project.findMany({ where: { orgId: user.orgId, archived: false }, orderBy: { name: "asc" } });
  if (projects.length === 0)
    return (
      <Card>
        <EmptyState title="Create a project first" action={<LinkButton href="/projects">Go to projects</LinkButton>}>
          Issues live inside projects.
        </EmptyState>
      </Card>
    );

  const project = projects.find((p) => p.id === sp.project || p.key === sp.project) ?? projects[0];
  const [users, sprints, epics, away] = await Promise.all([
    db.user.findMany({ where: { orgId: user.orgId, active: true }, orderBy: { name: "asc" } }),
    db.sprint.findMany({ where: { projectId: project.id, state: { not: "CLOSED" } }, orderBy: { createdAt: "asc" } }),
    db.issue.findMany({ where: { projectId: project.id, type: "EPIC" }, orderBy: { number: "asc" } }),
    availabilityOn(user.orgId),
  ]);
  const type = sp.type && ISSUE_TYPE_LABEL[sp.type] && sp.type !== "SUBTASK" ? sp.type : "TASK";

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Create issue" />
      <Card className="p-5">
        <form method="get" className="mb-4">
          <Field label="Project">
            <AutoSubmitSelect name="project" defaultValue={project.id} className="field">
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.key})
                </option>
              ))}
            </AutoSubmitSelect>
          </Field>
        </form>
        <ActionForm action={createIssue} className="space-y-4">
          <input type="hidden" name="projectId" value={project.id} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Issue type">
              <select name="type" defaultValue={type} className="field">
                {Object.entries(ISSUE_TYPE_LABEL)
                  .filter(([k]) => k !== "SUBTASK")
                  .map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Priority">
              <select name="priority" defaultValue="MEDIUM" className="field">
                {Object.entries(PRIORITY_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Summary">
            <input name="title" required autoFocus placeholder="e.g. GSTR-3B: Patil Engineering — October" className="field" />
          </Field>
          <Field label="Description">
            <textarea name="description" rows={5} className="field" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Assignee" hint="People away today are marked.">
              <select name="assigneeId" className="field">
                <option value="">Unassigned</option>
                {users.map((u) => {
                  const a = away.get(u.id);
                  return (
                    <option key={u.id} value={u.id}>
                      {u.name}
                      {a ? ` — ${a.label} today` : ""}
                    </option>
                  );
                })}
              </select>
            </Field>
            <Field label="Due date">
              <input type="date" name="dueDate" className="field" />
            </Field>
            <Field label="Epic">
              <select name="epicId" className="field">
                <option value="">None</option>
                {epics.map((e) => (
                  <option key={e.id} value={e.id}>
                    {project.key}-{e.number} {e.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Sprint">
              <select name="sprintId" className="field">
                <option value="">Backlog</option>
                {sprints.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.state === "ACTIVE" ? " (active)" : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Labels" hint="Comma-separated">
              <input name="labels" placeholder="gstr3b, monthly" className="field" />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Story points">
                <input name="storyPoints" type="number" min={0} className="field" />
              </Field>
              <Field label="Estimate">
                <input name="estimate" placeholder="2h 30m" className="field" />
              </Field>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <LinkButton href={`/projects/${project.key}/board`} variant="secondary">
              Cancel
            </LinkButton>
            <SubmitButton pendingText="Creating…">Create</SubmitButton>
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}
