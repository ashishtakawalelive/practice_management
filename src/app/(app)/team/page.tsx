import { db } from "@/lib/db";
import { canManage, requireUser } from "@/lib/auth";
import { availabilityOn } from "@/lib/availability";
import { ROLE_LABEL } from "@/lib/constants";
import { Avatar, Badge, Card, CardHeader, Field, PageHeader, Table, Td, Th } from "@/components/ui";
import { ActionForm, SubmitButton, ConfirmButton } from "@/components/form-bits";
import { addMember, updateMember, setMemberActive, changePassword } from "./actions";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  const user = await requireUser();
  const manager = canManage(user);
  const [members, away, openCounts] = await Promise.all([
    db.user.findMany({ where: { orgId: user.orgId }, orderBy: [{ active: "desc" }, { name: "asc" }] }),
    availabilityOn(user.orgId),
    db.issue.groupBy({ by: ["assigneeId"], where: { orgId: user.orgId, status: { category: { not: "DONE" } } }, _count: true }),
  ]);
  const open = (id: string) => openCounts.find((c) => c.assigneeId === id)?._count ?? 0;

  return (
    <>
      <PageHeader title="Team" subtitle={`${members.filter((m) => m.active).length} active members in ${user.org.name}`} />
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Member</Th>
                <Th>Today</Th>
                <Th className="text-right">Open issues</Th>
                <Th>Role & designation</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const a = away.get(m.id);
                return (
                  <tr key={m.id} className={m.active ? "" : "opacity-50"}>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={m.name} size={32} />
                        <div>
                          <div className="text-sm font-medium">
                            {m.name} {m.id === user.id && <span className="text-xs font-normal text-muted">(you)</span>}
                          </div>
                          <div className="text-xs text-muted">{m.email}</div>
                        </div>
                      </div>
                    </Td>
                    <Td>{!m.active ? <Badge>Deactivated</Badge> : a ? <Badge tone={a.type === "WFH" ? "blue" : "amber"}>{a.label}</Badge> : <Badge tone="green">Available</Badge>}</Td>
                    <Td className="text-right tabular-nums">{open(m.id)}</Td>
                    <Td>
                      {manager && m.id !== user.id ? (
                        <form action={updateMember.bind(null, m.id)} className="flex items-center gap-2">
                          <select name="role" defaultValue={m.role} className="field h-8 w-28 py-1 text-xs">
                            {Object.entries(ROLE_LABEL).map(([k, v]) => (
                              <option key={k} value={k}>
                                {v}
                              </option>
                            ))}
                          </select>
                          <input name="designation" defaultValue={m.designation ?? ""} placeholder="Designation" className="field h-8 w-44 py-1 text-xs" />
                          <button className="text-xs font-medium text-brand-700 hover:underline">Save</button>
                        </form>
                      ) : (
                        <span className="text-sm">
                          {ROLE_LABEL[m.role]}
                          {m.designation && <span className="text-muted"> · {m.designation}</span>}
                        </span>
                      )}
                    </Td>
                    <Td className="text-right">
                      {manager && m.id !== user.id && (
                        <form action={setMemberActive.bind(null, m.id, !m.active)}>
                          <ConfirmButton message={m.active ? `Deactivate ${m.name}? They won't be able to sign in.` : `Reactivate ${m.name}?`} className="text-xs text-muted hover:text-ink">
                            {m.active ? "Deactivate" : "Reactivate"}
                          </ConfirmButton>
                        </form>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
        <div className="space-y-5 self-start">
          {manager && (
            <Card>
              <CardHeader title="Add member" subtitle="Share the temporary password with them directly." />
              <ActionForm action={addMember} resetOnSuccess className="space-y-3 p-4">
                <Field label="Full name">
                  <input name="name" required className="field" />
                </Field>
                <Field label="Email">
                  <input name="email" type="email" required className="field" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Role">
                    <select name="role" defaultValue="STAFF" className="field">
                      {Object.entries(ROLE_LABEL).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Designation">
                    <input name="designation" placeholder="Article Assistant" className="field" />
                  </Field>
                </div>
                <Field label="Temporary password">
                  <input name="password" type="text" required minLength={8} autoComplete="off" className="field" />
                </Field>
                <SubmitButton className="w-full">Add member</SubmitButton>
              </ActionForm>
            </Card>
          )}
          <Card>
            <CardHeader title="Change your password" />
            <ActionForm action={changePassword} resetOnSuccess className="space-y-3 p-4">
              <Field label="Current password">
                <input name="current" type="password" required autoComplete="current-password" className="field" />
              </Field>
              <Field label="New password">
                <input name="next" type="password" required minLength={8} autoComplete="new-password" className="field" />
              </Field>
              <SubmitButton variant="secondary" className="w-full">
                Update password
              </SubmitButton>
            </ActionForm>
          </Card>
        </div>
      </div>
    </>
  );
}
