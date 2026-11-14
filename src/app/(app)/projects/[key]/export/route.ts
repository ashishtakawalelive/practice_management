import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ISSUE_TYPE_LABEL, PRIORITY_LABEL } from "@/lib/constants";
import { isoDate } from "@/lib/dates";

function csvCell(v: unknown) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(_: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const user = await requireUser();
  const project = await db.project.findFirst({ where: { orgId: user.orgId, key: key.toUpperCase() } });
  if (!project) return new NextResponse("Not found", { status: 404 });

  const issues = await db.issue.findMany({
    where: { projectId: project.id },
    include: { status: true, assignee: true, reporter: true, sprint: true, epic: true, workLogs: true },
    orderBy: { number: "asc" },
  });

  const header = ["Key", "Type", "Summary", "Status", "Priority", "Assignee", "Reporter", "Epic", "Sprint", "Labels", "Story points", "Due date", "Time logged (h)", "Created", "Resolved"];
  const rows = issues.map((i) => [
    `${project.key}-${i.number}`,
    ISSUE_TYPE_LABEL[i.type],
    i.title,
    i.status.name,
    PRIORITY_LABEL[i.priority],
    i.assignee?.name,
    i.reporter.name,
    i.epic?.title,
    i.sprint?.name,
    i.labels,
    i.storyPoints,
    isoDate(i.dueDate),
    (i.workLogs.reduce((s, w) => s + w.minutes, 0) / 60).toFixed(2),
    isoDate(i.createdAt),
    isoDate(i.resolvedAt),
  ]);
  const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");

  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${project.key}-issues.csv"`,
    },
  });
}
