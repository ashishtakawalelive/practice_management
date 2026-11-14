import { notFound } from "next/navigation";
import { cache } from "react";
import { db } from "./db";
import { requireUser } from "./auth";

/** Loads a project by key for the signed-in user's organisation (404 otherwise). */
export const getProject = cache(async (key: string) => {
  const user = await requireUser();
  const project = await db.project.findFirst({
    where: { orgId: user.orgId, key: key.toUpperCase() },
    include: {
      statuses: { orderBy: { position: "asc" } },
      sprints: { where: { state: { not: "CLOSED" } }, orderBy: { createdAt: "asc" } },
      client: true,
      lead: true,
    },
  });
  if (!project) notFound();
  return { user, project };
});

export type IssueFilters = { q?: string; assignee?: string; type?: string; priority?: string; label?: string };

/** Prisma `where` for the common board / list filters. */
export function issueWhere(filters: IssueFilters, meId: string) {
  const where: Record<string, unknown> = {};
  if (filters.q) where.title = { contains: filters.q, mode: "insensitive" as const };
  if (filters.assignee === "me") where.assigneeId = meId;
  else if (filters.assignee === "none") where.assigneeId = null;
  else if (filters.assignee) where.assigneeId = filters.assignee;
  if (filters.type) where.type = filters.type;
  if (filters.priority) where.priority = filters.priority;
  if (filters.label) where.labels = { contains: filters.label, mode: "insensitive" as const };
  return where;
}
