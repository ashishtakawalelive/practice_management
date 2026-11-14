"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { assertManager, requireUser } from "@/lib/auth";
import { DEFAULT_WORKFLOW, STATUS_CATEGORIES } from "@/lib/constants";
import { toDateOnly, addDays, todayIST } from "@/lib/dates";
import type { FormState } from "@/components/form-bits";

function str(data: FormData, key: string) {
  const v = data.get(key);
  return v == null ? "" : String(v).trim();
}
function refresh() {
  revalidatePath("/", "layout");
}

async function ownProject(projectId: string) {
  const user = await requireUser();
  const project = await db.project.findFirst({ where: { id: projectId, orgId: user.orgId } });
  if (!project) throw new Error("Project not found");
  return { user, project };
}

export async function createProject(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireUser();
  const name = str(data, "name");
  const key = str(data, "key").toUpperCase();
  if (!name) return { error: "Project name is required." };
  if (!/^[A-Z][A-Z0-9]{1,9}$/.test(key)) return { error: "Key must be 2–10 letters or digits, starting with a letter (e.g. GST, AUD25)." };
  if (await db.project.findFirst({ where: { orgId: user.orgId, key } })) return { error: `Key ${key} is already used.` };

  await db.project.create({
    data: {
      orgId: user.orgId,
      key,
      name,
      description: str(data, "description") || null,
      clientId: str(data, "clientId") || null,
      leadId: str(data, "leadId") || user.id,
      statuses: { create: DEFAULT_WORKFLOW.map((s, i) => ({ ...s, position: i })) },
    },
  });
  refresh();
  redirect(`/projects/${key}/board`);
}

export async function updateProject(projectId: string, _: FormState, data: FormData): Promise<FormState> {
  const { user, project } = await ownProject(projectId);
  assertManager(user);
  const name = str(data, "name");
  if (!name) return { error: "Project name is required." };
  await db.project.update({
    where: { id: project.id },
    data: {
      name,
      description: str(data, "description") || null,
      clientId: str(data, "clientId") || null,
      leadId: str(data, "leadId") || null,
    },
  });
  refresh();
  return { ok: true };
}

export async function setProjectArchived(projectId: string, archived: boolean) {
  const { user, project } = await ownProject(projectId);
  assertManager(user);
  await db.project.update({ where: { id: project.id }, data: { archived } });
  refresh();
  redirect("/projects");
}

// ── Workflow statuses ──

export async function addStatus(projectId: string, _: FormState, data: FormData): Promise<FormState> {
  const { user, project } = await ownProject(projectId);
  assertManager(user);
  const name = str(data, "name");
  const category = str(data, "category");
  if (!name || !STATUS_CATEGORIES.includes(category as never)) return { error: "Enter a name and pick a category." };
  const count = await db.workflowStatus.count({ where: { projectId: project.id } });
  await db.workflowStatus.create({ data: { projectId: project.id, name, category, position: count } });
  refresh();
  return { ok: true };
}

export async function updateStatus(statusId: string, data: FormData) {
  const user = await requireUser();
  assertManager(user);
  const status = await db.workflowStatus.findFirst({ where: { id: statusId, project: { orgId: user.orgId } } });
  if (!status) return;
  const wip = str(data, "wipLimit");
  const category = str(data, "category");
  await db.workflowStatus.update({
    where: { id: status.id },
    data: {
      name: str(data, "name") || status.name,
      category: STATUS_CATEGORIES.includes(category as never) ? category : status.category,
      wipLimit: wip ? Math.max(0, parseInt(wip, 10)) || null : null,
    },
  });
  refresh();
}

export async function moveStatus(statusId: string, dir: -1 | 1) {
  const user = await requireUser();
  assertManager(user);
  const status = await db.workflowStatus.findFirst({ where: { id: statusId, project: { orgId: user.orgId } } });
  if (!status) return;
  const all = await db.workflowStatus.findMany({ where: { projectId: status.projectId }, orderBy: { position: "asc" } });
  const i = all.findIndex((s) => s.id === statusId);
  const j = i + dir;
  if (j < 0 || j >= all.length) return;
  [all[i], all[j]] = [all[j], all[i]];
  await db.$transaction(all.map((s, idx) => db.workflowStatus.update({ where: { id: s.id }, data: { position: idx } })));
  refresh();
}

export async function deleteStatus(statusId: string) {
  const user = await requireUser();
  assertManager(user);
  const status = await db.workflowStatus.findFirst({ where: { id: statusId, project: { orgId: user.orgId } } });
  if (!status) return;
  const others = await db.workflowStatus.findMany({ where: { projectId: status.projectId, NOT: { id: status.id } }, orderBy: { position: "asc" } });
  if (others.length === 0) return;
  const fallback = others.find((o) => o.category === status.category) ?? others[0];
  await db.issue.updateMany({ where: { statusId: status.id }, data: { statusId: fallback.id } });
  await db.workflowStatus.delete({ where: { id: status.id } });
  await db.$transaction(others.map((s, idx) => db.workflowStatus.update({ where: { id: s.id }, data: { position: idx } })));
  refresh();
}

// ── Sprints ──

export async function createSprint(projectId: string) {
  const { project } = await ownProject(projectId);
  const count = await db.sprint.count({ where: { projectId: project.id } });
  await db.sprint.create({ data: { projectId: project.id, name: `${project.key} Sprint ${count + 1}` } });
  refresh();
}

export async function startSprint(sprintId: string, _: FormState, data: FormData): Promise<FormState> {
  const user = await requireUser();
  const sprint = await db.sprint.findFirst({ where: { id: sprintId, project: { orgId: user.orgId } } });
  if (!sprint) return { error: "Sprint not found." };
  const active = await db.sprint.findFirst({ where: { projectId: sprint.projectId, state: "ACTIVE" } });
  if (active) return { error: `Complete ${active.name} before starting another sprint.` };
  const weeks = parseInt(str(data, "weeks") || "2", 10);
  const start = str(data, "startDate") ? toDateOnly(str(data, "startDate")) : todayIST();
  await db.sprint.update({
    where: { id: sprint.id },
    data: {
      state: "ACTIVE",
      name: str(data, "name") || sprint.name,
      goal: str(data, "goal") || null,
      startDate: start,
      endDate: addDays(start, weeks * 7 - 1),
    },
  });
  refresh();
  return { ok: true };
}

/** Closes the sprint. Unfinished issues go to the next planned sprint, or back to the backlog. */
export async function completeSprint(sprintId: string, data: FormData) {
  const user = await requireUser();
  const sprint = await db.sprint.findFirst({ where: { id: sprintId, project: { orgId: user.orgId } } });
  if (!sprint) return;
  const target = str(data, "moveTo") || null;
  await db.issue.updateMany({
    where: { sprintId: sprint.id, status: { category: { not: "DONE" } } },
    data: { sprintId: target },
  });
  await db.sprint.update({ where: { id: sprint.id }, data: { state: "CLOSED", endDate: sprint.endDate ?? todayIST() } });
  refresh();
}

export async function deleteSprint(sprintId: string) {
  const user = await requireUser();
  const sprint = await db.sprint.findFirst({ where: { id: sprintId, state: "FUTURE", project: { orgId: user.orgId } } });
  if (!sprint) return;
  await db.issue.updateMany({ where: { sprintId: sprint.id }, data: { sprintId: null } });
  await db.sprint.delete({ where: { id: sprint.id } });
  refresh();
}

export async function setIssueSprint(issueId: string, data: FormData) {
  const user = await requireUser();
  const issue = await db.issue.findFirst({ where: { id: issueId, orgId: user.orgId } });
  if (!issue) return;
  const sprintId = str(data, "value") || null;
  if (sprintId && !(await db.sprint.findFirst({ where: { id: sprintId, projectId: issue.projectId } }))) return;
  await db.issue.update({ where: { id: issue.id }, data: { sprintId } });
  refresh();
}
