# Future Scope — CA ORG Management Tool

Where the product stands today, how it is built and scales, and what to build next.
Status markers: ✅ built · 🟡 partly built · ⬜ not built.

---

## 1. Architecture today

```
 Browser (staff of each CA firm)
     │  HTTPS
     ▼
 ┌──────────────────────────────────────────────┐
 │ Vercel — Next.js 15 app (region bom1, Mumbai)│
 │  • Server-rendered pages (React Server Comp.)│
 │  • Server actions (create issue, invoice …)  │
 │  • Middleware: verifies login cookie (JWT)   │
 │  • Each request runs in a serverless function│
 └──────────────────────────────────────────────┘
     │  Prisma ORM → Supabase pooler (port 6543)
     ▼
 ┌──────────────────────────────────────────────┐
 │ Supabase — PostgreSQL 17 (ap-south-1, Mumbai)│
 │  • Supavisor connection pooler               │
 │  • 18 tables, RLS on (public REST API blocked)│
 └──────────────────────────────────────────────┘

 Code: GitHub (private) → every push to main auto-deploys on Vercel.
 Secrets: DATABASE_URL, DIRECT_URL, AUTH_SECRET as Vercel environment variables.
```

- **Modular monolith.** One Next.js app; the "backend" is the server code inside it (`src/app/**/actions.ts`, server components). No separate API server.
- **Stateless auth.** Login is a signed JWT in an httpOnly cookie; no session is held in server memory.
- **Multi-tenant, shared schema.** All firms share the same tables; every row carries `orgId` and every query filters by the signed-in user's `orgId`.
- **Co-located.** App and database are both in Mumbai, so each query is a few ms.

## 2. Scaling

### Horizontal (more machines)

| Layer | How it scales | Managed by |
|---|---|---|
| App (Vercel) | Automatic: more traffic → more function instances in parallel. Instances are stateless, so any instance serves any request. | Vercel |
| DB connections | Supavisor pools thousands of short-lived serverless connections onto a few real Postgres connections. `connection_limit=1` per function instance. | Already configured |
| Database | One Postgres primary today. Add **read replicas** (Supabase paid) for read-heavy load. Sharding firms across databases only at very large scale — the `orgId` design allows it. | Later |

### Vertical (bigger machines)

| Layer | How |
|---|---|
| Vercel functions | Memory/CPU/duration per function depend on the Vercel plan (Hobby → Pro). Rarely the bottleneck. |
| Supabase Postgres | Main lever: compute add-ons (Micro → Small → Medium → Large …) from the dashboard, a few minutes of downtime. |

### Known limits and fixes

| # | Limit | Fix | Priority |
|---|---|---|---|
| 1 | No indexes on `orgId` and foreign keys (Postgres doesn't auto-index FKs) → full table scans as data grows | One migration adding indexes | **High, do first** |
| 2 | Supabase free plan: pauses after ~7 days idle, 500 MB, shared CPU, no restorable backups | Supabase Pro before real customers | High |
| 3 | Vercel Hobby is non-commercial only | Vercel Pro before charging firms | High |
| 4 | Money stored as floating point | Switch to `Decimal` (numeric) columns | High (before real billing) |
| 5 | No caching; every change revalidates the whole app | Per-page / per-firm cache tags | Medium |
| 6 | No background jobs, file storage or email/WhatsApp sending | Vercel Cron or Supabase Edge Functions; Supabase Storage; email/WhatsApp provider | Needed for MVP items below |
| 7 | Prisma 6 (7 is a major upgrade) | Upgrade when convenient | Low |

**Rough capacity as built:** tens of firms / a few hundred users comfortably once indexes exist. Next steps beyond that: Supabase compute upgrade → caching → read replicas.

---

## 3. Product direction — core data model ⚠️

> **The core data model should be Client → Applicable Compliances → Periodic Tasks, not Projects → Issues.**
> If the product turns into a Jira clone, it is pointed the wrong way.

What exists today is a Jira-style **Projects → Issues** engine (boards, sprints, epics), built because the first brief asked for Jira-like features. It is useful as the generic task layer, but the product's centre of gravity should move to compliance:

```
Client ──< ClientCompliance >── ComplianceType (GSTR-1, GSTR-3B, TDS, ITR, AOC-4 …)
                 │                     │
                 │                     └── DueDateRule (editable config, per period/FY)
                 ▼
          ComplianceTask (one per client × compliance × period)
             • status: not started → docs pending → in progress → under review → filed
             • preparer, reviewer, approver (maker-checker)
             • document requests, filing proof (ARN/ack), UDIN, time logs
             • fee → invoice line
```

**Plan:** keep Projects/Issues for ad-hoc work (audits, notices, internal tasks); build the compliance engine as a first-class module that generates `ComplianceTask`s, and make the **filing status grid** the home screen instead of the Jira-style board.

---

## 4. Roadmap

### MVP (build these first)

| Feature | What it means | Status | Notes / what's missing |
|---|---|---|---|
| **Client master** | PAN, GSTIN, TAN, CIN, entity type (individual, firm, company, LLP…), and which compliances apply. Everything else depends on this. | 🟡 | Has PAN, GSTIN, CIN, entity type, manager, contacts. **Missing:** TAN, applicable-compliances selection, DSC/UDIN links. |
| **Compliance engine (recurring tasks)** | Auto-create tasks per client and period from applicable compliances: GSTR-1, GSTR-3B, TDS payment & returns, advance tax, ITR, tax audit, ROC (AOC-4, MGT-7). Due dates as **editable config**, not hardcoded — deadlines get extended constantly. | ⬜ | Needs ComplianceType, ClientCompliance, DueDateRule, ComplianceTask tables + a scheduled job to generate periods. |
| **Filing status dashboard** | Client × compliance grid with status (not started, docs pending, in progress, under review, filed). Overdue in red. Filter by compliance, period, staff. The screen CAs open every morning. | ⬜ | Becomes the new home screen. Current dashboard shows issues/leave/invoices only. |
| **Pending documents tracker** | What's still waiting on the client (bank statements, sales data, Form 16), with one-click WhatsApp/email reminders. Most delays come from missing client documents. | ⬜ | Needs DocumentRequest table, reminder log, WhatsApp/email provider. |
| **Assignment & review workflow** | Maker-checker: article/junior prepares, senior reviews, partner approves. Every task has an owner and a reviewer. | 🟡 | Issues have assignee + reporter and an "In Review" status. **Missing:** reviewer/approver fields, approve/send-back actions, enforcement that only the reviewer can mark done. |
| **Filing proof upload** | Attach acknowledgement / ARN to each filed task so "filed" means proven. | ⬜ | Needs Supabase Storage + attachment table; block "Filed" status without proof. |
| **Billing linked to work** | Fee per service per client; GST invoices generated from completed tasks or recurring retainers; outstanding tracking and reminders. | 🟡 | **Built:** GST invoices, quotations, proforma, credit notes, payments, outstanding/overdue, item rate card, UPI QR, print/PDF. **Missing:** per-client fee schedule, invoice-from-completed-tasks, recurring retainers, reminder sending. |

### Phase 2

| Feature | What it means | Status | Notes |
|---|---|---|---|
| **Attendance & leave** | Leave requests, absence/OOO/WFH, peak-season leave blocking. | 🟡 | **Built:** leave/absent/OOO/WFH, half days, approvals, holidays, team calendar, monthly summary + CSV. Check-in/out deliberately left out (firm wants Teams-style marking). **Missing:** peak-season leave blocking (e.g. block leave 15th–20th and around ITR/audit deadlines), leave balances/policies. |
| **Timesheets on tasks** | Hours logged against client tasks, not free-floating. | 🟡 | Work logs exist on issues (billable flag). Move/extend to ComplianceTask so time rolls up per client. |
| **Client profitability** | Fees billed vs hours spent per client. Can justify the price on its own. | ⬜ | Needs cost rate per staff member + report joining work logs and invoices per client. Data is mostly already captured. |
| **Staff workload view** | Who's overloaded before the 20th and who's free. | 🟡 | Per-project workload report exists. **Missing:** firm-wide view by due-date window, combined with availability. |
| **DSC expiry tracker** | Alerts before clients' digital signature certificates expire. | ⬜ | DSC table (holder, client, expiry) + daily alert job. |
| **UDIN tracking** | Record UDIN against every certificate or audit report signed. | ⬜ | UDIN field/table linked to task, client and signing partner. |

### Later, carefully

| Feature | What it means | Status | Notes |
|---|---|---|---|
| **Client portal credentials vault** | Firms keep GST / income-tax portal logins in Excel today. | ⬜ | Big security liability. Only with field-level encryption (e.g. Supabase Vault / KMS), strict per-role access, reveal-on-demand and a full access log. |
| **Roles, permissions, audit log** | Partners, managers, articles and admins see different things. | 🟡 | **Built:** Partner / Manager / Staff with some restrictions (settings, team, approvals). **Missing:** billing restricted from staff, an Accounts role, staff limited to assigned clients/projects, invite-only sign-up, firm-wide audit log (only issue history exists). |
| **Client portal** | Clients log in to see task status, upload documents, pay invoices. | ⬜ | Pairs with the pending-documents tracker. |
| **E-invoicing / e-way bills** | IRN + QR via a GSP. | ⬜ | Start with JSON export for manual upload to the free IRP portal; add GSP API later. |
| **Payroll** | Salary structure, PF/ESI/PT/TDS, payslips. | ⬜ | Consider integrating a payroll provider instead of building. |

---

## 5. Roles — proposed (to be confirmed)

| Area | Partner | Manager | Accounts | Staff / Article |
|---|---|---|---|---|
| Compliance grid, own tasks | All clients | All clients | — | Assigned clients only |
| Review / approve tasks | ✅ approve | ✅ review | — | ❌ |
| Billing (invoices, payments) | ✅ | 👁 view | ✅ | ❌ |
| Clients, items | ✅ | ✅ | ✅ | 👁 assigned |
| Team, roles | ✅ | ✅ (not partners) | ❌ | ❌ |
| Leave approvals | ✅ | ✅ | ❌ | ❌ |
| Firm settings | ✅ | ❌ | ❌ | ❌ |
| Credentials vault (later) | ✅ | per-client grant | ❌ | per-client grant |

Sign-up: invite-only while testing with known firms.

---

## 6. Suggested order of work

1. Database indexes; Decimal money columns.
2. Client master additions (TAN, applicable compliances).
3. Compliance engine + editable due-date config + scheduled generation.
4. Filing status grid as the home screen.
5. Maker-checker review flow + filing proof upload (Supabase Storage).
6. Pending documents tracker + WhatsApp/email reminders.
7. Billing from completed tasks, per-client fees, recurring retainers.
8. Roles tightening (billing access, Accounts role, assigned-clients scope, invite-only).
9. Phase 2: profitability, workload view, DSC tracker, UDIN, peak-season leave blocking.
10. Upgrade to Supabase Pro + Vercel Pro before onboarding paying firms.
