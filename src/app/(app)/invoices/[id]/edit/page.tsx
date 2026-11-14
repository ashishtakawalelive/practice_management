import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { DOC_TYPE_LABEL } from "@/lib/constants";
import { isoDate } from "@/lib/dates";
import { Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { InvoiceEditor } from "../../editor";
import { editorOptions } from "../../editor-data";

export const metadata = { title: "Edit document" };

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const invoice = await db.invoice.findFirst({ where: { id, orgId: user.orgId }, include: { lines: { orderBy: { position: "asc" } } } });
  if (!invoice) notFound();

  if (invoice.amountPaid > 0 || invoice.status === "CANCELLED")
    return (
      <Card>
        <EmptyState title="This document can't be edited" action={<LinkButton href={`/invoices/${id}`}>Back</LinkButton>}>
          {invoice.status === "CANCELLED" ? "It has been cancelled." : "Payments have been recorded against it. Remove them first, or issue a credit note."}
        </EmptyState>
      </Card>
    );

  const { clients, items } = await editorOptions(user.orgId);
  return (
    <>
      <PageHeader
        breadcrumb={
          <Link href={`/invoices/${id}`} className="hover:underline">
            {invoice.number}
          </Link>
        }
        title={`Edit ${DOC_TYPE_LABEL[invoice.docType].toLowerCase()}`}
      />
      <InvoiceEditor
        isNew={false}
        orgStateCode={user.org.stateCode}
        clients={clients}
        items={items}
        initial={{
          id: invoice.id,
          docType: invoice.docType,
          number: invoice.number,
          clientId: invoice.clientId,
          issueDate: isoDate(invoice.issueDate),
          dueDate: isoDate(invoice.dueDate),
          placeOfSupply: invoice.placeOfSupply ?? "",
          reference: invoice.reference ?? "",
          notes: invoice.notes ?? "",
          terms: invoice.terms ?? "",
          lines: invoice.lines.map((l) => ({
            itemId: l.itemId ?? undefined,
            description: l.description,
            hsnSac: l.hsnSac ?? "",
            qty: l.qty,
            unit: l.unit,
            rate: l.rate,
            discountPct: l.discountPct,
            gstRate: l.gstRate,
          })),
        }}
      />
    </>
  );
}
