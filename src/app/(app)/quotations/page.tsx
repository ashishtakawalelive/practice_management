import { requireUser } from "@/lib/auth";
import { DocList } from "../invoices/doc-list";

export const metadata = { title: "Quotations" };

export default async function QuotationsPage({ searchParams }: { searchParams: Promise<{ filter?: string; q?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  return <DocList orgId={user.orgId} basePath="/quotations" docTypes={["QUOTATION"]} activeType="QUOTATION" filter={sp.filter} q={sp.q} />;
}
