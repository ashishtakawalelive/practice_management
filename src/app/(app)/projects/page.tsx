import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Avatar, Card, CardHeader, EmptyState, Field, PageHeader, Table, Td, Th, Badge } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/form-bits";
import { createProject } from "./actions";

export const metadata = { title: "Projects" };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ archived?: string }> }) {
  const user = await requireUser();
  const showArchived = (await searchParams).archived === "1";
  const [projects, clients, users] = await Promise.all([
    db.project.findMany({
      where: { orgId: user.orgId, archived: showArchived },
      include: {
        client: true,
        lead: true,
        issues: { select: { status: { select: { category: true } }, dueDate: true } },
      },
      orderBy: { name: "asc" },
    }),
    db.client.findMany({ where: { orgId: user.orgId, active: true }, orderBy: { name: "asc" } }),
    db.user.findMany({ where: { orgId: user.orgId, active: true }, orderBy: { name: "asc" } }),
  ]);
  const today = new Date();

  return (
    <>
      <PageHeader
        title="Projects"
        subtitle="Each project has its own board, backlog and workflow."
        actions={
          <Link href={showArchived ? "/projects" : "/projects?archived=1"} className="text-sm text-muted hover:text-ink">
            {showArchived ? "← Active projects" : "View archived"}
          </Link>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <Card>
          {projects.length === 0 ? (
            <EmptyState title={showArchived ? "No archived projects" : "No projects yet"}>
              Create a project for a client engagement (e.g. Statutory Audit) or a recurring stream of work (e.g. GST Compliance).
            </EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Project</Th>
                  <Th>Key</Th>
                  <Th>Client</Th>
                  <Th>Lead</Th>
                  <Th className="text-right">Open</Th>
                  <Th className="text-right">Overdue</Th>
                  <Th>Progress</Th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => {
                  const total = p.issues.length;
                  const done = p.issues.filter((i) => i.status.category === "DONE").length;
                  const overdue = p.issues.filter((i) => i.status.category !== "DONE" && i.dueDate && i.dueDate < today).length;
                  const pct = total ? Math.round((done / total) * 100) : 0;
                  return (
                    <tr key={p.id} className="hover:bg-canvas/50">
                      <Td>
                        <Link href={`/projects/${p.key}/board`} className="font-medium text-ink hover:text-brand-700">
                          {p.name}
                        </Link>
                        {p.description && <p className="max-w-md truncate text-xs text-muted">{p.description}</p>}
                      </Td>
                      <Td className="font-mono text-xs">{p.key}</Td>
                      <Td className="text-sm">{p.client ? <Link href={`/clients/${p.client.id}`} className="hover:underline">{p.client.name}</Link> : <span className="text-muted">Internal / multiple</span>}</Td>
                      <Td>
                        <span className="flex items-center gap-2 text-sm">
                          <Avatar name={p.lead?.name} size={22} /> {p.lead?.name ?? "—"}
                        </span>
                      </Td>
                      <Td className="text-right tabular-nums">{total - done}</Td>
                      <Td className="text-right">{overdue ? <Badge tone="red">{overdue}</Badge> : <span className="text-muted">0</span>}</Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs tabular-nums text-muted">{pct}%</span>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>

        <Card className="self-start">
          <CardHeader title="New project" />
          <ActionForm action={createProject} className="space-y-3 p-4">
            <Field label="Name">
              <input name="name" required placeholder="e.g. Statutory Audit FY 2025-26" className="field" />
            </Field>
            <Field label="Key" hint="Prefix for issue numbers, e.g. AUD → AUD-1">
              <input name="key" required maxLength={10} placeholder="AUD" className="field font-mono uppercase" />
            </Field>
            <Field label="Client (optional)">
              <select name="clientId" className="field">
                <option value="">Internal / multiple clients</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Project lead">
              <select name="leadId" defaultValue={user.id} className="field">
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Description">
              <textarea name="description" rows={2} className="field" />
            </Field>
            <SubmitButton className="w-full" pendingText="Creating…">
              Create project
            </SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
