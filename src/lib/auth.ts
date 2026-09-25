import { betterAuth } from "better-auth/minimal";
import { username } from "better-auth/plugins";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { schema, user as users } from "./schema";

export type CreativeCircleSection = "lab" | "feedback";

export function createAuth(disableSignUp = true) {
  return betterAuth({
    appName: "Creative Circle",
    baseURL: process.env.APP_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, { provider: "pg", schema }),
    emailAndPassword: { enabled: true, disableSignUp, minPasswordLength: 12 },
    disabledPaths: ["/is-username-available"],
    plugins: [
      username({
        displayUsername: false,
        immutableUsername: true,
        minUsernameLength: 3,
        maxUsernameLength: 30,
      }),
    ],
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

export async function getCreativeCirclePermissions(userId: string, email?: string | null) {
  if (isCreativeCircleAdmin(email)) {
    return { labAccess: true, feedbackAccess: true, anyAccess: true };
  }

  const [row] = await db.select({
    labAccess: users.creativeCircleLabAccess,
    feedbackAccess: users.creativeCircleFeedbackAccess,
  }).from(users).where(eq(users.id, userId)).limit(1);

  const labAccess = row?.labAccess === true;
  const feedbackAccess = row?.feedbackAccess === true;
  return { labAccess, feedbackAccess, anyAccess: labAccess || feedbackAccess };
}

export async function hasCreativeCircleAccess(userId: string, email?: string | null) {
  return (await getCreativeCirclePermissions(userId, email)).anyAccess;
}

export async function requireUser() {
  const session = await getSession();
  if (!session?.user) redirect("/creative-circle/login");
  if (!(await hasCreativeCircleAccess(session.user.id, session.user.email))) {
    redirect("/creative-circle/access-required");
  }
  return session.user;
}

export async function requireSectionUser(section: CreativeCircleSection) {
  const session = await getSession();
  if (!session?.user) redirect("/creative-circle/login");

  const permissions = await getCreativeCirclePermissions(session.user.id, session.user.email);
  const allowed = section === "lab" ? permissions.labAccess : permissions.feedbackAccess;
  if (!allowed) redirect(permissions.anyAccess ? "/creative-circle" : "/creative-circle/access-required");

  return session.user;
}

export async function requireCreativeCircleAdmin() {
  const session = await getSession();
  if (!session?.user) redirect("/creative-circle/login");
  if (!isCreativeCircleAdmin(session.user.email)) redirect("/creative-circle");
  return session.user;
}
