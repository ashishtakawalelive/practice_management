"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ISSUE_TYPES, PRIORITIES, LINK_TYPES, ISSUE_TYPE_LABEL, PRIORITY_LABEL } from "@/lib/constants";
import { parseDuration, toDateOnly, isoDate } from "@/lib/dates";
import type { FormState } from "@/components/form-bits";

function str(data: FormData, key: string) {
  const v = data.get(key);
  return v == null ? "" : String(v).trim();
}

async function ownIssue(issueId: string) {
  const user = await requireUser();
  const issue = await db.issue.findFirst({ where: { id: issueId, orgId: user.orgId }, include: { project: true, status: true } });
  if (!issue) throw new Error("Issue not found");
  return { user, issue };
}

function refresh() {
  revalidatePath("/", "layout");
}

export async function createIssue(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireUser();
  const projectId = str(data, "projectId");
  const title = str(data, "title");
  const type = str(data, "type") || "TASK";
  if (!title) return { error: "Give the issue a summary." };
  if (!ISSUE_TYPES.includes(type as never)) return { error: "Unknown issue type." };

  const project = await db.project.findFirst({
    where: { id: projectId, orgId: user.orgId },
    include: { statuses: { orderBy: { position: "asc" } } },
  });
  if (!project) return { error: "Choose a project." };

  const parentId = str(data, "parentId") || null;
  if (type === "SUBTASK" && !parentId) return { error: "A sub-task needs a parent issue." };

  const statusId = str(data, "statusId") || project.statuses[0].id;
  const assigneeId = str(data, "assigneeId") || null;
  const due = str(data, "dueDate");
  const priority = PRIORITIES.includes(str(data, "priority") as never) ? str(data, "priority") : "MEDIUM";
  const points = str(data, "storyPoints");
  const estimate = str(data, "estimate");

  const issue = await db.$transaction(async (tx) => {
    const p = await tx.project.update({ where: { id: project.id }, data: { issueCounter: { increment: 1 } } });
    const last = await tx.issue.findFirst({ where: { projectId: project.id, statusId }, orderBy: { position: "desc" } });
    return tx.issue.create({
      data: {
        orgId: user.orgId,
        projectId: project.id,
        number: p.issueCounter,
        type,
        title,
        description: str(data, "description") || null,
        statusId,
        priority,
        assigneeId,
        reporterId: user.id,
        parentId: type === "SUBTASK" ? parentId : null,
        epicId: type !== "EPIC" && type !== "SUBTASK" ? str(data, "epicId") || null : null,
        sprintId: str(data, "sprintId") || null,
        labels: str(data, "labels") || null,
        storyPoints: points ? parseInt(points, 10) : null,
        estimateMins: estimate ? parseDuration(estimate) : null,
        dueDate: due ? toDateOnly(due) : null,
        position: (last?.position ?? 0) + 1000,
        activities: { create: { actorId: user.id, action: "created" } },
        watchers: { create: [{ userId: user.id }, ...(assigneeId && assigneeId !== user.id ? [{ userId: assigneeId }] : [])] },
      },
    });
  });

  refresh();
  if (str(data, "stay") === "1") return { ok: true };
  redirect(`/issues/${project.key}-${issue.number}`);
}

const EDITABLE = new Set([
  "title",
  "description",
  "statusId",
  "priority",
  "assigneeId",
  "type",
  "dueDate",
  "startDate",
  "labels",
  "storyPoints",
  "estimateMins",
  "sprintId",
  "epicId",
]);

async function displayValue(field: string, value: unknown): Promise<string | null> {
  if (value == null || value === "") return null;
  switch (field) {
    case "statusId":
      return (await db.workflowStatus.findUnique({ where: { id: String(value) } }))?.name ?? null;
    case "assigneeId":
      return (await db.user.findUnique({ where: { id: String(value) } }))?.name ?? null;
    case "sprintId":
      return (await db.sprint.findUnique({ where: { id: String(value) } }))?.name ?? null;
    case "epicId":
      return (await db.issue.findUnique({ where: { id: String(value) } }))?.title ?? null;
    case "priority":
      return PRIORITY_LABEL[String(value)];
    case "type":
      return ISSUE_TYPE_LABEL[String(value)];
    case "dueDate":
    case "startDate":
      return isoDate(value as Date);
    case "description":
      return "(edited)";
    default:
      return String(value);
  }
}

const FIELD_LABEL: Record<string, string> = {
  statusId: "status",
  assigneeId: "assignee",
  sprintId: "sprint",
  epicId: "epic",
  dueDate: "due date",
  startDate: "start date",
  storyPoints: "story points",
  estimateMins: "estimate",
};

/** Inline edit of one field. Bound as updateIssueField.bind(null, issueId, field). */
export async function updateIssueField(issueId: string, field: string, data: FormData) {
  if (!EDITABLE.has(field)) throw new Error("Field cannot be edited");
  const { user, issue } = await ownIssue(issueId);
  const raw = str(data, "value");

  let value: unknown = raw || null;
  if (field === "title" && !raw) return;
  if (field === "dueDate" || field === "startDate") value = raw ? toDateOnly(raw) : null;
  if (field === "storyPoints") value = raw ? parseInt(raw, 10) : null;
  if (field === "estimateMins") value = raw ? parseDuration(raw) : null;
  if (field === "priority" && !PRIORITIES.includes(raw as never)) return;
  if (field === "type" && !ISSUE_TYPES.includes(raw as never)) return;

  const extra: Record<string, unknown> = {};
  if (field === "statusId") {
    const status = await db.workflowStatus.findFirst({ where: { id: raw, projectId: issue.projectId } });
    if (!status) return;
    extra.resolvedAt = status.category === "DONE" ? new Date() : null;
  }

  const before = (issue as Record<string, unknown>)[field];
  await db.issue.update({ where: { id: issue.id }, data: { [field]: value, ...extra } });
  await db.activity.create({
    data: {
      issueId: issue.id,
      actorId: user.id,
      action: "updated",
      field: FIELD_LABEL[field] ?? field,
      fromValue: await displayValue(field, before),
      toValue: await displayValue(field, value),
    },
  });
  if (field === "assigneeId" && value) {
    await db.watcher.upsert({
      where: { issueId_userId: { issueId: issue.id, userId: String(value) } },
      create: { issueId: issue.id, userId: String(value) },
      update: {},
    });
  }
  refresh();
}

/** Drag-and-drop on the board: new status and position. */
export async function moveIssue(issueId: string, statusId: string, position: number) {
  const { user, issue } = await ownIssue(issueId);
  const status = await db.workflowStatus.findFirst({ where: { id: statusId, projectId: issue.projectId } });
  if (!status) throw new Error("Invalid status");
  await db.issue.update({
    where: { id: issue.id },
    data: {
      statusId,
      position,
      resolvedAt: status.category === "DONE" ? issue.resolvedAt ?? new Date() : null,
    },
  });
  if (statusId !== issue.statusId) {
    await db.activity.create({
      data: { issueId: issue.id, actorId: user.id, action: "updated", field: "status", fromValue: issue.status.name, toValue: status.name },
    });
  }
  refresh();
}

export async function addComment(issueId: string, _: FormState, data: FormData): Promise<FormState> {
  const { user, issue } = await ownIssue(issueId);
  const body = str(data, "body");
  if (!body) return { error: "Write something first." };
  await db.comment.create({ data: { issueId: issue.id, authorId: user.id, body } });
  await db.watcher.upsert({
    where: { issueId_userId: { issueId: issue.id, userId: user.id } },
    create: { issueId: issue.id, userId: user.id },
    update: {},
  });
  refresh();
  return { ok: true };
}

export async function deleteComment(commentId: string) {
  const user = await requireUser();
  const c = await db.comment.findFirst({ where: { id: commentId, authorId: user.id } });
  if (c) await db.comment.delete({ where: { id: c.id } });
  refresh();
}

export async function logWork(issueId: string, _: FormState, data: FormData): Promise<FormState> {
  const { user, issue } = await ownIssue(issueId);
  const minutes = parseDuration(str(data, "time"));
  if (!minutes) return { error: "Enter time like 1h 30m, 45m or 2." };
  const date = str(data, "date");
  await db.workLog.create({
    data: {
      issueId: issue.id,
      userId: user.id,
      minutes,
      date: date ? toDateOnly(date) : toDateOnly(new Date()),
      note: str(data, "note") || null,
      billable: data.get("billable") === "on",
    },
  });
  await db.activity.create({ data: { issueId: issue.id, actorId: user.id, action: "logged_work", toValue: String(minutes) } });
  refresh();
  return { ok: true };
}

export async function deleteWorkLog(logId: string) {
  const user = await requireUser();
  const log = await db.workLog.findFirst({ where: { id: logId, userId: user.id } });
  if (log) await db.workLog.delete({ where: { id: log.id } });
  refresh();
}

export async function addLink(issueId: string, _: FormState, data: FormData): Promise<FormState> {
  const { user, issue } = await ownIssue(issueId);
  const type = str(data, "type");
  const direction = str(data, "direction");
  const key = str(data, "target").toUpperCase();
  const m = key.match(/^([A-Z0-9]+)-(\d+)$/);
  if (!LINK_TYPES[type] || !m) return { error: "Enter an issue key like GST-3." };
  const target = await db.issue.findFirst({
    where: { orgId: user.orgId, number: parseInt(m[2], 10), project: { key: m[1] } },
  });
  if (!target) return { error: `No issue ${key} found.` };
  if (target.id === issue.id) return { error: "An issue can't link to itself." };
  const [fromId, toId] = direction === "in" ? [target.id, issue.id] : [issue.id, target.id];
  await db.issueLink.create({ data: { fromId, toId, type } });
  refresh();
  return { ok: true };
}

export async function removeLink(linkId: string) {
  const user = await requireUser();
  const link = await db.issueLink.findFirst({ where: { id: linkId, from: { orgId: user.orgId } } });
  if (link) await db.issueLink.delete({ where: { id: link.id } });
  refresh();
}

export async function toggleWatch(issueId: string) {
  const { user, issue } = await ownIssue(issueId);
  const key = { issueId_userId: { issueId: issue.id, userId: user.id } };
  const existing = await db.watcher.findUnique({ where: key });
  if (existing) await db.watcher.delete({ where: key });
  else await db.watcher.create({ data: { issueId: issue.id, userId: user.id } });
  refresh();
}

export async function deleteIssue(issueId: string) {
  const { issue } = await ownIssue(issueId);
  await db.issue.updateMany({ where: { epicId: issue.id }, data: { epicId: null } });
  await db.issue.delete({ where: { id: issue.id } });
  refresh();
  redirect(`/projects/${issue.project.key}/board`);
}
