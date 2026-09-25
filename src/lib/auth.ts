import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { schema, user as users } from "./schema";

export function createAuth(disableSignUp = true) {
  return betterAuth({
    appName: "Creative Circle",
    baseURL: process.env.APP_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, { provider: "pg", schema }),
    emailAndPassword: { enabled: true, disableSignUp, minPasswordLength: 12 },
    advanced: { trustedProxyHeaders: true, useSecureCookies: process.env.NODE_ENV === "production" }
  });
}

export const auth = createAuth(true);

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export function isCreativeCircleAdmin(email: string | null | undefined) {
  const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
  return Boolean(ownerEmail && email?.trim().toLowerCase() === ownerEmail);
}

export async function hasCreativeCircleAccess(userId: string, email?: string | null) {
  if (isCreativeCircleAdmin(email)) return true;
  const [row] = await db.select({ enabled: users.creativeCircleAccess }).from(users).where(eq(users.id, userId)).limit(1);
  return row?.enabled === true;
}

export async function requireUser() {
  const session = await getSession();
  if (!session?.user) redirect("/creative-circle/login");
  if (!(await hasCreativeCircleAccess(session.user.id, session.user.email))) {
    redirect("/creative-circle/access-required");
  }
  return session.user;
}

export async function requireCreativeCircleAdmin() {
  const session = await getSession();
  if (!session?.user) redirect("/creative-circle/login");
  if (!isCreativeCircleAdmin(session.user.email)) redirect("/creative-circle");
  return session.user;
}
