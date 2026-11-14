import "server-only";
import { db } from "./db";

const PREFIX_FIELD: Record<string, "invoicePrefix" | "quotePrefix" | "proformaPrefix" | "creditPrefix"> = {
  INVOICE: "invoicePrefix",
  QUOTATION: "quotePrefix",
  PROFORMA: "proformaPrefix",
  CREDIT_NOTE: "creditPrefix",
};

/** Next number in the series, e.g. INV-0006. Looks at the highest existing number with the same prefix. */
export async function nextNumber(orgId: string, docType: string) {
  const org = await db.organization.findUniqueOrThrow({ where: { id: orgId } });
  const prefix = org[PREFIX_FIELD[docType]] || docType.slice(0, 3);
  const existing = await db.invoice.findMany({ where: { orgId, docType, number: { startsWith: `${prefix}-` } }, select: { number: true } });
  const max = existing.reduce((m, i) => Math.max(m, parseInt(i.number.slice(prefix.length + 1), 10) || 0), 0);
  return `${prefix}-${String(max + 1).padStart(4, "0")}`;
}
