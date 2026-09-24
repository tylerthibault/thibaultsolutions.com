import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { schema } from "./schema";

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

export async function requireUser() {
  const session = await getSession();
  if (!session?.user) redirect("/creative-circle/login");
  return session.user;
}
