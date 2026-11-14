"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertManager, canManage, requireUser } from "@/lib/auth";
import { AVAILABILITY_LABEL, AVAILABILITY_NEEDS_APPROVAL } from "@/lib/constants";
import { formatDate, toDateOnly } from "@/lib/dates";
import type { FormState } from "@/components/form-bits";

function str(data: FormData, key: string) {
  const v = data.get(key);
  return v == null ? "" : String(v).trim();
}
function refresh() {
  revalidatePath("/", "layout");
}

export async function markAvailability(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireUser();
  const type = str(data, "type");
  if (!AVAILABILITY_LABEL[type]) return { error: "Pick a status." };
  const from = str(data, "startDate");
  const to = str(data, "endDate") || from;
  if (!from) return { error: "Pick a date." };
  const startDate = toDateOnly(from);
  const endDate = toDateOnly(to);
  if (endDate < startDate) return { error: "The end date is before the start date." };
  const halfDay = data.get("halfDay") === "on";
  if (halfDay && endDate.getTime() !== startDate.getTime()) return { error: "Half day applies to a single date only." };

  // Managers can record entries for someone else (e.g. marking an absence).
  let userId = user.id;
  const forUser = str(data, "userId");
  if (forUser && forUser !== user.id) {
    if (!canManage(user)) return { error: "Only managers can mark availability for others." };
    const member = await db.user.findFirst({ where: { id: forUser, orgId: user.orgId } });
    if (!member) return { error: "Team member not found." };
    userId = member.id;
  }

  const overlap = await db.availabilityEntry.findFirst({
    where: { userId, status: { not: "REJECTED" }, startDate: { lte: endDate }, endDate: { gte: startDate } },
  });
  if (overlap)
    return {
      error: `Overlaps an existing entry: ${AVAILABILITY_LABEL[overlap.type]} ${formatDate(overlap.startDate)}${
        overlap.endDate.getTime() !== overlap.startDate.getTime() ? ` – ${formatDate(overlap.endDate)}` : ""
      }. Cancel that one first.`,
    };

  // Leave needs approval, unless a manager is recording it.
  const needsApproval = AVAILABILITY_NEEDS_APPROVAL.has(type) && !canManage(user);
  await db.availabilityEntry.create({
    data: {
      orgId: user.orgId,
      userId,
      type,
      startDate,
      endDate,
      halfDay,
      note: str(data, "note") || null,
      status: needsApproval ? "PENDING" : "APPROVED",
      approverId: needsApproval ? null : AVAILABILITY_NEEDS_APPROVAL.has(type) ? user.id : null,
    },
  });
  refresh();
  return { ok: true };
}

export async function decideEntry(entryId: string, decision: "APPROVED" | "REJECTED") {
  const user = await requireUser();
  assertManager(user);
  const entry = await db.availabilityEntry.findFirst({ where: { id: entryId, orgId: user.orgId, status: "PENDING" } });
  if (!entry) return;
  await db.availabilityEntry.update({ where: { id: entry.id }, data: { status: decision, approverId: user.id } });
  refresh();
}

export async function cancelEntry(entryId: string) {
  const user = await requireUser();
  const entry = await db.availabilityEntry.findFirst({ where: { id: entryId, orgId: user.orgId } });
  if (!entry) return;
  if (entry.userId !== user.id && !canManage(user)) return;
  await db.availabilityEntry.delete({ where: { id: entry.id } });
  refresh();
}

export async function addHoliday(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireUser();
  assertManager(user);
  const date = str(data, "date");
  const name = str(data, "name");
  if (!date || !name) return { error: "Enter a date and a name." };
  await db.holiday.create({ data: { orgId: user.orgId, date: toDateOnly(date), name } });
  refresh();
  return { ok: true };
}

export async function deleteHoliday(holidayId: string) {
  const user = await requireUser();
  assertManager(user);
  await db.holiday.deleteMany({ where: { id: holidayId, orgId: user.orgId } });
  refresh();
}
