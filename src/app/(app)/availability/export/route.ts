import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parseMonth, WEEKLY_OFF, workingDaysIn } from "@/lib/calendar";

/** Monthly availability summary as CSV (opens in Excel), for payroll. */
export async function GET(req: Request) {
  const user = await requireUser();
  const month = parseMonth(new URL(req.url).searchParams.get("month") ?? undefined);
  const [members, entries, holidays] = await Promise.all([
    db.user.findMany({ where: { orgId: user.orgId, active: true }, orderBy: { name: "asc" } }),
    db.availabilityEntry.findMany({
      where: { orgId: user.orgId, status: "APPROVED", startDate: { lte: month.end }, endDate: { gte: month.start } },
    }),
    db.holiday.findMany({ where: { orgId: user.orgId, date: { gte: month.start, lte: month.end } } }),
  ]);
  const holidaySet = new Set(holidays.map((h) => h.date.getTime()));
  const workingDays = month.days.filter((d) => !WEEKLY_OFF.has(d.getUTCDay()) && !holidaySet.has(d.getTime())).length;

  const rows = [["Employee", "Email", "Designation", "Working days", "Leave", "Absent", "Out of office", "Work from home", "Days in office"]];
  for (const m of members) {
    const c: Record<string, number> = { LEAVE: 0, ABSENT: 0, OOO: 0, WFH: 0 };
    for (const e of entries.filter((x) => x.userId === m.id)) c[e.type] += workingDaysIn(e, month.start, month.end, holidaySet);
    rows.push([m.name, m.email, m.designation ?? "", String(workingDays), String(c.LEAVE), String(c.ABSENT), String(c.OOO), String(c.WFH), String(workingDays - c.LEAVE - c.ABSENT - c.OOO - c.WFH)]);
  }
  const csv = rows.map((r) => r.map((v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(",")).join("\r\n");
  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="availability-${month.key}.csv"`,
    },
  });
}
