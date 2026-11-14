"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { computeTotals, formatINR, amountInWords } from "@/lib/gst";
import { DOC_TYPE_LABEL, GST_RATES, STATES, UNITS } from "@/lib/constants";
import { buttonClass } from "@/components/ui";
import { saveInvoice, type InvoicePayload } from "./actions";

type ItemOpt = { id: string; name: string; hsnSac: string | null; unit: string; rate: number; gstRate: number; description: string | null };
type ClientOpt = { id: string; name: string; gstin: string | null; stateCode: string | null; address: string | null; city: string | null };
type Line = InvoicePayload["lines"][number] & { key: number };

let lineKey = 1;
const blankLine = (): Line => ({ key: lineKey++, description: "", hsnSac: "", qty: 1, unit: "NOS", rate: 0, discountPct: 0, gstRate: 18 });

export function InvoiceEditor({
  initial,
  clients,
  items,
  orgStateCode,
  isNew,
}: {
  initial: Omit<InvoicePayload, "lines"> & { lines: InvoicePayload["lines"] };
  clients: ClientOpt[];
  items: ItemOpt[];
  orgStateCode: string | null;
  isNew: boolean;
}) {
  const [doc, setDoc] = useState(initial);
  const [lines, setLines] = useState<Line[]>(initial.lines.length ? initial.lines.map((l) => ({ ...l, key: lineKey++ })) : [blankLine()]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const client = clients.find((c) => c.id === doc.clientId);
  const pos = doc.placeOfSupply || client?.stateCode || orgStateCode || "";
  const interState = !!pos && !!orgStateCode && pos !== orgStateCode;
  const totals = useMemo(() => computeTotals(lines, interState), [lines, interState]);

  const set = <K extends keyof typeof doc>(k: K, v: (typeof doc)[K]) => setDoc((d) => ({ ...d, [k]: v }));
  const setLine = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  function pickItem(key: number, itemId: string) {
    const it = items.find((i) => i.id === itemId);
    if (!it) return setLine(key, { itemId: undefined });
    setLine(key, { itemId: it.id, description: it.name, hsnSac: it.hsnSac ?? "", unit: it.unit, rate: it.rate, gstRate: it.gstRate });
  }

  function submit(asDraft: boolean) {
    setError(null);
    startTransition(async () => {
      const res = await saveInvoice({ ...doc, placeOfSupply: pos, lines: lines.map(({ key: _k, ...l }) => l) }, asDraft);
      if (res?.error) setError(res.error);
    });
  }

  const num = (v: string) => (v === "" ? 0 : parseFloat(v));

  return (
    <div className="space-y-5">
      {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="grid gap-5 rounded-lg border border-line bg-white p-5 shadow-xs md:grid-cols-2">
        <div className="space-y-3">
          <label className="block">
            <span className="label">Bill to</span>
            <select value={doc.clientId} onChange={(e) => setDoc((d) => ({ ...d, clientId: e.target.value, placeOfSupply: "" }))} className="field">
              <option value="">Select a client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {client && (
            <div className="rounded-md bg-canvas px-3 py-2 text-xs text-muted">
              {client.address && <p>{client.address}</p>}
              {client.city && <p>{client.city}</p>}
              <p className="mt-1">
                GSTIN: <span className="font-mono text-ink">{client.gstin ?? "Unregistered"}</span>
              </p>
            </div>
          )}
          <label className="block">
            <span className="label">Place of supply</span>
            <select value={pos} onChange={(e) => set("placeOfSupply", e.target.value)} className="field">
              <option value="">—</option>
              {STATES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.code} - {s.name}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[11px] text-muted">{interState ? "Inter-state supply → IGST" : "Intra-state supply → CGST + SGST"}</span>
          </label>
        </div>
        <div className="grid grid-cols-2 content-start gap-3">
          <label className="block">
            <span className="label">Document</span>
            <input value={DOC_TYPE_LABEL[doc.docType]} disabled className="field" />
          </label>
          <label className="block">
            <span className="label">Number</span>
            <input value={doc.number} onChange={(e) => set("number", e.target.value)} className="field font-mono" />
          </label>
          <label className="block">
            <span className="label">{doc.docType === "QUOTATION" ? "Quote date" : "Invoice date"}</span>
            <input type="date" value={doc.issueDate} onChange={(e) => set("issueDate", e.target.value)} className="field" />
          </label>
          <label className="block">
            <span className="label">{doc.docType === "QUOTATION" ? "Valid until" : "Due date"}</span>
            <input type="date" value={doc.dueDate ?? ""} onChange={(e) => set("dueDate", e.target.value)} className="field" />
          </label>
          <label className="col-span-2 block">
            <span className="label">{doc.docType === "CREDIT_NOTE" ? "Original invoice / reason" : "Reference (PO number etc.)"}</span>
            <input value={doc.reference ?? ""} onChange={(e) => set("reference", e.target.value)} className="field" />
          </label>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-white shadow-xs">
        <table className="w-full min-w-[920px] text-sm">
          <thead>
            <tr className="bg-canvas text-left text-xs text-muted">
              <th className="w-8 px-3 py-2">#</th>
              <th className="px-2 py-2">Item / description</th>
              <th className="w-24 px-2 py-2">HSN/SAC</th>
              <th className="w-20 px-2 py-2 text-right">Qty</th>
              <th className="w-24 px-2 py-2">Unit</th>
              <th className="w-28 px-2 py-2 text-right">Rate (₹)</th>
              <th className="w-20 px-2 py-2 text-right">Disc %</th>
              <th className="w-24 px-2 py-2">GST %</th>
              <th className="w-32 px-3 py-2 text-right">Amount (₹)</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, idx) => {
              const c = totals.lines[idx];
              return (
                <tr key={l.key} className="border-t border-line align-top">
                  <td className="px-3 py-2 text-xs text-muted">{idx + 1}</td>
                  <td className="px-2 py-2">
                    <select value={l.itemId ?? ""} onChange={(e) => pickItem(l.key, e.target.value)} className="field mb-1 h-8 py-1 text-xs">
                      <option value="">— Pick from items or type below —</option>
                      {items.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                    </select>
                    <input value={l.description} onChange={(e) => setLine(l.key, { description: e.target.value })} placeholder="Description" className="field h-8 py-1" />
                  </td>
                  <td className="px-2 py-2">
                    <input value={l.hsnSac ?? ""} onChange={(e) => setLine(l.key, { hsnSac: e.target.value })} className="field h-8 py-1 font-mono text-xs" />
                  </td>
                  <td className="px-2 py-2">
                    <input type="number" min={0} step="any" value={l.qty} onChange={(e) => setLine(l.key, { qty: num(e.target.value) })} className="field h-8 py-1 text-right" />
                  </td>
                  <td className="px-2 py-2">
                    <select value={l.unit} onChange={(e) => setLine(l.key, { unit: e.target.value })} className="field h-8 py-1 text-xs">
                      {UNITS.map((u) => (
                        <option key={u}>{u}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <input type="number" min={0} step="any" value={l.rate} onChange={(e) => setLine(l.key, { rate: num(e.target.value) })} className="field h-8 py-1 text-right" />
                  </td>
                  <td className="px-2 py-2">
                    <input type="number" min={0} max={100} step="any" value={l.discountPct} onChange={(e) => setLine(l.key, { discountPct: num(e.target.value) })} className="field h-8 py-1 text-right" />
                  </td>
                  <td className="px-2 py-2">
                    <select value={l.gstRate} onChange={(e) => setLine(l.key, { gstRate: parseFloat(e.target.value) })} className="field h-8 py-1 text-xs">
                      {GST_RATES.map((r) => (
                        <option key={r} value={r}>
                          {r}%
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="font-medium tabular-nums">{formatINR(c?.amount ?? 0, false)}</div>
                    <div className="text-[10px] text-muted tabular-nums">Taxable {formatINR(c?.taxable ?? 0, false)}</div>
                  </td>
                  <td className="py-2 pr-2">
                    <button
                      type="button"
                      onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : [blankLine()]))}
                      className="rounded p-1.5 text-muted hover:bg-red-50 hover:text-red-700"
                      title="Remove line"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="border-t border-line px-3 py-2">
          <button type="button" onClick={() => setLines((ls) => [...ls, blankLine()])} className={buttonClass("ghost", "sm")}>
            <Plus className="h-3.5 w-3.5" /> Add line
          </button>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-[1fr_360px]">
        <div className="space-y-3 rounded-lg border border-line bg-white p-5 shadow-xs">
          <label className="block">
            <span className="label">Notes (shown on the document)</span>
            <textarea rows={2} value={doc.notes ?? ""} onChange={(e) => set("notes", e.target.value)} className="field" />
          </label>
          <label className="block">
            <span className="label">Terms & conditions</span>
            <textarea rows={4} value={doc.terms ?? ""} onChange={(e) => set("terms", e.target.value)} className="field" />
          </label>
        </div>
        <div className="space-y-2 rounded-lg border border-line bg-white p-5 text-sm shadow-xs">
          <Row label="Taxable amount" value={totals.subtotal} />
          {interState ? (
            <Row label="IGST" value={totals.igst} />
          ) : (
            <>
              <Row label="CGST" value={totals.cgst} />
              <Row label="SGST" value={totals.sgst} />
            </>
          )}
          <Row label="Round off" value={totals.roundOff} />
          <div className="flex justify-between border-t border-line pt-2 text-base font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatINR(totals.total)}</span>
          </div>
          <p className="text-xs text-muted">{amountInWords(totals.total)}</p>
          <div className="flex gap-2 pt-3">
            <button type="button" disabled={pending} onClick={() => submit(true)} className={buttonClass("secondary", "md", "flex-1")}>
              {isNew ? "Save as draft" : "Save"}
            </button>
            <button type="button" disabled={pending} onClick={() => submit(false)} className={buttonClass("primary", "md", "flex-1")}>
              {pending ? "Saving…" : isNew ? "Save & finalise" : "Save & finalise"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-muted">
      <span>{label}</span>
      <span className="tabular-nums text-ink">{formatINR(value)}</span>
    </div>
  );
}
