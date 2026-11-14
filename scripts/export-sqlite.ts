/* One-off: dump the local SQLite data as Postgres INSERT statements (run before switching provider). */
import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "fs";

const db = new PrismaClient();

function lit(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (v instanceof Date) return `'${v.toISOString()}'`;
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

function inserts(table: string, rows: Record<string, unknown>[], omit: string[] = []) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]).filter((c) => !omit.includes(c));
  const values = rows.map((r) => `(${cols.map((c) => lit(r[c])).join(", ")})`).join(",\n");
  return `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES\n${values};\n`;
}

async function main() {
  const issues = await db.issue.findMany();
  const parts = [
    inserts("Organization", await db.organization.findMany()),
    inserts("User", await db.user.findMany()),
    inserts("Client", await db.client.findMany()),
    inserts("Project", await db.project.findMany()),
    inserts("WorkflowStatus", await db.workflowStatus.findMany()),
    inserts("Sprint", await db.sprint.findMany()),
    // self-references are set in a second pass so insert order doesn't matter
    inserts("Issue", issues.map((i) => ({ ...i, parentId: null, epicId: null }))),
    ...issues
      .filter((i) => i.parentId || i.epicId)
      .map((i) => `UPDATE "Issue" SET "parentId" = ${lit(i.parentId)}, "epicId" = ${lit(i.epicId)} WHERE "id" = ${lit(i.id)};\n`),
    inserts("IssueLink", await db.issueLink.findMany()),
    inserts("Comment", await db.comment.findMany()),
    inserts("Activity", await db.activity.findMany()),
    inserts("WorkLog", await db.workLog.findMany()),
    inserts("Watcher", await db.watcher.findMany()),
    inserts("AvailabilityEntry", await db.availabilityEntry.findMany()),
    inserts("Holiday", await db.holiday.findMany()),
    inserts("Item", await db.item.findMany()),
    inserts("Invoice", await db.invoice.findMany()),
    inserts("InvoiceLine", await db.invoiceLine.findMany()),
    inserts("Payment", await db.payment.findMany()),
  ];
  const out = process.argv[2];
  writeFileSync(out, "BEGIN;\n" + parts.join("\n") + "COMMIT;\n");
  console.log(`Wrote ${out}`);
}

main().finally(() => db.$disconnect());
