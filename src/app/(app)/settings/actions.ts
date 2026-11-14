"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertManager, requireUser } from "@/lib/auth";
import { stateName } from "@/lib/constants";
import { isValidGstinFormat } from "@/lib/gst";
import type { FormState } from "@/components/form-bits";

function str(data: FormData, key: string) {
  const v = data.get(key);
  return v == null ? "" : String(v).trim();
}

export async function updateOrg(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireUser();
  assertManager(user);
  const name = str(data, "name");
  if (!name) return { error: "Firm name is required." };
  const gstin = str(data, "gstin").toUpperCase();
  if (gstin && !isValidGstinFormat(gstin)) return { error: "GSTIN should be 15 characters, e.g. 27ABCDE1234F1Z5." };
  let stateCode = str(data, "stateCode");
  if (!stateCode && gstin) stateCode = gstin.slice(0, 2);
  const prefix = (k: string, d: string) => (str(data, k).toUpperCase().replace(/[^A-Z0-9/]/g, "") || d);

  await db.organization.update({
    where: { id: user.orgId },
    data: {
      name,
      legalName: str(data, "legalName") || null,
      gstin: gstin || null,
      pan: str(data, "pan").toUpperCase() || null,
      address: str(data, "address") || null,
      city: str(data, "city") || null,
      stateCode: stateCode || null,
      state: stateCode ? stateName(stateCode) : null,
      pincode: str(data, "pincode") || null,
      phone: str(data, "phone") || null,
      email: str(data, "email") || null,
      website: str(data, "website") || null,
      bankName: str(data, "bankName") || null,
      bankAccountNo: str(data, "bankAccountNo") || null,
      bankIfsc: str(data, "bankIfsc").toUpperCase() || null,
      bankBranch: str(data, "bankBranch") || null,
      upiId: str(data, "upiId") || null,
      invoicePrefix: prefix("invoicePrefix", "INV"),
      quotePrefix: prefix("quotePrefix", "QT"),
      proformaPrefix: prefix("proformaPrefix", "PI"),
      creditPrefix: prefix("creditPrefix", "CN"),
      invoiceTerms: str(data, "invoiceTerms") || null,
    },
  });
  revalidatePath("/", "layout");
  return { ok: true };
}
