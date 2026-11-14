import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { canManage } from "@/lib/auth";
import { getProject } from "@/lib/projects";
import { STATUS_CATEGORY_LABEL } from "@/lib/constants";
import { Card, CardHeader, Field, Badge } from "@/components/ui";
import { ActionForm, SubmitButton, ConfirmButton } from "@/components/form-bits";
import { updateProject, addStatus, updateStatus, moveStatus, deleteStatus, setProjectArchived } from "../../actions";

export const metadata = { title: "Project settings" };

export default async function ProjectSettingsPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const { user, project } = await getProject(key);
  const manager = canManage(user);
  const [clients, users, counts] = await Promise.all([
    db.client.findMany({ where: { orgId: user.orgId }, orderBy: { name: "asc" } }),
    db.user.findMany({ where: { orgId: user.orgId, active: true }, orderBy: { name: "asc" } }),
    db.issue.groupBy({ by: ["statusId"], where: { projectId: project.id }, _count: true }),
  ]);
  const countFor = (id: string) => counts.find((c) => c.statusId === id)?._count ?? 0;

  if (!manager) return <p className="text-sm text-muted">Only partners and managers can change project settings.</p>;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="self-start">
        <CardHeader title="Details" />
        <ActionForm action={updateProject.bind(null, project.id)} className="space-y-3 p-4">
          <Field label="Name">
            <input name="name" defaultValue={project.name} required className="field" />
          </Field>
          <Field label="Key" hint="The key can't be changed after creation.">
            <input value={project.key} disabled className="field font-mono" />
          </Field>
          <Field label="Client">
            <select name="clientId" defaultValue={project.clientId ?? ""} className="field">
              <option value="">Internal / multiple clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Lead">
            <select name="leadId" defaultValue={project.leadId ?? ""} className="field">
              <option value="">—</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Description">
            <textarea name="description" defaultValue={project.description ?? ""} rows={3} className="field" />
          </Field>
          <SubmitButton>Save</SubmitButton>
        </ActionForm>
        <div className="flex items-center justify-between border-t border-line px-4 py-3">
          <p className="text-xs text-muted">Archived projects are hidden from the sidebar and project list.</p>
          <form action={setProjectArchived.bind(null, project.id, !project.archived)}>
            <ConfirmButton message={project.archived ? "Restore this project?" : "Archive this project?"} className="text-xs font-medium text-red-700 hover:underline">
              {project.archived ? "Restore project" : "Archive project"}
            </ConfirmButton>
          </form>
        </div>
      </Card>

      <Card className="self-start">
        <CardHeader title="Workflow" subtitle="Columns on the board, left to right. Category drives reports and 'done' logic." />
        <ul className="divide-y divide-line">
          {project.statuses.map((s, i) => (
            <li key={s.id} className="flex items-center gap-2 px-4 py-2">
              <form action={updateStatus.bind(null, s.id)} className="flex flex-1 items-center gap-2">
                <input name="name" defaultValue={s.name} className="field h-8 flex-1 py-1" />
                <select name="category" defaultValue={s.category} className="field h-8 w-32 py-1 text-xs">
                  {Object.entries(STATUS_CATEGORY_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
                <input name="wipLimit" type="number" min={0} defaultValue={s.wipLimit ?? ""} placeholder="WIP" title="Max issues in this column (optional)" className="field h-8 w-16 py-1 text-xs" />
                <button className="rounded px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50">Save</button>
              </form>
              <Badge>{countFor(s.id)}</Badge>
              <form action={moveStatus.bind(null, s.id, -1)}>
                <button disabled={i === 0} className="rounded p-1 text-muted hover:bg-canvas disabled:opacity-30" title="Move left">
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
              </form>
              <form action={moveStatus.bind(null, s.id, 1)}>
                <button disabled={i === project.statuses.length - 1} className="rounded p-1 text-muted hover:bg-canvas disabled:opacity-30" title="Move right">
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </form>
              <form action={deleteStatus.bind(null, s.id)}>
                <ConfirmButton
                  message={`Delete "${s.name}"? Its ${countFor(s.id)} issues move to another status.`}
                  disabled={project.statuses.length <= 1}
                  className="rounded p-1 text-muted hover:bg-red-50 hover:text-red-700 disabled:opacity-30"
                  title="Delete status"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </ConfirmButton>
              </form>
            </li>
          ))}
        </ul>
        <ActionForm action={addStatus.bind(null, project.id)} resetOnSuccess className="flex gap-2 border-t border-line px-4 py-3">
          <input name="name" placeholder="New status, e.g. Waiting on client" className="field h-8 flex-1 py-1" />
          <select name="category" defaultValue="IN_PROGRESS" className="field h-8 w-32 py-1 text-xs">
            {Object.entries(STATUS_CATEGORY_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <SubmitButton size="sm" variant="secondary">
            Add
          </SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
