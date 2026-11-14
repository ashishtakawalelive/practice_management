import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ENTITY_TYPES } from "@/lib/constants";
import { formatINR } from "@/lib/gst";
import { Avatar, Card, CardHeader, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { ActionForm } from "@/components/form-bits";
import { ClientFields } from "./client-form";
import { createClient } from "./actions";

export const metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string; inactive?: string }> }) {
  const user = await requireUser();
  const { q, inactive } = await searchParams;
  const [clients, users] = await Promise.all([
    db.client.findMany({
      where: {
        orgId: user.orgId,
        active: inactive !== "1",
        ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { gstin: { contains: q.toUpperCase(), mode: "insensitive" as const } }, { pan: { contains: q.toUpperCase(), mode: "insensitive" as const } }] } : {}),
      },
      include: {
        manager: true,
        invoices: { where: { docType: "INVOICE", status: { notIn: ["DRAFT", "CANCELLED"] } }, select: { total: true, amountPaid: true } },
        _count: { select: { projects: true } },
      },
      orderBy: { name: "asc" },
    }),
    db.user.findMany({ where: { orgId: user.orgId, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle="Your client master — used by projects and invoices."
        actions={
          <form className="flex gap-2">
            <input name="q" defaultValue={q} placeholder="Search name, PAN, GSTIN" className="field h-9 w-64" />
            <Link href={inactive === "1" ? "/clients" : "/clients?inactive=1"} className="flex items-center text-sm text-muted hover:text-ink">
              {inactive === "1" ? "Active" : "Inactive"}
            </Link>
          </form>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_400px]">
        <Card>
          {clients.length === 0 ? (
            <EmptyState title="No clients found" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Client</Th>
                  <Th>PAN</Th>
                  <Th>GSTIN</Th>
                  <Th>Manager</Th>
                  <Th className="text-right">Projects</Th>
                  <Th className="text-right">Outstanding</Th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => {
                  const due = c.invoices.reduce((s, i) => s + (i.total - i.amountPaid), 0);
                  return (
                    <tr key={c.id} className="hover:bg-canvas/50">
                      <Td>
                        <Link href={`/clients/${c.id}`} className="font-medium hover:text-brand-700">
                          {c.name}
                        </Link>
                        <p className="text-xs text-muted">
                          {ENTITY_TYPES[c.entityType]}
                          {c.city && ` · ${c.city}`}
                        </p>
                      </Td>
                      <Td className="font-mono text-xs">{c.pan ?? "—"}</Td>
                      <Td className="font-mono text-xs">{c.gstin ?? <span className="text-muted">Unregistered</span>}</Td>
                      <Td>
                        {c.manager && (
                          <span className="flex items-center gap-1.5 text-sm">
                            <Avatar name={c.manager.name} size={20} /> {c.manager.name}
                          </span>
                        )}
                      </Td>
                      <Td className="text-right tabular-nums">{c._count.projects}</Td>
                      <Td className={`text-right tabular-nums ${due > 0 ? "font-medium text-amber-700" : "text-muted"}`}>{formatINR(due)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>
        <Card className="self-start">
          <CardHeader title="Add client" />
          <ActionForm action={createClient} className="p-4">
            <ClientFields users={users} submitLabel="Add client" />
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
