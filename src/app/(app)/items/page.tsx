import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { GST_RATES, UNITS } from "@/lib/constants";
import { formatINR } from "@/lib/gst";
import { Badge, Card, CardHeader, Field, PageHeader, Table, Td, Th } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/form-bits";
import { saveItem, setItemActive } from "../invoices/actions";

export const metadata = { title: "Items & services" };

export default async function ItemsPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const user = await requireUser();
  const { edit } = await searchParams;
  const items = await db.item.findMany({ where: { orgId: user.orgId }, orderBy: [{ active: "desc" }, { name: "asc" }] });
  const editing = items.find((i) => i.id === edit);

  return (
    <>
      <PageHeader title="Items & services" subtitle="Your rate card. Pick these on invoices and quotations to fill HSN/SAC, rate and GST automatically." />
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>HSN/SAC</Th>
                <Th>Unit</Th>
                <Th className="text-right">Rate</Th>
                <Th className="text-right">GST</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className={i.active ? "" : "opacity-50"}>
                  <Td>
                    <span className="font-medium">{i.name}</span> {i.kind === "GOODS" && <Badge>Goods</Badge>}
                    {i.description && <p className="text-xs text-muted">{i.description}</p>}
                  </Td>
                  <Td className="font-mono text-xs">{i.hsnSac ?? "—"}</Td>
                  <Td className="text-xs">{i.unit}</Td>
                  <Td className="text-right tabular-nums">{formatINR(i.rate)}</Td>
                  <Td className="text-right tabular-nums">{i.gstRate}%</Td>
                  <Td className="text-right whitespace-nowrap">
                    <a href={`?edit=${i.id}`} className="mr-3 text-xs font-medium text-brand-700 hover:underline">
                      Edit
                    </a>
                    <form action={setItemActive.bind(null, i.id, !i.active)} className="inline">
                      <button className="text-xs text-muted hover:text-ink">{i.active ? "Archive" : "Restore"}</button>
                    </form>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        <Card className="self-start">
          <CardHeader title={editing ? `Edit ${editing.name}` : "New item"} action={editing && <a href="/items" className="text-xs text-muted hover:text-ink">Cancel</a>} />
          <ActionForm key={editing?.id ?? "new"} action={saveItem.bind(null, editing?.id ?? null)} resetOnSuccess={!editing} className="space-y-3 p-4">
            <Field label="Name">
              <input name="name" required defaultValue={editing?.name} className="field" />
            </Field>
            <Field label="Description">
              <input name="description" defaultValue={editing?.description ?? ""} className="field" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type">
                <select name="kind" defaultValue={editing?.kind ?? "SERVICE"} className="field">
                  <option value="SERVICE">Service (SAC)</option>
                  <option value="GOODS">Goods (HSN)</option>
                </select>
              </Field>
              <Field label="HSN / SAC">
                <input name="hsnSac" defaultValue={editing?.hsnSac ?? ""} placeholder="998231" className="field font-mono" />
              </Field>
              <Field label="Rate (₹)">
                <input name="rate" type="number" step="0.01" min="0" defaultValue={editing?.rate ?? ""} className="field" />
              </Field>
              <Field label="GST rate">
                <select name="gstRate" defaultValue={String(editing?.gstRate ?? 18)} className="field">
                  {GST_RATES.map((r) => (
                    <option key={r} value={r}>
                      {r}%
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Unit">
                <select name="unit" defaultValue={editing?.unit ?? "NOS"} className="field">
                  {UNITS.map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </select>
              </Field>
            </div>
            <SubmitButton className="w-full">{editing ? "Save changes" : "Add item"}</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
