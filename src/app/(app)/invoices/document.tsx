import QRCode from "qrcode";
import { DOC_TYPE_LABEL, stateName } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { amountInWords, formatINR, taxSummary } from "@/lib/gst";
import { LogoMark } from "@/components/logo";

type Org = {
  name: string;
  legalName: string | null;
  gstin: string | null;
  pan: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  stateCode: string | null;
  pincode: string | null;
  phone: string | null;
  email: string | null;
  bankName: string | null;
  bankAccountNo: string | null;
  bankIfsc: string | null;
  bankBranch: string | null;
  upiId: string | null;
};
type Client = {
  name: string;
  gstin: string | null;
  pan: string | null;
  address: string | null;
  city: string | null;
  stateCode: string | null;
  pincode: string | null;
  phone: string | null;
  email: string | null;
};
type Line = {
  id: string;
  description: string;
  hsnSac: string | null;
  qty: number;
  unit: string;
  rate: number;
  discountPct: number;
  gstRate: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  amount: number;
};
type Doc = {
  docType: string;
  number: string;
  issueDate: Date;
  dueDate: Date | null;
  placeOfSupply: string | null;
  interState: boolean;
  reference: string | null;
  notes: string | null;
  terms: string | null;
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  roundOff: number;
  total: number;
  amountPaid: number;
  status: string;
  lines: Line[];
};

const money = (n: number) => formatINR(n, false);

/** The printable GST document (tax invoice, quotation, proforma or credit note). A4 portrait. */
export async function InvoiceDocument({ doc, org, client }: { doc: Doc; org: Org; client: Client }) {
  const balance = Math.max(0, doc.total - doc.amountPaid);
  const showUpi = !!org.upiId && doc.docType === "INVOICE" && balance > 0 && doc.status !== "CANCELLED";
  const upiQr = showUpi
    ? await QRCode.toString(
        `upi://pay?pa=${encodeURIComponent(org.upiId!)}&pn=${encodeURIComponent(org.name)}&am=${balance.toFixed(2)}&cu=INR&tn=${encodeURIComponent(doc.number)}`,
        { type: "svg", margin: 0, width: 96 },
      )
    : null;
  const summary = taxSummary(doc.lines);
  const isQuote = doc.docType === "QUOTATION";
  const anyDiscount = doc.lines.some((l) => l.discountPct > 0);

  return (
    <div className="print-area mx-auto max-w-[210mm] bg-white p-8 text-[12px] leading-snug text-slate-800 shadow-sm ring-1 ring-line">
      {doc.status === "CANCELLED" && (
        <div className="mb-3 rounded border border-red-300 bg-red-50 py-1 text-center text-xs font-semibold tracking-widest text-red-700 uppercase">Cancelled</div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-6 border-b-2 border-brand-700 pb-4">
        <div className="flex gap-3">
          <LogoMark size={44} />
          <div>
            <h1 className="text-lg font-bold text-ink">{org.legalName || org.name}</h1>
            {org.address && <p className="max-w-xs text-slate-600">{org.address}</p>}
            <p className="text-slate-600">{[org.city, org.state, org.pincode].filter(Boolean).join(", ")}</p>
            <p className="mt-1 text-slate-600">
              {org.gstin && (
                <>
                  <span className="font-semibold text-ink">GSTIN:</span> {org.gstin}
                </>
              )}
              {org.pan && (
                <>
                  {" "}
                  · <span className="font-semibold text-ink">PAN:</span> {org.pan}
                </>
              )}
            </p>
            <p className="text-slate-600">{[org.phone, org.email].filter(Boolean).join(" · ")}</p>
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-xl font-bold tracking-wide text-brand-700 uppercase">{DOC_TYPE_LABEL[doc.docType]}</h2>
          {doc.docType === "INVOICE" && <p className="text-[10px] tracking-wider text-slate-500 uppercase">Original for recipient</p>}
        </div>
      </div>

      {/* Meta + parties */}
      <div className="grid grid-cols-2 border-b border-slate-200">
        <div className="border-r border-slate-200 py-3 pr-4">
          <p className="mb-1 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">{isQuote ? "Quotation for" : "Bill to"}</p>
          <p className="text-sm font-semibold text-ink">{client.name}</p>
          {client.address && <p className="text-slate-600">{client.address}</p>}
          <p className="text-slate-600">{[client.city, stateName(client.stateCode), client.pincode].filter(Boolean).join(", ")}</p>
          {client.gstin && (
            <p className="mt-1">
              <span className="font-semibold">GSTIN:</span> {client.gstin}
            </p>
          )}
          {!client.gstin && client.pan && (
            <p className="mt-1">
              <span className="font-semibold">PAN:</span> {client.pan}
            </p>
          )}
          {client.phone && <p className="text-slate-600">Ph: {client.phone}</p>}
        </div>
        <div className="py-3 pl-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5">
            <dt className="text-slate-500">{isQuote ? "Quotation #" : doc.docType === "CREDIT_NOTE" ? "Credit note #" : "Invoice #"}</dt>
            <dd className="font-semibold text-ink">{doc.number}</dd>
            <dt className="text-slate-500">Date</dt>
            <dd>{formatDate(doc.issueDate)}</dd>
            {doc.dueDate && (
              <>
                <dt className="text-slate-500">{isQuote ? "Valid until" : "Due date"}</dt>
                <dd>{formatDate(doc.dueDate)}</dd>
              </>
            )}
            <dt className="text-slate-500">Place of supply</dt>
            <dd>{doc.placeOfSupply ? `${doc.placeOfSupply} - ${stateName(doc.placeOfSupply)}` : "—"}</dd>
            {doc.reference && (
              <>
                <dt className="text-slate-500">Reference</dt>
                <dd>{doc.reference}</dd>
              </>
            )}
          </dl>
        </div>
      </div>

      {/* Lines */}
      <table className="mt-4 w-full border-collapse">
        <thead>
          <tr className="bg-brand-700 text-left text-[10px] tracking-wide text-white uppercase">
            <th className="px-2 py-1.5 font-semibold">#</th>
            <th className="px-2 py-1.5 font-semibold">Item</th>
            <th className="px-2 py-1.5 font-semibold">HSN/SAC</th>
            <th className="px-2 py-1.5 text-right font-semibold">Qty</th>
            <th className="px-2 py-1.5 text-right font-semibold">Rate</th>
            {anyDiscount && <th className="px-2 py-1.5 text-right font-semibold">Disc</th>}
            <th className="px-2 py-1.5 text-right font-semibold">Taxable value</th>
            <th className="px-2 py-1.5 text-right font-semibold">GST</th>
            <th className="px-2 py-1.5 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {doc.lines.map((l, i) => (
            <tr key={l.id} className="border-b border-slate-200 align-top">
              <td className="px-2 py-1.5 text-slate-500">{i + 1}</td>
              <td className="px-2 py-1.5 font-medium text-ink">{l.description}</td>
              <td className="px-2 py-1.5">{l.hsnSac}</td>
              <td className="px-2 py-1.5 text-right whitespace-nowrap tabular-nums">
                {l.qty} {l.unit}
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums">{money(l.rate)}</td>
              {anyDiscount && <td className="px-2 py-1.5 text-right tabular-nums">{l.discountPct ? `${l.discountPct}%` : "—"}</td>}
              <td className="px-2 py-1.5 text-right tabular-nums">{money(l.taxable)}</td>
              <td className="px-2 py-1.5 text-right whitespace-nowrap tabular-nums">
                {money(l.cgst + l.sgst + l.igst)}
                <div className="text-[10px] text-slate-500">({l.gstRate}%)</div>
              </td>
              <td className="px-2 py-1.5 text-right font-medium tabular-nums">{money(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="mt-3 flex justify-between gap-6">
        <div className="flex-1">
          <p className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">Amount in words</p>
          <p className="font-medium text-ink">{amountInWords(doc.total)}</p>
        </div>
        <table className="w-64">
          <tbody className="tabular-nums">
            <TotalRow label="Taxable amount" value={doc.subtotal} />
            {doc.interState ? (
              <TotalRow label="IGST" value={doc.igst} />
            ) : (
              <>
                <TotalRow label="CGST" value={doc.cgst} />
                <TotalRow label="SGST" value={doc.sgst} />
              </>
            )}
            {doc.roundOff !== 0 && <TotalRow label="Round off" value={doc.roundOff} />}
            <tr className="border-t-2 border-brand-700 text-sm font-bold text-ink">
              <td className="py-1.5">Total</td>
              <td className="py-1.5 text-right">₹{money(doc.total)}</td>
            </tr>
            {doc.docType === "INVOICE" && doc.amountPaid > 0 && (
              <>
                <TotalRow label="Amount received" value={-doc.amountPaid} />
                <tr className="font-semibold text-ink">
                  <td className="py-0.5">Balance due</td>
                  <td className="py-0.5 text-right">₹{money(balance)}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* HSN summary */}
      <table className="mt-4 w-full border-collapse text-[10.5px]">
        <thead>
          <tr className="bg-slate-100 text-slate-600">
            <th className="border border-slate-200 px-2 py-1 text-left font-semibold">HSN/SAC</th>
            <th className="border border-slate-200 px-2 py-1 text-right font-semibold">Taxable value</th>
            {doc.interState ? (
              <th className="border border-slate-200 px-2 py-1 text-right font-semibold">IGST</th>
            ) : (
              <>
                <th className="border border-slate-200 px-2 py-1 text-right font-semibold">CGST</th>
                <th className="border border-slate-200 px-2 py-1 text-right font-semibold">SGST</th>
              </>
            )}
            <th className="border border-slate-200 px-2 py-1 text-right font-semibold">Total tax</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {summary.map((s) => (
            <tr key={`${s.hsnSac}-${s.gstRate}`}>
              <td className="border border-slate-200 px-2 py-1">{s.hsnSac || "—"}</td>
              <td className="border border-slate-200 px-2 py-1 text-right">{money(s.taxable)}</td>
              {doc.interState ? (
                <td className="border border-slate-200 px-2 py-1 text-right">
                  {money(s.igst)} <span className="text-slate-500">@{s.gstRate}%</span>
                </td>
              ) : (
                <>
                  <td className="border border-slate-200 px-2 py-1 text-right">
                    {money(s.cgst)} <span className="text-slate-500">@{s.gstRate / 2}%</span>
                  </td>
                  <td className="border border-slate-200 px-2 py-1 text-right">
                    {money(s.sgst)} <span className="text-slate-500">@{s.gstRate / 2}%</span>
                  </td>
                </>
              )}
              <td className="border border-slate-200 px-2 py-1 text-right">{money(s.cgst + s.sgst + s.igst)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Bank, notes, signature */}
      <div className="mt-5 grid grid-cols-[1fr_auto] gap-6 border-t border-slate-200 pt-4">
        <div className="space-y-3">
          {doc.docType !== "CREDIT_NOTE" && (org.bankAccountNo || org.upiId) && (
            <div className="flex gap-4">
              {upiQr && (
                <div className="text-center">
                  <div className="h-24 w-24" dangerouslySetInnerHTML={{ __html: upiQr }} />
                  <p className="mt-1 text-[9px] text-slate-500">Scan to pay via UPI</p>
                </div>
              )}
              <div>
                <p className="mb-1 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">Bank details</p>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3">
                  {org.bankName && (
                    <>
                      <dt className="text-slate-500">Bank</dt>
                      <dd>{org.bankName}</dd>
                    </>
                  )}
                  {org.bankAccountNo && (
                    <>
                      <dt className="text-slate-500">A/c no.</dt>
                      <dd className="font-medium">{org.bankAccountNo}</dd>
                    </>
                  )}
                  {org.bankIfsc && (
                    <>
                      <dt className="text-slate-500">IFSC</dt>
                      <dd>{org.bankIfsc}</dd>
                    </>
                  )}
                  {org.bankBranch && (
                    <>
                      <dt className="text-slate-500">Branch</dt>
                      <dd>{org.bankBranch}</dd>
                    </>
                  )}
                  {org.upiId && (
                    <>
                      <dt className="text-slate-500">UPI</dt>
                      <dd>{org.upiId}</dd>
                    </>
                  )}
                </dl>
              </div>
            </div>
          )}
          {doc.notes && (
            <div>
              <p className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">Notes</p>
              <p className="whitespace-pre-wrap">{doc.notes}</p>
            </div>
          )}
          {doc.terms && (
            <div>
              <p className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">Terms & conditions</p>
              <p className="whitespace-pre-wrap text-slate-600">{doc.terms}</p>
            </div>
          )}
        </div>
        <div className="flex w-48 flex-col justify-between text-right">
          <p className="font-semibold text-ink">For {org.legalName || org.name}</p>
          <div className="mt-16 border-t border-slate-300 pt-1 text-slate-500">Authorised signatory</div>
        </div>
      </div>
      <p className="mt-6 text-center text-[9px] text-slate-400">This is a computer-generated document.</p>
    </div>
  );
}

function TotalRow({ label, value }: { label: string; value: number }) {
  return (
    <tr className="text-slate-600">
      <td className="py-0.5">{label}</td>
      <td className="py-0.5 text-right text-ink">{value < 0 ? `−${money(-value)}` : money(value)}</td>
    </tr>
  );
}
