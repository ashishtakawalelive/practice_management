import Link from "next/link";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { db } from "@/lib/db";
import { canManage, requireUser } from "@/lib/auth";
import { AVAILABILITY_LABEL } from "@/lib/constants";
import { formatDate, formatDateShort, isoDate, todayIST } from "@/lib/dates";
import { parseMonth, sameDay, WEEKLY_OFF, workingDaysIn } from "@/lib/calendar";
import { Avatar, Badge, Card, CardHeader, Field, PageHeader, Table, Td, Th, buttonClass, cn } from "@/components/ui";
import { ActionForm, SubmitButton, ConfirmButton } from "@/components/form-bits";
import { markAvailability, decideEntry, cancelEntry, addHoliday, deleteHoliday } from "./actions";

export const metadata = { title: "Availability" };

const CELL: Record<string, string> = {
  LEAVE: "bg-amber-400 text-white",
  ABSENT: "bg-red-500 text-white",
  OOO: "bg-violet-500 text-white",
  WFH: "bg-sky-400 text-white",
};
const SHORT: Record<string, string> = { LEAVE: "L", ABSENT: "A", OOO: "O", WFH: "W" };
const TONE: Record<string, "amber" | "red" | "violet" | "blue"> = { LEAVE: "amber", ABSENT: "red", OOO: "violet", WFH: "blue" };

export default async function AvailabilityPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireUser();
  const manager = canManage(user);
  const month = parseMonth((await searchParams).month);
  const today = todayIST();

  const [members, entries, holidays, pending, mine] = await Promise.all([
    db.user.findMany({ where: { orgId: user.orgId, active: true }, orderBy: { name: "asc" } }),
    db.availabilityEntry.findMany({
      where: { orgId: user.orgId, status: { not: "REJECTED" }, startDate: { lte: month.end }, endDate: { gte: month.start } },
    }),
    db.holiday.findMany({ where: { orgId: user.orgId }, orderBy: { date: "asc" } }),
    manager
      ? db.availabilityEntry.findMany({ where: { orgId: user.orgId, status: "PENDING" }, include: { user: true }, orderBy: { startDate: "asc" } })
      : Promise.resolve([]),
    db.availabilityEntry.findMany({
      where: { userId: user.id, endDate: { gte: today } },
      include: { approver: true },
      orderBy: { startDate: "asc" },
    }),
  ]);

  const holidayMap = new Map(holidays.map((h) => [h.date.getTime(), h.name]));
  const holidaySet = new Set(holidayMap.keys());
  const outToday = entries.filter((e) => e.status === "APPROVED" && e.startDate <= today && e.endDate >= today);
  const memberName = new Map(members.map((m) => [m.id, m.name]));

  function entryOn(userId: string, day: Date) {
    return entries.find((e) => e.userId === userId && e.startDate <= day && e.endDate >= day);
  }

  const summary = members.map((m) => {
    const row = { LEAVE: 0, ABSENT: 0, OOO: 0, WFH: 0 } as Record<"LEAVE" | "ABSENT" | "OOO" | "WFH", number>;
    for (const e of entries.filter((x) => x.userId === m.id && x.status === "APPROVED")) {
      row[e.type as keyof typeof row] += workingDaysIn(e, month.start, month.end, holidaySet);
    }
    return { member: m, ...row };
  });
  const workingDays = month.days.filter((d) => !WEEKLY_OFF.has(d.getUTCDay()) && !holidaySet.has(d.getTime())).length;

  return (
    <>
      <PageHeader title="Availability" subtitle="Leave, absences, out-of-office and work-from-home for the whole team." />

      <Card className="mb-5 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">Today, {formatDate(today)}:</span>
          {holidayMap.has(today.getTime()) && <Badge tone="violet">Holiday — {holidayMap.get(today.getTime())}</Badge>}
          {outToday.length === 0 && <span className="text-muted">Everyone is in the office.</span>}
          {outToday.map((e) => (
            <span key={e.id} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white py-0.5 pr-2.5 pl-0.5">
              <Avatar name={memberName.get(e.userId)} size={22} />
              <span className="text-xs">{memberName.get(e.userId)}</span>
              <Badge tone={TONE[e.type]}>{AVAILABILITY_LABEL[e.type]}{e.halfDay ? " ½" : ""}</Badge>
            </span>
          ))}
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-5">
          {/* Team calendar */}
          <Card>
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div className="flex items-center gap-2">
                <Link href={`?month=${month.prev}`} className={buttonClass("ghost", "sm", "px-1.5")} aria-label="Previous month">
                  <ChevronLeft className="h-4 w-4" />
                </Link>
                <h2 className="w-36 text-center text-sm font-semibold">{month.label}</h2>
                <Link href={`?month=${month.next}`} className={buttonClass("ghost", "sm", "px-1.5")} aria-label="Next month">
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="flex flex-wrap gap-3 text-[11px] text-muted">
                {Object.entries(SHORT).map(([k, s]) => (
                  <span key={k} className="inline-flex items-center gap-1">
                    <span className={cn("inline-flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold", CELL[k])}>{s}</span>
                    {AVAILABILITY_LABEL[k]}
                  </span>
                ))}
                <span className="inline-flex items-center gap-1">
                  <span className="h-4 w-4 rounded border border-dashed border-amber-500" /> Pending
                </span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 min-w-40 border-b border-line bg-white px-3 py-2 text-left font-medium text-muted">Member</th>
                    {month.days.map((d) => {
                      const off = WEEKLY_OFF.has(d.getUTCDay()) || holidayMap.has(d.getTime());
                      return (
                        <th
                          key={d.getTime()}
                          title={holidayMap.get(d.getTime())}
                          className={cn(
                            "min-w-7 border-b border-line px-0 py-1 text-center font-normal",
                            off ? "bg-slate-50 text-slate-400" : "text-muted",
                            sameDay(d, today) && "bg-brand-50 font-semibold text-brand-700",
                          )}
                        >
                          <div className="text-[9px] uppercase">{["S", "M", "T", "W", "T", "F", "S"][d.getUTCDay()]}</div>
                          {d.getUTCDate()}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.id}>
                      <td className="sticky left-0 z-10 border-b border-line bg-white px-3 py-1.5">
                        <span className="flex items-center gap-2">
                          <Avatar name={m.name} size={20} />
                          <span className="truncate">{m.name}</span>
                        </span>
                      </td>
                      {month.days.map((d) => {
                        const off = WEEKLY_OFF.has(d.getUTCDay()) || holidayMap.has(d.getTime());
                        const e = entryOn(m.id, d);
                        return (
                          <td key={d.getTime()} className={cn("border-b border-l border-line/60 p-0.5 text-center", off && "bg-slate-50", sameDay(d, today) && "bg-brand-50/60")}>
                            {e && !off && (
                              <span
                                title={`${AVAILABILITY_LABEL[e.type]}${e.halfDay ? " (half day)" : ""}${e.status === "PENDING" ? " — pending approval" : ""}${e.note ? `: ${e.note}` : ""}`}
                                className={cn(
                                  "inline-flex h-5 w-full items-center justify-center rounded text-[9px] font-bold",
                                  e.status === "PENDING" ? "border border-dashed border-amber-500 bg-amber-50 text-amber-700" : CELL[e.type],
                                  e.halfDay && "opacity-70",
                                )}
                              >
                                {SHORT[e.type]}
                                {e.halfDay ? "½" : ""}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Monthly summary */}
          <Card>
            <CardHeader
              title={`Monthly summary — ${month.label}`}
              subtitle={`${workingDays} working days (Sundays and holidays excluded). Approved entries only.`}
              action={
                <a href={`/availability/export?month=${month.key}`} className={buttonClass("secondary", "sm")}>
                  <Download className="h-3.5 w-3.5" /> Excel (CSV)
                </a>
              }
            />
            <Table>
              <thead>
                <tr>
                  <Th>Member</Th>
                  <Th className="text-right">Leave</Th>
                  <Th className="text-right">Absent</Th>
                  <Th className="text-right">OOO</Th>
                  <Th className="text-right">WFH</Th>
                  <Th className="text-right">Days in office</Th>
                </tr>
              </thead>
              <tbody>
                {summary.map((s) => (
                  <tr key={s.member.id}>
                    <Td>
                      <span className="flex items-center gap-2">
                        <Avatar name={s.member.name} size={20} /> {s.member.name}
                      </span>
                    </Td>
                    <Td className="text-right tabular-nums">{s.LEAVE || "–"}</Td>
                    <Td className={cn("text-right tabular-nums", s.ABSENT && "font-medium text-red-600")}>{s.ABSENT || "–"}</Td>
                    <Td className="text-right tabular-nums">{s.OOO || "–"}</Td>
                    <Td className="text-right tabular-nums">{s.WFH || "–"}</Td>
                    <Td className="text-right font-medium tabular-nums">{workingDays - s.LEAVE - s.ABSENT - s.OOO - s.WFH}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </div>

        <div className="space-y-5 self-start">
          <Card>
            <CardHeader title="Mark your status" subtitle="Leave needs approval. OOO and WFH are recorded straight away." />
            <ActionForm action={markAvailability} resetOnSuccess className="space-y-3 p-4">
              {manager && (
                <Field label="For">
                  <select name="userId" defaultValue={user.id} className="field">
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.id === user.id ? `${m.name} (me)` : m.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label="Status">
                <select name="type" defaultValue="LEAVE" className="field">
                  {Object.entries(AVAILABILITY_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="From">
                  <input type="date" name="startDate" required defaultValue={isoDate(today)} className="field" />
                </Field>
                <Field label="To">
                  <input type="date" name="endDate" defaultValue={isoDate(today)} className="field" />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="halfDay" /> Half day
              </label>
              <Field label="Note">
                <input name="note" placeholder="e.g. At client site for stock audit" className="field" />
              </Field>
              <SubmitButton className="w-full">Save</SubmitButton>
            </ActionForm>
          </Card>

          {manager && (
            <Card>
              <CardHeader title={`Pending approvals · ${pending.length}`} />
              {pending.length === 0 ? (
                <p className="px-4 py-4 text-sm text-muted">Nothing waiting for you.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {pending.map((e) => (
                    <li key={e.id} className="px-4 py-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Avatar name={e.user.name} size={22} />
                        <span className="font-medium">{e.user.name}</span>
                        <Badge tone={TONE[e.type]}>{AVAILABILITY_LABEL[e.type]}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        {formatDate(e.startDate)}
                        {!sameDay(e.startDate, e.endDate) && ` – ${formatDate(e.endDate)}`}
                        {e.halfDay && " (half day)"}
                        {e.note && ` · ${e.note}`}
                      </p>
                      <div className="mt-2 flex gap-2">
                        <form action={decideEntry.bind(null, e.id, "APPROVED")}>
                          <SubmitButton size="sm">Approve</SubmitButton>
                        </form>
                        <form action={decideEntry.bind(null, e.id, "REJECTED")}>
                          <SubmitButton size="sm" variant="danger">
                            Reject
                          </SubmitButton>
                        </form>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          <Card>
            <CardHeader title="Your upcoming entries" />
            {mine.length === 0 ? (
              <p className="px-4 py-4 text-sm text-muted">Nothing planned.</p>
            ) : (
              <ul className="divide-y divide-line">
                {mine.map((e) => (
                  <li key={e.id} className="flex items-center gap-2 px-4 py-2.5 text-sm">
                    <Badge tone={TONE[e.type]}>{AVAILABILITY_LABEL[e.type]}</Badge>
                    <span className="flex-1 text-xs">
                      {formatDateShort(e.startDate)}
                      {!sameDay(e.startDate, e.endDate) && ` – ${formatDateShort(e.endDate)}`}
                      {e.halfDay && " ½"}
                    </span>
                    {e.status === "PENDING" && <Badge tone="amber">Pending</Badge>}
                    {e.status === "REJECTED" && <Badge tone="red">Rejected</Badge>}
                    <form action={cancelEntry.bind(null, e.id)}>
                      <ConfirmButton message="Cancel this entry?" className="text-xs text-muted hover:text-red-700">
                        Cancel
                      </ConfirmButton>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Holidays" />
            <ul className="max-h-64 divide-y divide-line overflow-y-auto">
              {holidays.map((h) => (
                <li key={h.id} className="flex items-center gap-2 px-4 py-2 text-sm">
                  <span className="w-24 text-xs text-muted">{formatDate(h.date)}</span>
                  <span className="flex-1">{h.name}</span>
                  {manager && (
                    <form action={deleteHoliday.bind(null, h.id)}>
                      <button className="text-xs text-muted hover:text-red-700">Remove</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
            {manager && (
              <ActionForm action={addHoliday} resetOnSuccess className="flex gap-2 border-t border-line px-4 py-3">
                <input type="date" name="date" required className="field h-8 w-36 py-1 text-xs" />
                <input name="name" required placeholder="Holiday name" className="field h-8 flex-1 py-1 text-xs" />
                <SubmitButton size="sm" variant="secondary">
                  Add
                </SubmitButton>
              </ActionForm>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
