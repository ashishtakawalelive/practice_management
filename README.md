# CA ORG Management Tool

One workspace for a chartered accountant firm: client engagements and compliance work (boards, backlogs, sprints), team availability (leave / absent / out-of-office / WFH), and GST billing (invoices, quotations, proforma, credit notes, payments).

## Run it locally

The database is PostgreSQL on Supabase (project "PM Tool", Mumbai). Put the two connection strings in `.env`
(Supabase → Connect → ORMs → Prisma): `DATABASE_URL` (transaction pooler, port 6543, `?pgbouncer=true`)
and `DIRECT_URL` (session pooler, port 5432), plus `AUTH_SECRET`.

```bash
npm install
npm run dev        # http://localhost:3000
```

`npm run db:push` applies schema changes; `npm run db:seed` loads the demo firm into an **empty** database only.
Row Level Security is on for every table with no policies, so Supabase's public REST API can't read the data —
the app talks to Postgres directly through Prisma.

### Demo logins (seed data only — password `demo1234`)

| Email | Role |
|---|---|
| partner@demo.in | Partner (admin) |
| manager@demo.in | Manager |
| priya@demo.in, aman@demo.in, kiran@demo.in | Staff |

Or click **Create a workspace** on the login page to start a fresh firm.

## What's in it

**Work management**
- Projects with keys (`GST-12`), optional client link, project lead
- Issue types: Epic, Story, Task, Bug, Sub-task · priorities · labels · story points · estimates · start/due dates
- Kanban board with drag-and-drop, WIP limits, quick-create, filters (assignee, type, priority, text)
- Backlog and sprints: create, start (with goal and length), complete (unfinished work moves to the next sprint or backlog)
- Epics with progress, sub-tasks, issue links (blocks / relates / duplicates)
- Issue page: inline editing, comments, work log (billable / non-billable), full change history, watchers
- List view with sorting and CSV export · reports: status mix, sprint burndown, workload, created vs resolved, time logged
- Custom workflow per project (rename, reorder, add, delete statuses; category drives "done")
- My work, dashboard, global search (type an issue key like `GST-3` to jump to it)

**People**
- Mark Leave / Absent / Out of office / Work from home, single day, range or half day
- Leave goes to partners/managers for approval; managers can mark entries for others
- Team calendar by month, holidays, "who's out today", monthly summary with CSV export for payroll
- Warnings when an issue's assignee is away today or on the due date
- Team management: roles (Partner / Manager / Staff), designations, deactivate

**Billing**
- Tax invoices, quotations, proforma invoices, credit notes with their own number series
- GST: CGST + SGST for intra-state, IGST for inter-state (from place of supply vs firm state), round-off, amount in words, HSN/SAC tax summary
- Item & service catalogue with SAC/HSN, unit, rate and GST rate
- Printable A4 document (Print → Save as PDF) with bank details and a UPI scan-to-pay QR
- Payments (partial or full), outstanding and overdue tracking, convert quote → invoice, issue credit note, duplicate, cancel
- Client master with PAN / GSTIN / CIN validation and per-client billing history

## Tech

Next.js 15 (App Router, server actions) · TypeScript · Tailwind CSS 4 · Prisma 6 · PostgreSQL on Supabase · JWT session cookie.

```
prisma/schema.prisma        data model
prisma/seed.ts              demo firm
src/lib/                    auth, GST maths, dates, availability helpers
src/app/(auth)/             login, signup
src/app/(app)/              every signed-in page, each with its own actions.ts
```

## Not built yet

E-invoicing (IRN) and e-way bills via a GSP, email/WhatsApp sending, billing logged hours straight into an invoice, query language and automation rules, client portal, payroll, file attachments.
