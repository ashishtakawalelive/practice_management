/* Demo data: a small CA firm in Pune. Login credentials are listed in README.md. */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { computeTotals } from "../src/lib/gst";
import { DEFAULT_WORKFLOW } from "../src/lib/constants";

const db = new PrismaClient();

function day(offset: number) {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + offset));
}

async function main() {
  // Safety: this database is shared (Supabase). Only seed an empty database.
  if ((await db.organization.count()) > 0) {
    console.log("Database already has data — seed skipped. Nothing was changed.");
    return;
  }

  const org = await db.organization.create({
    data: {
      name: "Sharma & Associates",
      legalName: "Sharma & Associates, Chartered Accountants",
      gstin: "27AAQFS1234K1Z5",
      pan: "AAQFS1234K",
      address: "Office 402, Shivaji Nagar Business Park, FC Road",
      city: "Pune",
      state: "Maharashtra",
      stateCode: "27",
      pincode: "411005",
      phone: "+91 98220 00000",
      email: "accounts@sharma-associates.example",
      bankName: "HDFC Bank",
      bankAccountNo: "50200012345678",
      bankIfsc: "HDFC0001234",
      bankBranch: "FC Road, Pune",
      upiId: "sharmaassociates@hdfcbank",
      invoiceTerms:
        "1. Payment due within 15 days of invoice date.\n2. Interest @18% p.a. will be charged on overdue amounts.\n3. Subject to Pune jurisdiction.",
    },
  });

  const hash = await bcrypt.hash("demo1234", 10);
  const mk = (name: string, email: string, role: string, designation: string) =>
    db.user.create({ data: { orgId: org.id, name, email, role, designation, passwordHash: hash } });

  const partner = await mk("Rohit Sharma", "partner@demo.in", "PARTNER", "Managing Partner");
  const manager = await mk("Neha Kulkarni", "manager@demo.in", "MANAGER", "Audit Manager");
  const priya = await mk("Priya Deshmukh", "priya@demo.in", "STAFF", "Article Assistant");
  const aman = await mk("Aman Joshi", "aman@demo.in", "STAFF", "Semi-qualified Assistant");
  const kiran = await mk("Kiran Patil", "kiran@demo.in", "STAFF", "Accounts Executive");
  const team = [partner, manager, priya, aman, kiran];

  const clientData = [
    { name: "Patil Engineering Pvt Ltd", entityType: "COMPANY", pan: "AABCP1234E", gstin: "27AABCP1234E1Z2", cin: "U29100PN2015PTC123456", contactPerson: "Suresh Patil", email: "accounts@patileng.example", phone: "+91 98230 11111", city: "Pune", state: "Maharashtra", stateCode: "27", managerId: manager.id },
    { name: "GreenLeaf Organics LLP", entityType: "LLP", pan: "AAKFG5678L", gstin: "27AAKFG5678L1Z9", contactPerson: "Meera Iyer", email: "meera@greenleaf.example", phone: "+91 98900 22222", city: "Nashik", state: "Maharashtra", stateCode: "27", managerId: manager.id },
    { name: "Bluewave Software Solutions Pvt Ltd", entityType: "COMPANY", pan: "AAFCB9012C", gstin: "29AAFCB9012C1Z4", cin: "U72200KA2018PTC654321", contactPerson: "Arjun Rao", email: "finance@bluewave.example", phone: "+91 99000 33333", city: "Bengaluru", state: "Karnataka", stateCode: "29", managerId: partner.id },
    { name: "Mehta Textiles", entityType: "PROPRIETORSHIP", pan: "AGVPM3456K", gstin: "24AGVPM3456K1Z1", contactPerson: "Rakesh Mehta", email: "rakesh@mehtatextiles.example", phone: "+91 97250 44444", city: "Surat", state: "Gujarat", stateCode: "24", managerId: manager.id },
    { name: "Dr. Anjali Kulkarni", entityType: "INDIVIDUAL", pan: "BQRPK7890M", contactPerson: "Dr. Anjali Kulkarni", email: "anjali.k@example.com", phone: "+91 98500 55555", city: "Pune", state: "Maharashtra", stateCode: "27", managerId: partner.id },
    { name: "Sai Krupa Housing Society", entityType: "TRUST", pan: "AAATS2468J", contactPerson: "Secretary", email: "saikrupa.society@example.com", phone: "+91 98810 66666", city: "Pune", state: "Maharashtra", stateCode: "27", managerId: manager.id },
  ];
  const clients = [];
  for (const c of clientData) clients.push(await db.client.create({ data: { orgId: org.id, ...c } }));
  const [patil, greenleaf, bluewave, mehta, anjali] = clients;

  async function project(key: string, name: string, description: string, leadId: string, clientId?: string) {
    return db.project.create({
      data: {
        orgId: org.id,
        key,
        name,
        description,
        leadId,
        clientId,
        statuses: { create: DEFAULT_WORKFLOW.map((s, i) => ({ ...s, position: i })) },
      },
      include: { statuses: { orderBy: { position: "asc" } } },
    });
  }

  const gst = await project("GST", "GST Compliance", "Monthly and quarterly GST returns for all GST-registered clients.", manager.id);
  const aud = await project("AUD", "Statutory Audit FY 2025-26", "Statutory audit of Patil Engineering Pvt Ltd under the Companies Act, 2013.", manager.id, patil.id);
  const itr = await project("ITR", "Income Tax Returns AY 2026-27", "ITR filing, tax audit and advance tax for individual and business clients.", partner.id);
  const ops = await project("OPS", "Firm Operations", "Internal tasks: billing, hiring, training and admin.", partner.id);

  const audSprint1 = await db.sprint.create({
    data: { projectId: aud.id, name: "AUD Sprint 1", goal: "Planning and vouching complete", state: "CLOSED", startDate: day(-28), endDate: day(-15) },
  });
  const audSprint2 = await db.sprint.create({
    data: { projectId: aud.id, name: "AUD Sprint 2", goal: "Finish verification of fixed assets and payables", state: "ACTIVE", startDate: day(-14), endDate: day(0) },
  });
  await db.sprint.create({ data: { projectId: aud.id, name: "AUD Sprint 3", goal: "Draft financials and audit report", state: "FUTURE" } });

  type Spec = {
    p: typeof gst;
    title: string;
    type?: string;
    status: number;
    priority?: string;
    assignee?: { id: string };
    due?: number;
    sprintId?: string;
    epic?: string;
    labels?: string;
    points?: number;
    estimate?: number;
    description?: string;
    parent?: string;
  };
  const created: Record<string, { id: string }> = {};
  const counters: Record<string, number> = {};

  async function issue(ref: string, s: Spec) {
    counters[s.p.id] = (counters[s.p.id] ?? 0) + 1;
    const statusRow = s.p.statuses[s.status];
    const row = await db.issue.create({
      data: {
        orgId: org.id,
        projectId: s.p.id,
        number: counters[s.p.id],
        type: s.type ?? "TASK",
        title: s.title,
        description: s.description,
        statusId: statusRow.id,
        priority: s.priority ?? "MEDIUM",
        assigneeId: s.assignee?.id,
        reporterId: manager.id,
        dueDate: s.due !== undefined ? day(s.due) : null,
        sprintId: s.sprintId,
        epicId: s.epic ? created[s.epic].id : null,
        parentId: s.parent ? created[s.parent].id : null,
        labels: s.labels,
        storyPoints: s.points,
        estimateMins: s.estimate,
        position: counters[s.p.id] * 1000,
        resolvedAt: statusRow.category === "DONE" ? day(-2) : null,
        activities: { create: { actorId: manager.id, action: "created" } },
      },
    });
    created[ref] = row;
    return row;
  }

  // GST project
  await issue("gstEpic", { p: gst, title: "GST returns — current month", type: "EPIC", status: 1, assignee: manager });
  await issue("g1", { p: gst, title: "GSTR-1: Patil Engineering", status: 3, priority: "HIGH", assignee: priya, due: -2, epic: "gstEpic", labels: "gstr1,monthly", estimate: 120 });
  await issue("g2", { p: gst, title: "GSTR-1: GreenLeaf Organics", status: 2, priority: "HIGH", assignee: aman, due: -2, epic: "gstEpic", labels: "gstr1,monthly", estimate: 90 });
  await issue("g3", { p: gst, title: "GSTR-3B: Patil Engineering", status: 1, priority: "HIGHEST", assignee: priya, due: 3, epic: "gstEpic", labels: "gstr3b,monthly", estimate: 120, description: "Reconcile ITC with GSTR-2B before filing. Flag any supplier who has not filed." });
  await issue("g4", { p: gst, title: "GSTR-3B: GreenLeaf Organics", status: 0, priority: "HIGH", assignee: aman, due: 3, epic: "gstEpic", labels: "gstr3b,monthly" });
  await issue("g5", { p: gst, title: "GSTR-1 & 3B: Bluewave Software (Karnataka)", status: 0, priority: "HIGH", assignee: kiran, due: 5, epic: "gstEpic", labels: "gstr1,gstr3b" });
  await issue("g6", { p: gst, title: "Mehta Textiles: reply to GST notice ASMT-10", type: "BUG", status: 1, priority: "HIGHEST", assignee: manager, due: 1, labels: "notice", description: "Mismatch between GSTR-1 and GSTR-3B for the previous year. Prepare reconciliation and draft reply." });
  await issue("g7", { p: gst, title: "Collect purchase register from Mehta Textiles", type: "SUBTASK", status: 3, assignee: kiran, parent: "g6" });
  await issue("g8", { p: gst, title: "Prepare GSTR-1 vs 3B reconciliation", type: "SUBTASK", status: 1, assignee: manager, parent: "g6" });
  await issue("g9", { p: gst, title: "GSTR-9 annual return: Patil Engineering", type: "STORY", status: 0, priority: "MEDIUM", assignee: priya, due: 30, labels: "annual" });

  // Audit project (sprints)
  await issue("aEpic", { p: aud, title: "Audit fieldwork", type: "EPIC", status: 1, assignee: manager });
  await issue("a1", { p: aud, title: "Audit planning memorandum", type: "STORY", status: 3, assignee: manager, sprintId: audSprint1.id, epic: "aEpic", points: 3 });
  await issue("a2", { p: aud, title: "Vouching of sales (sample 60 invoices)", type: "STORY", status: 3, assignee: priya, sprintId: audSprint1.id, epic: "aEpic", points: 5 });
  await issue("a3", { p: aud, title: "Physical verification of fixed assets", type: "STORY", status: 2, assignee: aman, sprintId: audSprint2.id, epic: "aEpic", points: 5, due: 0 });
  await issue("a4", { p: aud, title: "Trade payables confirmation (top 20 vendors)", type: "STORY", status: 1, assignee: priya, sprintId: audSprint2.id, epic: "aEpic", points: 3, due: 2 });
  await issue("a5", { p: aud, title: "Bank reconciliation review — March", type: "TASK", status: 1, assignee: aman, sprintId: audSprint2.id, epic: "aEpic", points: 2 });
  await issue("a6", { p: aud, title: "Inventory valuation differs from ledger", type: "BUG", status: 0, priority: "HIGH", assignee: manager, sprintId: audSprint2.id, epic: "aEpic", points: 3, description: "Closing stock per valuation sheet is ₹4.2L higher than the ledger. Check costing method." });
  await issue("a7", { p: aud, title: "Draft financial statements (Schedule III)", type: "STORY", status: 0, assignee: manager, epic: "aEpic", points: 8 });
  await issue("a8", { p: aud, title: "CARO 2020 reporting checklist", type: "TASK", status: 0, assignee: priya, points: 3 });
  await issue("a9", { p: aud, title: "Draft independent auditor's report", type: "TASK", status: 0, assignee: partner, points: 5 });

  // ITR project
  await issue("i1", { p: itr, title: "ITR-2: Dr. Anjali Kulkarni", status: 1, assignee: kiran, due: 10, labels: "itr", description: "Capital gains on mutual funds. Get CAS statement and AIS." });
  await issue("i2", { p: itr, title: "Tax audit (Form 3CD): Mehta Textiles", type: "STORY", status: 0, priority: "HIGH", assignee: manager, due: 20, labels: "tax-audit" });
  await issue("i3", { p: itr, title: "Advance tax working Q3: Bluewave Software", status: 0, priority: "HIGH", assignee: partner, due: 25, labels: "advance-tax" });
  await issue("i4", { p: itr, title: "Download AIS/TIS for all individual clients", status: 3, assignee: kiran, labels: "itr" });

  // Ops
  await issue("o1", { p: ops, title: "Raise monthly retainer invoices", status: 0, priority: "HIGH", assignee: kiran, due: 1, labels: "billing" });
  await issue("o2", { p: ops, title: "Interview articleship candidates", status: 1, assignee: partner, due: 7 });
  await issue("o3", { p: ops, title: "Renew DSC for Patil Engineering directors", type: "TASK", status: 0, priority: "HIGHEST", assignee: aman, due: 4, labels: "dsc", description: "Both directors' DSCs expire this month." });

  for (const [key, p] of [["GST", gst], ["AUD", aud], ["ITR", itr], ["OPS", ops]] as const) {
    await db.project.update({ where: { id: p.id }, data: { issueCounter: counters[p.id] } });
    void key;
  }

  // Comments, links, work logs
  await db.comment.create({ data: { issueId: created.g3.id, authorId: priya.id, body: "ITC in books is ₹1,840 higher than 2B. Two invoices from Sai Steels missing — emailed the client." } });
  await db.comment.create({ data: { issueId: created.g3.id, authorId: manager.id, body: "Good catch. Hold that ITC until the supplier files; claim the rest." } });
  await db.comment.create({ data: { issueId: created.a6.id, authorId: partner.id, body: "Discuss with the CFO on Monday. Could be FIFO vs weighted average." } });
  await db.issueLink.create({ data: { fromId: created.g1.id, toId: created.g3.id, type: "BLOCKS" } });
  await db.issueLink.create({ data: { fromId: created.a3.id, toId: created.a7.id, type: "BLOCKS" } });

  const logs: [string, { id: string }, number, number][] = [
    ["g1", priya, 135, -3], ["g2", aman, 80, -3], ["g3", priya, 60, -1], ["g6", manager, 150, -1],
    ["a2", priya, 420, -18], ["a3", aman, 300, -2], ["a4", priya, 120, -1], ["a1", manager, 180, -25],
    ["i1", kiran, 90, -1], ["i4", kiran, 60, -5],
  ];
  for (const [ref, u, minutes, d] of logs) {
    await db.workLog.create({ data: { issueId: created[ref].id, userId: u.id, minutes, date: day(d), note: "Work done", billable: true } });
  }

  // Availability
  await db.availabilityEntry.createMany({
    data: [
      { orgId: org.id, userId: aman.id, type: "OOO", startDate: day(0), endDate: day(1), note: "At Patil Engineering factory for fixed-asset verification", status: "APPROVED" },
      { orgId: org.id, userId: kiran.id, type: "WFH", startDate: day(0), endDate: day(0), status: "APPROVED" },
      { orgId: org.id, userId: priya.id, type: "LEAVE", startDate: day(6), endDate: day(8), note: "Family function", status: "PENDING" },
      { orgId: org.id, userId: manager.id, type: "LEAVE", startDate: day(-10), endDate: day(-9), note: "Personal", status: "APPROVED", approverId: partner.id },
      { orgId: org.id, userId: aman.id, type: "ABSENT", startDate: day(-4), endDate: day(-4), note: "Unwell", status: "APPROVED" },
      { orgId: org.id, userId: partner.id, type: "OOO", startDate: day(3), endDate: day(3), note: "ICAI seminar, Mumbai", status: "APPROVED" },
      { orgId: org.id, userId: kiran.id, type: "LEAVE", startDate: day(12), endDate: day(12), halfDay: true, note: "Bank work", status: "PENDING" },
    ],
  });
  const year = new Date().getFullYear();
  await db.holiday.createMany({
    data: [
      { orgId: org.id, date: new Date(Date.UTC(year, 0, 26)), name: "Republic Day" },
      { orgId: org.id, date: new Date(Date.UTC(year, 7, 15)), name: "Independence Day" },
      { orgId: org.id, date: new Date(Date.UTC(year, 9, 2)), name: "Gandhi Jayanti" },
      { orgId: org.id, date: new Date(Date.UTC(year, 10, 25)), name: "Firm offsite" },
      { orgId: org.id, date: new Date(Date.UTC(year, 11, 25)), name: "Christmas" },
    ],
  });

  // Items
  const itemRows = [
    { name: "GST return filing (monthly)", hsnSac: "998231", unit: "MONTHS", rate: 3500, gstRate: 18 },
    { name: "Statutory audit fee", hsnSac: "998221", unit: "NOS", rate: 150000, gstRate: 18 },
    { name: "Income tax return filing", hsnSac: "998231", unit: "NOS", rate: 5000, gstRate: 18 },
    { name: "Tax audit (Form 3CD)", hsnSac: "998221", unit: "NOS", rate: 45000, gstRate: 18 },
    { name: "Accounting & bookkeeping", hsnSac: "998222", unit: "MONTHS", rate: 8000, gstRate: 18 },
    { name: "Professional consultation", hsnSac: "998231", unit: "HRS", rate: 2500, gstRate: 18 },
    { name: "ROC annual filing", hsnSac: "998231", unit: "NOS", rate: 12000, gstRate: 18 },
    { name: "Out-of-pocket expenses (reimbursement)", hsnSac: "998231", unit: "NOS", rate: 0, gstRate: 18 },
  ];
  const items: Awaited<ReturnType<typeof db.item.create>>[] = [];
  for (const it of itemRows) items.push(await db.item.create({ data: { orgId: org.id, kind: "SERVICE", ...it } }));

  // Invoices
  async function invoice(
    docType: string,
    number: string,
    client: typeof patil,
    issueOffset: number,
    lines: { item: (typeof items)[number]; qty: number; rate?: number; discountPct?: number }[],
    status: string,
    paid = 0,
  ) {
    const interState = (client.stateCode ?? org.stateCode) !== org.stateCode;
    const inputs = lines.map((l) => ({ qty: l.qty, rate: l.rate ?? l.item.rate, discountPct: l.discountPct ?? 0, gstRate: l.item.gstRate }));
    const t = computeTotals(inputs, interState);
    const inv = await db.invoice.create({
      data: {
        orgId: org.id,
        docType,
        number,
        clientId: client.id,
        issueDate: day(issueOffset),
        dueDate: docType === "INVOICE" ? day(issueOffset + 15) : day(issueOffset + 30),
        placeOfSupply: client.stateCode,
        interState,
        status,
        terms: org.invoiceTerms,
        notes: "Thank you for your business.",
        subtotal: t.subtotal,
        cgst: t.cgst,
        sgst: t.sgst,
        igst: t.igst,
        roundOff: t.roundOff,
        total: t.total,
        amountPaid: paid,
        lines: {
          create: t.lines.map((l, i) => ({
            position: i,
            itemId: lines[i].item.id,
            description: lines[i].item.name,
            hsnSac: lines[i].item.hsnSac,
            unit: lines[i].item.unit,
            qty: l.qty,
            rate: l.rate,
            discountPct: l.discountPct,
            gstRate: l.gstRate,
            taxable: l.taxable,
            cgst: l.cgst,
            sgst: l.sgst,
            igst: l.igst,
            amount: l.amount,
          })),
        },
      },
    });
    if (paid > 0) {
      await db.payment.create({ data: { invoiceId: inv.id, amount: paid, date: day(issueOffset + 5), mode: "BANK_TRANSFER", reference: "NEFT/" + number } });
    }
    return inv;
  }

  await invoice("INVOICE", "INV-0001", patil, -40, [{ item: items[0], qty: 3 }, { item: items[4], qty: 3 }], "PAID", 0);
  await invoice("INVOICE", "INV-0002", bluewave, -25, [{ item: items[0], qty: 1 }, { item: items[5], qty: 6 }], "PARTIAL", 10000);
  await invoice("INVOICE", "INV-0003", mehta, -20, [{ item: items[3], qty: 1 }], "SENT");
  await invoice("INVOICE", "INV-0004", anjali, -3, [{ item: items[2], qty: 1, discountPct: 10 }], "SENT");
  await invoice("INVOICE", "INV-0005", greenleaf, -1, [{ item: items[0], qty: 1 }, { item: items[6], qty: 1 }], "DRAFT");
  await invoice("QUOTATION", "QT-0001", patil, -45, [{ item: items[1], qty: 1 }, { item: items[3], qty: 1 }], "ACCEPTED");
  await invoice("QUOTATION", "QT-0002", greenleaf, -2, [{ item: items[4], qty: 12, rate: 7000 }], "SENT");

  // Mark INV-0001 fully paid using its real total
  const inv1 = await db.invoice.findFirstOrThrow({ where: { orgId: org.id, number: "INV-0001" } });
  await db.invoice.update({ where: { id: inv1.id }, data: { amountPaid: inv1.total } });
  await db.payment.create({ data: { invoiceId: inv1.id, amount: inv1.total, date: day(-30), mode: "UPI", reference: "UPI/4512" } });

  console.log(`Seeded "${org.name}" with ${team.length} users, ${clients.length} clients, 4 projects.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
