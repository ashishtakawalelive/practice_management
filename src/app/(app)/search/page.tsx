import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { DOC_TYPE_LABEL } from "@/lib/constants";
import { formatINR } from "@/lib/gst";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { TypeIcon, StatusBadge } from "@/components/issue-bits";

export const metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const q = ((await searchParams).q ?? "").trim();

  // Jump straight to an issue when the query is an issue key, e.g. "gst-3"
  const key = q.toUpperCase().match(/^([A-Z][A-Z0-9]*)-(\d+)$/);
  if (key) {
    const hit = await db.issue.findFirst({ where: { orgId: user.orgId, number: parseInt(key[2], 10), project: { key: key[1] } } });
    if (hit) redirect(`/issues/${key[1]}-${key[2]}`);
  }

  const [issues, clients, invoices] = q
    ? await Promise.all([
        db.issue.findMany({
          where: { orgId: user.orgId, OR: [{ title: { contains: q, mode: "insensitive" as const } }, { description: { contains: q, mode: "insensitive" as const } }, { labels: { contains: q, mode: "insensitive" as const } }] },
          include: { project: true, status: true },
          orderBy: { updatedAt: "desc" },
          take: 25,
        }),
        db.client.findMany({
          where: { orgId: user.orgId, OR: [{ name: { contains: q, mode: "insensitive" as const } }, { pan: { contains: q.toUpperCase(), mode: "insensitive" as const } }, { gstin: { contains: q.toUpperCase(), mode: "insensitive" as const } }] },
          take: 10,
        }),
        db.invoice.findMany({
          where: { orgId: user.orgId, OR: [{ number: { contains: q.toUpperCase(), mode: "insensitive" as const } }, { client: { name: { contains: q, mode: "insensitive" as const } } }] },
          include: { client: true },
          take: 10,
        }),
      ])
    : [[], [], []];

  const none = issues.length + clients.length + invoices.length === 0;

  return (
    <>
      <PageHeader title={q ? `Results for “${q}”` : "Search"} />
      {none ? (
        <Card>
          <EmptyState title={q ? "Nothing found" : "Type in the search box above"}>Search issue titles and descriptions, client names, PAN, GSTIN and invoice numbers. Type an issue key like GST-3 to jump to it.</EmptyState>
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader title={`Issues · ${issues.length}`} />
            <ul className="divide-y divide-line">
              {issues.map((i) => (
                <li key={i.id} className="flex items-center gap-3 px-4 py-2.5">
                  <TypeIcon type={i.type} size={14} />
                  <Link href={`/issues/${i.project.key}-${i.number}`} className="w-16 font-mono text-xs text-muted hover:underline">
                    {i.project.key}-{i.number}
                  </Link>
                  <Link href={`/issues/${i.project.key}-${i.number}`} className="flex-1 truncate text-sm hover:text-brand-700">
                    {i.title}
                  </Link>
                  <StatusBadge name={i.status.name} category={i.status.category} />
                </li>
              ))}
            </ul>
          </Card>
          <div className="space-y-5">
            <Card>
              <CardHeader title={`Clients · ${clients.length}`} />
              <ul className="divide-y divide-line">
                {clients.map((c) => (
                  <li key={c.id} className="px-4 py-2.5">
                    <Link href={`/clients/${c.id}`} className="text-sm hover:text-brand-700">
                      {c.name}
                    </Link>
                    <p className="font-mono text-[11px] text-muted">{c.gstin ?? c.pan}</p>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <CardHeader title={`Billing · ${invoices.length}`} />
              <ul className="divide-y divide-line">
                {invoices.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                    <Link href={`/invoices/${i.id}`} className="hover:text-brand-700">
                      <span className="font-mono text-xs">{i.number}</span> <span className="text-xs text-muted">{DOC_TYPE_LABEL[i.docType]}</span>
                      <p className="text-xs text-muted">{i.client.name}</p>
                    </Link>
                    <span className="tabular-nums">{formatINR(i.total)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
