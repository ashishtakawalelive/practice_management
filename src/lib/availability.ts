import { db } from "./db";
import { AVAILABILITY_LABEL, AVAILABILITY_UNAVAILABLE } from "./constants";
import { todayIST } from "./dates";

export type AvailabilityNote = { type: string; label: string; halfDay: boolean; note: string | null; unavailable: boolean };

/** Approved availability entries that cover `date`, keyed by user. */
export async function availabilityOn(orgId: string, date: Date = todayIST()) {
  const entries = await db.availabilityEntry.findMany({
    where: { orgId, status: "APPROVED", startDate: { lte: date }, endDate: { gte: date } },
  });
  const map = new Map<string, AvailabilityNote>();
  for (const e of entries) {
    map.set(e.userId, {
      type: e.type,
      label: AVAILABILITY_LABEL[e.type] + (e.halfDay ? " (half day)" : ""),
      halfDay: e.halfDay,
      note: e.note,
      unavailable: AVAILABILITY_UNAVAILABLE.has(e.type) && !e.halfDay,
    });
  }
  return map;
}

/** Approved or pending leave/absence/OOO for one user overlapping a date. */
export async function conflictFor(userId: string, date: Date) {
  return db.availabilityEntry.findFirst({
    where: {
      userId,
      status: { in: ["APPROVED", "PENDING"] },
      type: { in: [...AVAILABILITY_UNAVAILABLE] },
      startDate: { lte: date },
      endDate: { gte: date },
    },
  });
}
