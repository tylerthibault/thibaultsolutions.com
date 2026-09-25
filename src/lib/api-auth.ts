import { eq } from "drizzle-orm";
import { auth, hasCreativeCircleAccess } from "./auth";
import { db } from "./db";
import { user as users } from "./schema";

export async function apiSessionUser(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user ?? null;
}

export async function apiUser(request: Request) {
  const sessionUser = await apiSessionUser(request);
  if (!sessionUser) return null;
  if (!(await hasCreativeCircleAccess(sessionUser.id, sessionUser.email))) return null;

  const [row] = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
  }).from(users).where(eq(users.id, sessionUser.id)).limit(1);

  return row ?? sessionUser;
}
