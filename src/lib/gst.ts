/** GST and money helpers. All amounts are rounded to paise (2 decimals). */

export function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export type LineInput = {
  qty: number;
  rate: number;
  discountPct: number;
  gstRate: number;
};

export type LineTotals = {
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  amount: number;
};

/**
 * Tax for one line. Intra-state supply splits GST equally into CGST + SGST;
 * inter-state supply charges IGST at the full rate.
 */
export function computeLine(line: LineInput, interState: boolean): LineTotals {
  const gross = line.qty * line.rate;
  const taxable = round2(gross - (gross * (line.discountPct || 0)) / 100);
  const tax = (taxable * line.gstRate) / 100;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  if (interState) {
    igst = round2(tax);
  } else {
    cgst = round2(tax / 2);
    sgst = round2(tax / 2);
  }
  return { taxable, cgst, sgst, igst, amount: round2(taxable + cgst + sgst + igst) };
}

export function computeTotals(lines: LineInput[], interState: boolean) {
  const computed = lines.map((l) => ({ ...l, ...computeLine(l, interState) }));
  const subtotal = round2(computed.reduce((s, l) => s + l.taxable, 0));
  const cgst = round2(computed.reduce((s, l) => s + l.cgst, 0));
  const sgst = round2(computed.reduce((s, l) => s + l.sgst, 0));
  const igst = round2(computed.reduce((s, l) => s + l.igst, 0));
  const exact = round2(subtotal + cgst + sgst + igst);
  const total = Math.round(exact);
  const roundOff = round2(total - exact);
  return { lines: computed, subtotal, cgst, sgst, igst, roundOff, total };
}

/** Rate-wise summary used in the HSN/SAC tax table on the invoice. */
export function taxSummary(
  lines: { hsnSac?: string | null; gstRate: number; taxable: number; cgst: number; sgst: number; igst: number }[],
) {
  const map = new Map<string, { hsnSac: string; gstRate: number; taxable: number; cgst: number; sgst: number; igst: number }>();
  for (const l of lines) {
    const key = `${l.hsnSac ?? ""}|${l.gstRate}`;
    const row = map.get(key) ?? { hsnSac: l.hsnSac ?? "", gstRate: l.gstRate, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
    row.taxable = round2(row.taxable + l.taxable);
    row.cgst = round2(row.cgst + l.cgst);
    row.sgst = round2(row.sgst + l.sgst);
    row.igst = round2(row.igst + l.igst);
    map.set(key, row);
  }
  return [...map.values()];
}

const inr = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function formatINR(n: number, symbol = true) {
  return (symbol ? "₹" : "") + inr.format(n || 0);
}

const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number) {
  if (n < 20) return ones[n];
  return (tens[Math.floor(n / 10)] + " " + ones[n % 10]).trim();
}
function threeDigits(n: number) {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? ones[h] + " Hundred" : "", r ? twoDigits(r) : ""].filter(Boolean).join(" ");
}

/** Indian-system amount in words: "Rupees One Lakh Twenty Thousand Only". */
export function amountInWords(amount: number) {
  const rupees = Math.floor(Math.abs(amount));
  const paise = Math.round((Math.abs(amount) - rupees) * 100);
  if (rupees === 0 && paise === 0) return "Rupees Zero Only";
  const parts: string[] = [];
  let n = rupees;
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (crore) parts.push((crore > 99 ? threeDigits(crore) : twoDigits(crore)) + " Crore");
  if (lakh) parts.push(twoDigits(lakh) + " Lakh");
  if (thousand) parts.push(twoDigits(thousand) + " Thousand");
  if (n) parts.push(threeDigits(n));
  let words = "Rupees " + parts.join(" ");
  if (paise) words += " and " + twoDigits(paise) + " Paise";
  return words + " Only";
}

/** Basic GSTIN format check (15 chars: state code, PAN, entity, Z, checksum). */
export function isValidGstinFormat(gstin: string) {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin.toUpperCase());
}
