/**
 * Date helpers. Calendar dates (due dates, leave days, invoice dates) are stored
 * as UTC midnight of the chosen day so they never shift with the server time zone.
 */

export function toDateOnly(input: string | Date): Date {
  if (typeof input === "string") {
    const [y, m, d] = input.slice(0, 10).split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }
  return new Date(Date.UTC(input.getFullYear(), input.getMonth(), input.getDate()));
}

/** Today's date in India, as UTC midnight. */
export function todayIST(): Date {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()));
}

export function isoDate(d?: Date | null) {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

export function addDays(d: Date, n: number) {
  return new Date(d.getTime() + n * 86400000);
}

const fmt = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
export function formatDate(d?: Date | null) {
  return d ? fmt.format(d) : "—";
}

const fmtShort = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
export function formatDateShort(d?: Date | null) {
  return d ? fmtShort.format(d) : "—";
}

const fmtTime = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
export function formatDateTime(d?: Date | null) {
  return d ? fmtTime.format(d) : "—";
}

export function relativeTime(d: Date) {
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(d);
}

export function formatMinutes(mins?: number | null) {
  if (!mins) return "0h";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return [h ? `${h}h` : "", m ? `${m}m` : ""].filter(Boolean).join(" ") || "0h";
}

/** Parses "2h 30m", "1.5h", "45m" or plain hours ("2") into minutes. */
export function parseDuration(input: string): number {
  const s = input.trim().toLowerCase();
  if (!s) return 0;
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(parseFloat(s) * 60);
  let total = 0;
  const h = s.match(/(\d+(?:\.\d+)?)\s*h/);
  const m = s.match(/(\d+)\s*m/);
  if (h) total += parseFloat(h[1]) * 60;
  if (m) total += parseInt(m[1], 10);
  return Math.round(total);
}

/** Indian financial year label for a date, e.g. "2026-27". */
export function financialYear(d: Date) {
  const y = d.getUTCFullYear();
  const start = d.getUTCMonth() >= 3 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}
