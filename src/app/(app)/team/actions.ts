"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertManager, isPartner, requireUser } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import type { FormState } from "@/components/form-bits";

function str(data: FormData, key: string) {
  const v = data.get(key);
  return v == null ? "" : String(v).trim();
}

export async function addMember(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireUser();
  assertManager(user);
  const name = str(data, "name");
  const email = str(data, "email").toLowerCase();
  const password = String(data.get("password") ?? "");
  let role = str(data, "role");
  if (!ROLES.includes(role as never)) role = "STAFF";
  if (role === "PARTNER" && !isPartner(user)) return { error: "Only a partner can add another partner." };
  if (!name || !email) return { error: "Name and email are required." };
  if (password.length < 8) return { error: "Temporary password must be at least 8 characters." };
  if (await db.user.findUnique({ where: { email } })) return { error: "That email is already in use." };
  await db.user.create({
    data: {
      orgId: user.orgId,
      name,
      email,
      role,
      designation: str(data, "designation") || null,
      phone: str(data, "phone") || null,
      passwordHash: await bcrypt.hash(password, 10),
    },
  });
  revalidatePath("/team");
  return { ok: true };
}

export async function updateMember(memberId: string, data: FormData) {
  const user = await requireUser();
  assertManager(user);
  const member = await db.user.findFirst({ where: { id: memberId, orgId: user.orgId } });
  if (!member) return;
  let role = str(data, "role");
  if (!ROLES.includes(role as never)) role = member.role;
  // Only partners can grant or remove the partner role; nobody can demote themselves.
  if ((role === "PARTNER" || member.role === "PARTNER") && !isPartner(user)) role = member.role;
  if (member.id === user.id) role = member.role;
  await db.user.update({
    where: { id: member.id },
    data: { role, designation: str(data, "designation") || null },
  });
  revalidatePath("/team");
}

export async function setMemberActive(memberId: string, active: boolean) {
  const user = await requireUser();
  assertManager(user);
  if (memberId === user.id) return;
  const member = await db.user.findFirst({ where: { id: memberId, orgId: user.orgId } });
  if (!member || (member.role === "PARTNER" && !isPartner(user))) return;
  await db.user.update({ where: { id: member.id }, data: { active } });
  revalidatePath("/team");
}

export async function changePassword(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireUser();
  const current = String(data.get("current") ?? "");
  const next = String(data.get("next") ?? "");
  if (!(await bcrypt.compare(current, user.passwordHash))) return { error: "Current password is incorrect." };
  if (next.length < 8) return { error: "New password must be at least 8 characters." };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(next, 10) } });
  return { ok: true };
}
