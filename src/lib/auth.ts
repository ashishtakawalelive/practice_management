import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession, verifySession } from "./session";

export async function startSession(user: { id: string; orgId: string; role: string }) {
  const token = await signSession({ userId: user.id, orgId: user.orgId, role: user.role });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** The signed-in user with their organisation, or a redirect to /login. Cached per request. */
export const requireUser = cache(async () => {
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login");
  const user = await db.user.findUnique({ where: { id: session.userId }, include: { org: true } });
  if (!user || !user.active) redirect("/login");
  return user;
});

export type CurrentUser = Awaited<ReturnType<typeof requireUser>>;

export function canManage(user: { role: string }) {
  return user.role === "PARTNER" || user.role === "MANAGER";
}

export function isPartner(user: { role: string }) {
  return user.role === "PARTNER";
}

/** Throws unless the user is a Partner or Manager. Use inside server actions. */
export function assertManager(user: { role: string }) {
  if (!canManage(user)) throw new Error("Only partners and managers can do this.");
}
