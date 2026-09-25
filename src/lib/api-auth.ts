import { eq } from "drizzle-orm";
import { auth, getCreativeCirclePermissions, type CreativeCircleSection } from "./auth";
import { db } from "./db";
import { user as users } from "./schema";

export async function apiSessionUser(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user ?? null;
}

async function hydratedUser(userId: string) {
  const [row] = await db.select({ id: users.id, name: users.name, email: users.email })
    .from(users).where(eq(users.id, userId)).limit(1);
  return row ?? null;
}

export async function apiUser(request: Request) {
  const sessionUser = await apiSessionUser(request);
  if (!sessionUser) return null;
  const permissions = await getCreativeCirclePermissions(sessionUser.id, sessionUser.email);
  if (!permissions.anyAccess) return null;
  return (await hydratedUser(sessionUser.id)) ?? sessionUser;
}

export async function apiSectionUser(request: Request, section: CreativeCircleSection) {
  const sessionUser = await apiSessionUser(request);
  if (!sessionUser) return null;
  const permissions = await getCreativeCirclePermissions(sessionUser.id, sessionUser.email);
  const allowed = section === "lab" ? permissions.labAccess : permissions.feedbackAccess;
  if (!allowed) return null;
  return (await hydratedUser(sessionUser.id)) ?? sessionUser;
}
