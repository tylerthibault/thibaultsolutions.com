import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiSessionUser } from "@/src/lib/api-auth";
import { isCreativeCircleAdmin } from "@/src/lib/auth";
import { db } from "@/src/lib/db";
import { user as users } from "@/src/lib/schema";

const updateSchema = z.object({
  userId: z.string().min(1).max(255),
  enabled: z.boolean(),
});

export async function PATCH(request: Request) {
  const admin = await apiSessionUser(request);
  if (!admin || !isCreativeCircleAdmin(admin.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid access update." }, { status: 400 });
  }

  const [target] = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    creativeCircleAccess: users.creativeCircleAccess,
  }).from(users).where(eq(users.id, parsed.data.userId)).limit(1);

  if (!target) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  if (isCreativeCircleAdmin(target.email) && !parsed.data.enabled) {
    return NextResponse.json({ error: "The Creative Circle admin cannot be disabled." }, { status: 400 });
  }

  await db.update(users)
    .set({ creativeCircleAccess: parsed.data.enabled, updatedAt: new Date() })
    .where(eq(users.id, target.id));

  return NextResponse.json({
    user: {
      ...target,
      creativeCircleAccess: parsed.data.enabled,
      isAdmin: isCreativeCircleAdmin(target.email),
    },
  });
}
