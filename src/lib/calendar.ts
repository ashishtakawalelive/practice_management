/** Month maths for the availability calendar. Weekly off is Sunday (common for CA firms). */
export const WEEKLY_OFF = new Set([0]);

export function parseMonth(value?: string) {
  const now = new Date(Date.now() + 5.5 * 3600 * 1000);
  const m = value?.match(/^(\d{4})-(\d{2})$/);
  const year = m ? parseInt(m[1], 10) : now.getUTCFullYear();
  const month = m ? parseInt(m[2], 10) - 1 : now.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 0));
  const days = Array.from({ length: end.getUTCDate() }, (_, i) => new Date(Date.UTC(year, month, i + 1)));
  const key = (y: number, mo: number) => `${y}-${String(mo + 1).padStart(2, "0")}`;
  return {
    start,
    end,
    days,
    key: key(year, month),
    prev: key(month === 0 ? year - 1 : year, (month + 11) % 12),
    next: key(month === 11 ? year + 1 : year, (month + 1) % 12),
    label: new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(start),
  };
}

export function sameDay(a: Date, b: Date) {
  return a.getTime() === b.getTime();
}

/** Working days an entry covers within [from, to], excluding weekly offs and holidays. */
export function workingDaysIn(
  entry: { startDate: Date; endDate: Date; halfDay: boolean },
  from: Date,
  to: Date,
  holidays: Set<number>,
) {
  let count = 0;
  const s = Math.max(entry.startDate.getTime(), from.getTime());
  const e = Math.min(entry.endDate.getTime(), to.getTime());
  for (let t = s; t <= e; t += 86400000) {
    const d = new Date(t);
    if (WEEKLY_OFF.has(d.getUTCDay()) || holidays.has(t)) continue;
    count += entry.halfDay ? 0.5 : 1;
  }
  return count;
}
