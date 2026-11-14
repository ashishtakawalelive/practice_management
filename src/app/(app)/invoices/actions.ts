"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { DOC_TYPES, PAYMENT_MODES } from "@/lib/constants";
import { computeTotals, round2 } from "@/lib/gst";
import { toDateOnly, todayIST, addDays } from "@/lib/dates";
import { nextNumber } from "@/lib/invoices";
import type { FormState } from "@/components/form-bits";

function str(data: FormData, key: string) {
  const v = data.get(key);
  return v == null ? "" : String(v).trim();
}
function refresh() {
  revalidatePath("/", "layout");
}

export type InvoicePayload = {
  id?: string;
  docType: string;
  number: string;
  clientId: string;
  issueDate: string;
  dueDate?: string;
  placeOfSupply?: string;
  reference?: string;
  notes?: string;
  terms?: string;
  lines: { itemId?: string; description: string; hsnSac?: string; qty: number; unit: string; rate: number; discountPct: number; gstRate: number }[];
};

export async function saveInvoice(payload: InvoicePayload, asDraft: boolean): Promise<FormState> {
  const user = await requireUser();
  if (!DOC_TYPES.includes(payload.docType as never)) return { error: "Unknown document type." };
  const client = await db.client.findFirst({ where: { id: payload.clientId, orgId: user.orgId } });
  if (!client) return { error: "Choose a client." };
  const lines = payload.lines.filter((l) => l.description.trim());
  if (lines.length === 0) return { error: "Add at least one line item." };
  if (lines.some((l) => !(l.qty > 0) || l.rate < 0 || l.discountPct < 0 || l.discountPct > 100)) return { error: "Check quantities, rates and discounts." };
  const number = payload.number.trim();
  if (!number) return { error: "Document number is required." };
  if (!payload.issueDate) return { error: "Pick a date." };

  const placeOfSupply = payload.placeOfSupply || client.stateCode || user.org.stateCode || null;
  const interState = !!placeOfSupply && !!user.org.stateCode && placeOfSupply !== user.org.stateCode;
  const t = computeTotals(lines, interState);

  const clash = await db.invoice.findFirst({ where: { orgId: user.orgId, docType: payload.docType, number, NOT: payload.id ? { id: payload.id } : undefined } });
  if (clash) return { error: `${number} is already used. Pick another number.` };

  const data = {
    docType: payload.docType,
    number,
    clientId: client.id,
    issueDate: toDateOnly(payload.issueDate),
    dueDate: payload.dueDate ? toDateOnly(payload.dueDate) : null,
    placeOfSupply,
    interState,
    reference: payload.reference?.trim() || null,
    notes: payload.notes?.trim() || null,
    terms: payload.terms?.trim() || null,
    subtotal: t.subtotal,
    cgst: t.cgst,
    sgst: t.sgst,
    igst: t.igst,
    roundOff: t.roundOff,
    total: t.total,
  };
  const lineRows = t.lines.map((l, i) => ({
    position: i,
    itemId: lines[i].itemId || null,
    description: lines[i].description.trim(),
    hsnSac: lines[i].hsnSac?.trim() || null,
    unit: lines[i].unit || "NOS",
    qty: l.qty,
    rate: l.rate,
    discountPct: l.discountPct,
    gstRate: l.gstRate,
    taxable: l.taxable,
    cgst: l.cgst,
    sgst: l.sgst,
    igst: l.igst,
    amount: l.amount,
  }));

  let id = payload.id;
  if (id) {
    const existing = await db.invoice.findFirst({ where: { id, orgId: user.orgId } });
    if (!existing) return { error: "Document not found." };
    if (existing.amountPaid > 0) return { error: "This invoice has payments recorded. Remove them before editing." };
    if (existing.status === "CANCELLED") return { error: "Cancelled documents can't be edited." };
    await db.$transaction([
      db.invoiceLine.deleteMany({ where: { invoiceId: id } }),
      db.invoice.update({
        where: { id },
        data: { ...data, status: existing.status === "DRAFT" && !asDraft ? "SENT" : existing.status, lines: { create: lineRows } },
      }),
    ]);
  } else {
    const inv = await db.invoice.create({
      data: { orgId: user.orgId, ...data, status: asDraft ? "DRAFT" : "SENT", lines: { create: lineRows } },
    });
    id = inv.id;
  }
  refresh();
  redirect(`/invoices/${id}`);
}

async function ownInvoice(id: string) {
  const user = await requireUser();
  const invoice = await db.invoice.findFirst({ where: { id, orgId: user.orgId }, include: { lines: true } });
  if (!invoice) throw new Error("Not found");
  return { user, invoice };
}

export async function setInvoiceStatus(id: string, status: string) {
  const { invoice } = await ownInvoice(id);
  const allowed: Record<string, string[]> = {
    INVOICE: ["SENT", "CANCELLED"],
    PROFORMA: ["SENT", "CANCELLED"],
    CREDIT_NOTE: ["SENT", "CANCELLED"],
    QUOTATION: ["SENT", "ACCEPTED", "DECLINED", "CANCELLED"],
  };
  if (!allowed[invoice.docType]?.includes(status)) return;
  if (status === "CANCELLED" && invoice.amountPaid > 0) return;
  await db.invoice.update({ where: { id }, data: { status } });
  refresh();
}

export async function deleteDraft(id: string) {
  const { invoice } = await ownInvoice(id);
  if (invoice.status !== "DRAFT") return;
  await db.invoice.delete({ where: { id } });
  refresh();
  redirect(invoice.docType === "QUOTATION" ? "/quotations" : "/invoices");
}

function paymentStatus(total: number, paid: number) {
  if (paid <= 0) return "SENT";
  if (paid + 0.005 >= total) return "PAID";
  return "PARTIAL";
}

export async function recordPayment(id: string, _: FormState, data: FormData): Promise<FormState> {
  const { invoice } = await ownInvoice(id);
  if (invoice.docType !== "INVOICE") return { error: "Payments are recorded against tax invoices." };
  if (invoice.status === "CANCELLED" || invoice.status === "DRAFT") return { error: "Finalise the invoice before recording a payment." };
  const amount = round2(parseFloat(str(data, "amount")));
  const balance = round2(invoice.total - invoice.amountPaid);
  if (!(amount > 0)) return { error: "Enter the amount received." };
  if (amount > balance + 0.005) return { error: `That's more than the balance due (₹${balance}).` };
  const mode = PAYMENT_MODES[str(data, "mode")] ? str(data, "mode") : "UPI";
  const paid = round2(invoice.amountPaid + amount);
  await db.$transaction([
    db.payment.create({
      data: {
        invoiceId: id,
        amount,
        date: str(data, "date") ? toDateOnly(str(data, "date")) : todayIST(),
        mode,
        reference: str(data, "reference") || null,
        note: str(data, "note") || null,
      },
    }),
    db.invoice.update({ where: { id }, data: { amountPaid: paid, status: paymentStatus(invoice.total, paid) } }),
  ]);
  refresh();
  return { ok: true };
}

export async function deletePayment(paymentId: string) {
  const user = await requireUser();
  const p = await db.payment.findFirst({ where: { id: paymentId, invoice: { orgId: user.orgId } }, include: { invoice: true } });
  if (!p) return;
  const paid = round2(p.invoice.amountPaid - p.amount);
  await db.$transaction([
    db.payment.delete({ where: { id: p.id } }),
    db.invoice.update({ where: { id: p.invoiceId }, data: { amountPaid: paid, status: paymentStatus(p.invoice.total, paid) } }),
  ]);
  refresh();
}

/** Copies a document into a new draft of `docType` (quote → invoice, invoice → credit note, duplicate). */
export async function convertDocument(id: string, docType: string) {
  const { user, invoice } = await ownInvoice(id);
  if (!DOC_TYPES.includes(docType as never)) return;
  const today = todayIST();
  const copy = await db.invoice.create({
    data: {
      orgId: user.orgId,
      docType,
      number: await nextNumber(user.orgId, docType),
      clientId: invoice.clientId,
      issueDate: today,
      dueDate: docType === "INVOICE" ? addDays(today, 15) : null,
      placeOfSupply: invoice.placeOfSupply,
      interState: invoice.interState,
      status: "DRAFT",
      reference: docType === "CREDIT_NOTE" ? `Against ${invoice.number}` : invoice.docType === "QUOTATION" ? `Ref: ${invoice.number}` : invoice.reference,
      notes: invoice.notes,
      terms: invoice.terms,
      subtotal: invoice.subtotal,
      cgst: invoice.cgst,
      sgst: invoice.sgst,
      igst: invoice.igst,
      roundOff: invoice.roundOff,
      total: invoice.total,
      lines: {
        create: invoice.lines
          .sort((a, b) => a.position - b.position)
          .map(({ id: _id, invoiceId: _inv, ...l }) => l),
      },
    },
  });
  if (invoice.docType === "QUOTATION" && docType === "INVOICE") {
    await db.invoice.update({ where: { id: invoice.id }, data: { status: "ACCEPTED" } });
  }
  refresh();
  redirect(`/invoices/${copy.id}/edit`);
}

// ── Items & services ──

export async function saveItem(itemId: string | null, _: FormState, data: FormData): Promise<FormState> {
  const user = await requireUser();
  const name = str(data, "name");
  if (!name) return { error: "Name is required." };
  const fields = {
    name,
    description: str(data, "description") || null,
    kind: str(data, "kind") === "GOODS" ? "GOODS" : "SERVICE",
    hsnSac: str(data, "hsnSac") || null,
    unit: str(data, "unit") || "NOS",
    rate: parseFloat(str(data, "rate")) || 0,
    gstRate: parseFloat(str(data, "gstRate")) || 0,
  };
  if (itemId) await db.item.updateMany({ where: { id: itemId, orgId: user.orgId }, data: fields });
  else await db.item.create({ data: { orgId: user.orgId, ...fields } });
  refresh();
  return { ok: true };
}

export async function setItemActive(itemId: string, active: boolean) {
  const user = await requireUser();
  await db.item.updateMany({ where: { id: itemId, orgId: user.orgId }, data: { active } });
  refresh();
}
