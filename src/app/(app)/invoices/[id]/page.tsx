import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Copy, FileMinus, FileCheck2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { DOC_TYPE_LABEL, PAYMENT_MODES } from "@/lib/constants";
import { formatDate, isoDate, todayIST } from "@/lib/dates";
import { formatINR, round2 } from "@/lib/gst";
import { Card, CardHeader, Field, buttonClass } from "@/components/ui";
import { ActionForm, SubmitButton, ConfirmButton } from "@/components/form-bits";
import { InvoiceDocument } from "../document";
import { InvoiceStatusBadge } from "../status";
import { PrintButton } from "./print-button";
import { recordPayment, deletePayment, setInvoiceStatus, deleteDraft, convertDocument } from "../actions";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const inv = await db.invoice.findUnique({ where: { id: (await params).id }, select: { number: true } });
  return { title: inv?.number ?? "Document" };
}

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const invoice = await db.invoice.findFirst({
    where: { id, orgId: user.orgId },
    include: { client: true, lines: { orderBy: { position: "asc" } }, payments: { orderBy: { date: "desc" } } },
  });
  if (!invoice) notFound();

  const isInvoice = invoice.docType === "INVOICE";
  const balance = round2(invoice.total - invoice.amountPaid);
  const editable = invoice.amountPaid === 0 && invoice.status !== "CANCELLED";
  const back = invoice.docType === "QUOTATION" ? "/quotations" : "/invoices";

  return (
    <>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-1 text-xs text-muted">
            <Link href={back} className="hover:underline">
              {invoice.docType === "QUOTATION" ? "Quotations" : "Invoices"}
            </Link>{" "}
            / {invoice.number}
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">
              {DOC_TYPE_LABEL[invoice.docType]} {invoice.number}
            </h1>
            <InvoiceStatusBadge invoice={invoice} />
          </div>
          <p className="text-sm text-muted">
            <Link href={`/clients/${invoice.clientId}`} className="hover:underline">
              {invoice.client.name}
            </Link>{" "}
            · {formatINR(invoice.total)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {editable && (
            <Link href={`/invoices/${invoice.id}/edit`} className={buttonClass("secondary")}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Link>
          )}
          <PrintButton />
        </div>
      </div>

      <div className="print-block grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0 overflow-x-auto">
          <InvoiceDocument doc={invoice} org={user.org} client={invoice.client} />
        </div>

        <div className="no-print space-y-4 self-start">
          {invoice.status === "DRAFT" && (
            <Card className="p-4">
              <p className="mb-3 text-sm text-muted">This is a draft. Finalise it when it&apos;s ready to send to the client.</p>
              <div className="flex gap-2">
                <form action={setInvoiceStatus.bind(null, invoice.id, "SENT")} className="flex-1">
                  <SubmitButton className="w-full">Finalise</SubmitButton>
                </form>
                <form action={deleteDraft.bind(null, invoice.id)}>
                  <ConfirmButton message="Delete this draft?" className={buttonClass("danger")}>
                    Delete
                  </ConfirmButton>
                </form>
              </div>
            </Card>
          )}

          {isInvoice && invoice.status !== "DRAFT" && invoice.status !== "CANCELLED" && (
            <Card>
              <CardHeader title="Payments" subtitle={`Received ${formatINR(invoice.amountPaid)} · Balance ${formatINR(balance)}`} />
              {invoice.payments.length > 0 && (
                <ul className="divide-y divide-line">
                  {invoice.payments.map((p) => (
                    <li key={p.id} className="flex items-center gap-2 px-4 py-2 text-sm">
                      <div className="flex-1">
                        <div className="font-medium tabular-nums">{formatINR(p.amount)}</div>
                        <div className="text-xs text-muted">
                          {formatDate(p.date)} · {PAYMENT_MODES[p.mode]}
                          {p.reference && ` · ${p.reference}`}
                        </div>
                      </div>
                      <form action={deletePayment.bind(null, p.id)}>
                        <ConfirmButton message="Remove this payment?" className="text-xs text-muted hover:text-red-700">
                          Remove
                        </ConfirmButton>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
              {balance > 0 && (
                <ActionForm action={recordPayment.bind(null, invoice.id)} resetOnSuccess className="space-y-2 border-t border-line p-4">
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Amount (₹)">
                      <input name="amount" type="number" step="0.01" min="0.01" max={balance} defaultValue={balance} className="field" />
                    </Field>
                    <Field label="Date">
                      <input name="date" type="date" defaultValue={isoDate(todayIST())} className="field" />
                    </Field>
                    <Field label="Mode">
                      <select name="mode" className="field">
                        {Object.entries(PAYMENT_MODES).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Reference">
                      <input name="reference" placeholder="UTR / cheque no." className="field" />
                    </Field>
                  </div>
                  <SubmitButton className="w-full">Record payment</SubmitButton>
                </ActionForm>
              )}
            </Card>
          )}

          {invoice.docType === "QUOTATION" && invoice.status !== "DRAFT" && invoice.status !== "CANCELLED" && (
            <Card className="space-y-2 p-4">
              <p className="text-sm font-medium">Client response</p>
              <div className="flex gap-2">
                <form action={setInvoiceStatus.bind(null, invoice.id, "ACCEPTED")} className="flex-1">
                  <SubmitButton variant="secondary" size="sm" className="w-full" disabled={invoice.status === "ACCEPTED"}>
                    Accepted
                  </SubmitButton>
                </form>
                <form action={setInvoiceStatus.bind(null, invoice.id, "DECLINED")} className="flex-1">
                  <SubmitButton variant="secondary" size="sm" className="w-full" disabled={invoice.status === "DECLINED"}>
                    Declined
                  </SubmitButton>
                </form>
              </div>
            </Card>
          )}

          <Card className="divide-y divide-line">
            {(invoice.docType === "QUOTATION" || invoice.docType === "PROFORMA") && (
              <ActionRow action={convertDocument.bind(null, invoice.id, "INVOICE")} icon={<FileCheck2 className="h-4 w-4" />} label="Convert to tax invoice" />
            )}
            {isInvoice && invoice.status !== "DRAFT" && (
              <ActionRow action={convertDocument.bind(null, invoice.id, "CREDIT_NOTE")} icon={<FileMinus className="h-4 w-4" />} label="Issue credit note" />
            )}
            <ActionRow action={convertDocument.bind(null, invoice.id, invoice.docType)} icon={<Copy className="h-4 w-4" />} label="Duplicate" />
            {invoice.status !== "DRAFT" && invoice.status !== "CANCELLED" && invoice.amountPaid === 0 && (
              <form action={setInvoiceStatus.bind(null, invoice.id, "CANCELLED")}>
                <ConfirmButton message={`Cancel ${invoice.number}? It stays in the records as cancelled.`} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-red-700 hover:bg-red-50">
                  Cancel document
                </ConfirmButton>
              </form>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function ActionRow({ action, icon, label }: { action: () => Promise<void>; icon: React.ReactNode; label: string }) {
  return (
    <form action={action}>
      <button className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-canvas">
        <span className="text-muted">{icon}</span> {label}
      </button>
    </form>
  );
}
