import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { DOC_TYPE_LABEL, ENTITY_TYPES } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { formatINR } from "@/lib/gst";
import { Card, CardHeader, LinkButton, PageHeader, Stat, Table, Td, Th, Badge, EmptyState } from "@/components/ui";
import { ActionForm, ConfirmButton } from "@/components/form-bits";
import { InvoiceStatusBadge } from "../../invoices/status";
import { ClientFields } from "../client-form";
import { updateClient, setClientActive } from "../actions";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const client = await db.client.findFirst({
    where: { id, orgId: user.orgId },
    include: {
      projects: { include: { issues: { select: { status: { select: { category: true } } } } } },
      invoices: { orderBy: { issueDate: "desc" } },
    },
  });
  if (!client) notFound();
  const users = await db.user.findMany({ where: { orgId: user.orgId, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });

  const billed = client.invoices.filter((i) => i.docType === "INVOICE" && !["DRAFT", "CANCELLED"].includes(i.status));
  const totalBilled = billed.reduce((s, i) => s + i.total, 0);
  const received = billed.reduce((s, i) => s + i.amountPaid, 0);

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link href="/clients" className="hover:underline">
            Clients
          </Link>
        }
        title={client.name}
        subtitle={
          <>
            {ENTITY_TYPES[client.entityType]}
            {client.gstin && <> · GSTIN <span className="font-mono">{client.gstin}</span></>}
            {client.state && <> · {client.state}</>}
            {!client.active && <Badge tone="amber" className="ml-2">Inactive</Badge>}
          </>
        }
        actions={
          <>
            <LinkButton href={`/invoices/new?client=${client.id}`}>New invoice</LinkButton>
            <LinkButton href={`/invoices/new?client=${client.id}&type=QUOTATION`} variant="secondary">
              New quotation
            </LinkButton>
          </>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total billed" value={formatINR(totalBilled)} />
        <Stat label="Received" value={formatINR(received)} />
        <Stat label="Outstanding" value={formatINR(totalBilled - received)} tone={totalBilled - received > 0 ? "amber" : undefined} />
        <Stat label="Projects" value={client.projects.length} />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_400px]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Projects" />
            {client.projects.length === 0 ? (
              <EmptyState title="No projects for this client">Create one from the Projects page and pick this client.</EmptyState>
            ) : (
              <ul className="divide-y divide-line">
                {client.projects.map((p) => {
                  const open = p.issues.filter((i) => i.status.category !== "DONE").length;
                  return (
                    <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="w-14 font-mono text-xs text-muted">{p.key}</span>
                      <Link href={`/projects/${p.key}/board`} className="flex-1 text-sm hover:text-brand-700">
                        {p.name}
                      </Link>
                      <span className="text-xs text-muted">{open} open</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader title="Billing documents" />
            {client.invoices.length === 0 ? (
              <EmptyState title="Nothing billed yet" />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Number</Th>
                    <Th>Type</Th>
                    <Th>Date</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Amount</Th>
                  </tr>
                </thead>
                <tbody>
                  {client.invoices.map((i) => (
                    <tr key={i.id} className="hover:bg-canvas/50">
                      <Td>
                        <Link href={`/invoices/${i.id}`} className="font-mono text-xs font-medium hover:underline">
                          {i.number}
                        </Link>
                      </Td>
                      <Td className="text-xs text-muted">{DOC_TYPE_LABEL[i.docType]}</Td>
                      <Td className="text-sm">{formatDate(i.issueDate)}</Td>
                      <Td>
                        <InvoiceStatusBadge invoice={i} />
                      </Td>
                      <Td className="text-right tabular-nums">{formatINR(i.total)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
        <Card className="self-start">
          <CardHeader
            title="Client details"
            action={
              <form action={setClientActive.bind(null, client.id, !client.active)}>
                <ConfirmButton message={client.active ? "Mark this client inactive?" : "Reactivate this client?"} className="text-xs text-muted hover:text-ink">
                  {client.active ? "Mark inactive" : "Reactivate"}
                </ConfirmButton>
              </form>
            }
          />
          <ActionForm action={updateClient.bind(null, client.id)} className="p-4">
            <ClientFields client={client} users={users} submitLabel="Save changes" />
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
