import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { DOC_TYPE_LABEL, DOC_TYPES } from "@/lib/constants";
import { addDays, isoDate, todayIST } from "@/lib/dates";
import { nextNumber } from "@/lib/invoices";
import { PageHeader } from "@/components/ui";
import { InvoiceEditor } from "../editor";
import { editorOptions } from "../editor-data";

export const metadata = { title: "New document" };

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ type?: string; client?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const docType = DOC_TYPES.includes(sp.type as never) ? sp.type! : "INVOICE";
  const { clients, items } = await editorOptions(user.orgId);
  const today = todayIST();
  const back = docType === "QUOTATION" ? "/quotations" : "/invoices";

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link href={back} className="hover:underline">
            {docType === "QUOTATION" ? "Quotations" : "Invoices"}
          </Link>
        }
        title={`New ${DOC_TYPE_LABEL[docType].toLowerCase()}`}
      />
      <InvoiceEditor
        isNew
        orgStateCode={user.org.stateCode}
        clients={clients}
        items={items}
        initial={{
          docType,
          number: await nextNumber(user.orgId, docType),
          clientId: clients.some((c) => c.id === sp.client) ? sp.client! : "",
          issueDate: isoDate(today),
          dueDate: isoDate(addDays(today, docType === "QUOTATION" ? 30 : 15)),
          placeOfSupply: "",
          reference: "",
          notes: "Thank you for your business.",
          terms: user.org.invoiceTerms ?? "",
          lines: [],
        }}
      />
    </>
  );
}
