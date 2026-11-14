import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { DOC_TYPE_LABEL, DOC_TYPE_PLURAL } from "@/lib/constants";
import { formatDate, todayIST } from "@/lib/dates";
import { formatINR } from "@/lib/gst";
import { Card, EmptyState, PageHeader, Stat, Table, Td, Th, buttonClass, cn } from "@/components/ui";
import { InvoiceStatusBadge } from "./status";

const FILTERS: Record<string, { label: string; where: object }> = {
  all: { label: "All", where: {} },
  draft: { label: "Drafts", where: { status: "DRAFT" } },
  unpaid: { label: "Unpaid", where: { status: { in: ["SENT", "PARTIAL"] } } },
  overdue: { label: "Overdue", where: { status: { in: ["SENT", "PARTIAL"] } } },
  paid: { label: "Paid", where: { status: "PAID" } },
  cancelled: { label: "Cancelled", where: { status: "CANCELLED" } },
};
const QUOTE_FILTERS: Record<string, { label: string; where: object }> = {
  all: { label: "All", where: {} },
  draft: { label: "Drafts", where: { status: "DRAFT" } },
  open: { label: "Sent", where: { status: "SENT" } },
  accepted: { label: "Accepted", where: { status: "ACCEPTED" } },
  declined: { label: "Declined", where: { status: "DECLINED" } },
};

/** Shared list page for invoices, proforma, credit notes and quotations. */
export async function DocList({
  orgId,
  basePath,
  docTypes,
  activeType,
  filter,
  q,
}: {
  orgId: string;
  basePath: string;
  docTypes: string[];
  activeType: string;
  filter?: string;
  q?: string;
}) {
  const isQuote = activeType === "QUOTATION";
  const filters = isQuote ? QUOTE_FILTERS : FILTERS;
  const f = filter && filters[filter] ? filter : "all";
  const today = todayIST();

  const [docs, stats] = await Promise.all([
    db.invoice.findMany({
      where: {
        orgId,
        docType: activeType,
        ...filters[f].where,
        ...(f === "overdue" ? { dueDate: { lt: today } } : {}),
        ...(q ? { OR: [{ number: { contains: q, mode: "insensitive" as const } }, { client: { name: { contains: q, mode: "insensitive" as const } } }] } : {}),
      },
      include: { client: true },
      orderBy: [{ issueDate: "desc" }, { number: "desc" }],
    }),
    db.invoice.findMany({
      where: { orgId, docType: activeType, status: { notIn: ["DRAFT", "CANCELLED"] } },
      select: { total: true, amountPaid: true, dueDate: true, status: true, issueDate: true },
    }),
  ]);

  const fyStart = new Date(Date.UTC(today.getUTCMonth() >= 3 ? today.getUTCFullYear() : today.getUTCFullYear() - 1, 3, 1));
  const thisFy = stats.filter((s) => s.issueDate >= fyStart);
  const outstanding = stats.reduce((s, i) => s + (i.total - i.amountPaid), 0);
  const overdue = stats.filter((i) => i.dueDate && i.dueDate < today && i.total - i.amountPaid > 0.005).reduce((s, i) => s + (i.total - i.amountPaid), 0);

  const href = (params: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ type: activeType === docTypes[0] ? undefined : activeType, filter: f === "all" ? undefined : f, q, ...params }).filter(([, v]) => v) as [string, string][]);
    const s = p.toString();
    return s ? `${basePath}?${s}` : basePath;
  };

  return (
    <>
      <PageHeader
        title={isQuote ? "Quotations" : "Invoices"}
        subtitle={isQuote ? "Estimates and quotations for clients. Convert accepted quotes into invoices in one click." : "GST tax invoices, proforma invoices and credit notes."}
        actions={
          <Link href={`/invoices/new?type=${activeType}`} className={buttonClass("primary")}>
            <Plus className="h-4 w-4" /> New {DOC_TYPE_LABEL[activeType].toLowerCase()}
          </Link>
        }
      />

      {activeType === "INVOICE" && (
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Billed this FY" value={formatINR(thisFy.reduce((s, i) => s + i.total, 0))} hint={`${thisFy.length} invoices`} />
          <Stat label="Received this FY" value={formatINR(thisFy.reduce((s, i) => s + i.amountPaid, 0))} />
          <Stat label="Outstanding" value={formatINR(outstanding)} tone={outstanding > 0 ? "amber" : undefined} href={href({ filter: "unpaid" })} />
          <Stat label="Overdue" value={formatINR(overdue)} tone={overdue > 0 ? "red" : undefined} href={href({ filter: "overdue" })} />
        </div>
      )}

      {docTypes.length > 1 && (
        <div className="mb-3 flex gap-1 border-b border-line">
          {docTypes.map((t) => (
            <Link
              key={t}
              href={t === docTypes[0] ? basePath : `${basePath}?type=${t}`}
              className={cn("-mb-px border-b-2 px-3 py-2 text-sm", t === activeType ? "border-brand-600 font-medium text-brand-800" : "border-transparent text-muted hover:text-ink")}
            >
              {DOC_TYPE_PLURAL[t]}
            </Link>
          ))}
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {Object.entries(filters).map(([k, v]) => (
          <Link
            key={k}
            href={href({ filter: k === "all" ? undefined : k })}
            className={cn("rounded-full px-3 py-1 text-xs font-medium", f === k ? "bg-ink text-white" : "bg-white text-muted ring-1 ring-line hover:text-ink")}
          >
            {v.label}
          </Link>
        ))}
        <form action={basePath} className="ml-auto">
          {activeType !== docTypes[0] && <input type="hidden" name="type" value={activeType} />}
          <input name="q" defaultValue={q} placeholder="Search number or client" className="field h-8 w-56 py-1 text-xs" />
        </form>
      </div>

      <Card>
        {docs.length === 0 ? (
          <EmptyState
            title={`No ${DOC_TYPE_PLURAL[activeType].toLowerCase()} here`}
            action={
              <Link href={`/invoices/new?type=${activeType}`} className={buttonClass("secondary", "sm")}>
                Create one
              </Link>
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Number</Th>
                <Th>Client</Th>
                <Th>Date</Th>
                <Th>{isQuote ? "Valid until" : "Due"}</Th>
                <Th>Status</Th>
                <Th className="text-right">Amount</Th>
                {activeType === "INVOICE" && <Th className="text-right">Balance</Th>}
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id} className="hover:bg-canvas/50">
                  <Td>
                    <Link href={`/invoices/${d.id}`} className="font-mono text-xs font-semibold hover:text-brand-700 hover:underline">
                      {d.number}
                    </Link>
                  </Td>
                  <Td>
                    <Link href={`/invoices/${d.id}`} className="hover:text-brand-700">
                      {d.client.name}
                    </Link>
                  </Td>
                  <Td className="text-sm whitespace-nowrap">{formatDate(d.issueDate)}</Td>
                  <Td className="text-sm whitespace-nowrap text-muted">{formatDate(d.dueDate)}</Td>
                  <Td>
                    <InvoiceStatusBadge invoice={d} />
                  </Td>
                  <Td className="text-right font-medium tabular-nums">{formatINR(d.total)}</Td>
                  {activeType === "INVOICE" && (
                    <Td className="text-right tabular-nums text-muted">{d.status === "CANCELLED" || d.status === "DRAFT" ? "—" : formatINR(d.total - d.amountPaid)}</Td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
