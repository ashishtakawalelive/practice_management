"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ENTITY_TYPES, stateName } from "@/lib/constants";
import { isValidGstinFormat } from "@/lib/gst";
import type { FormState } from "@/components/form-bits";

function str(data: FormData, key: string) {
  const v = data.get(key);
  return v == null ? "" : String(v).trim();
}

function parseClient(data: FormData) {
  const gstin = str(data, "gstin").toUpperCase();
  const pan = str(data, "pan").toUpperCase();
  let stateCode = str(data, "stateCode");
  if (!stateCode && gstin) stateCode = gstin.slice(0, 2);
  const entityType = str(data, "entityType");
  return {
    name: str(data, "name"),
    entityType: ENTITY_TYPES[entityType] ? entityType : "COMPANY",
    pan: pan || null,
    gstin: gstin || null,
    cin: str(data, "cin").toUpperCase() || null,
    contactPerson: str(data, "contactPerson") || null,
    email: str(data, "email") || null,
    phone: str(data, "phone") || null,
    address: str(data, "address") || null,
    city: str(data, "city") || null,
    stateCode: stateCode || null,
    state: stateCode ? stateName(stateCode) : null,
    pincode: str(data, "pincode") || null,
    notes: str(data, "notes") || null,
    managerId: str(data, "managerId") || null,
  };
}

function validate(c: ReturnType<typeof parseClient>) {
  if (!c.name) return "Client name is required.";
  if (c.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(c.pan)) return "PAN should look like ABCDE1234F.";
  if (c.gstin && !isValidGstinFormat(c.gstin)) return "GSTIN should be 15 characters, e.g. 27ABCDE1234F1Z5.";
  if (c.gstin && c.pan && c.gstin.slice(2, 12) !== c.pan) return "The PAN inside the GSTIN doesn't match the PAN entered.";
  return null;
}

export async function createClient(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireUser();
  const c = parseClient(data);
  const err = validate(c);
  if (err) return { error: err };
  const client = await db.client.create({ data: { orgId: user.orgId, ...c } });
  revalidatePath("/clients");
  redirect(`/clients/${client.id}`);
}

export async function updateClient(clientId: string, _: FormState, data: FormData): Promise<FormState> {
  const user = await requireUser();
  const existing = await db.client.findFirst({ where: { id: clientId, orgId: user.orgId } });
  if (!existing) return { error: "Client not found." };
  const c = parseClient(data);
  const err = validate(c);
  if (err) return { error: err };
  await db.client.update({ where: { id: clientId }, data: c });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setClientActive(clientId: string, active: boolean) {
  const user = await requireUser();
  await db.client.updateMany({ where: { id: clientId, orgId: user.orgId }, data: { active } });
  revalidatePath("/", "layout");
}
