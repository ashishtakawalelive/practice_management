import { requireUser } from "@/lib/auth";
import { DocList } from "./doc-list";

export const metadata = { title: "Invoices" };

const TYPES = ["INVOICE", "PROFORMA", "CREDIT_NOTE"];

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ type?: string; filter?: string; q?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const type = sp.type && TYPES.includes(sp.type) ? sp.type : "INVOICE";
  return <DocList orgId={user.orgId} basePath="/invoices" docTypes={TYPES} activeType={type} filter={sp.filter} q={sp.q} />;
}
