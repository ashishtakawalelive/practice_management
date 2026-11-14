"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { endSession, startSession } from "@/lib/auth";
import type { FormState } from "@/components/form-bits";

function str(data: FormData, key: string) {
  return String(data.get(key) ?? "").trim();
}

function safeNext(next: string) {
  return next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export async function login(_: FormState, data: FormData): Promise<FormState> {
  const email = str(data, "email").toLowerCase();
  const password = String(data.get("password") ?? "");
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "Email or password is incorrect." };
  }
  await startSession(user);
  redirect(safeNext(str(data, "next")));
}

export async function signup(_: FormState, data: FormData): Promise<FormState> {
  const firm = str(data, "firm");
  const name = str(data, "name");
  const email = str(data, "email").toLowerCase();
  const password = String(data.get("password") ?? "");
  if (!firm || !name || !email) return { error: "Please fill in every field." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (await db.user.findUnique({ where: { email } })) return { error: "An account with this email already exists." };

  const org = await db.organization.create({
    data: {
      name: firm,
      legalName: firm,
      users: { create: { name, email, role: "PARTNER", designation: "Partner", passwordHash: await bcrypt.hash(password, 10) } },
    },
    include: { users: true },
  });
  await startSession(org.users[0]);
  redirect("/dashboard");
}

export async function logout() {
  await endSession();
  redirect("/login");
}
