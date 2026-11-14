import "server-only";
import { db } from "@/lib/db";

/** Clients and items for the invoice editor's pickers. */
export async function editorOptions(orgId: string) {
  const [clients, items] = await Promise.all([
    db.client.findMany({
      where: { orgId, active: true },
      select: { id: true, name: true, gstin: true, stateCode: true, address: true, city: true },
      orderBy: { name: "asc" },
    }),
    db.item.findMany({
      where: { orgId, active: true },
      select: { id: true, name: true, hsnSac: true, unit: true, rate: true, gstRate: true, description: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return { clients, items };
}
