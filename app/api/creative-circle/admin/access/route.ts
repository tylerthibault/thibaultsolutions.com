import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiSessionUser } from "@/src/lib/api-auth";
import { isCreativeCircleAdmin } from "@/src/lib/auth";
import { db } from "@/src/lib/db";
import { user as users } from "@/src/lib/schema";

const updateSchema = z.object({
  userId: z.string().min(1).max(255),
  labAccess: z.boolean().optional(),
  feedbackAccess: z.boolean().optional(),
}).refine((value) => value.labAccess !== undefined || value.feedbackAccess !== undefined, {
  message: "Choose at least one section to update.",
});

export async function PATCH(request: Request) {
  const admin = await apiSessionUser(request);
  if (!admin || !isCreativeCircleAdmin(admin.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid access update." }, { status: 400 });

  const [target] = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    labAccess: users.creativeCircleLabAccess,
    feedbackAccess: users.creativeCircleFeedbackAccess,
  }).from(users).where(eq(users.id, parsed.data.userId)).limit(1);

  if (!target) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  if (isCreativeCircleAdmin(target.email)) {
    return NextResponse.json({ error: "The Creative Circle admin always has access to both sections." }, { status: 400 });
  }

  const labAccess = parsed.data.labAccess ?? target.labAccess;
  const feedbackAccess = parsed.data.feedbackAccess ?? target.feedbackAccess;

  await db.update(users).set({
    creativeCircleAccess: labAccess || feedbackAccess,
    creativeCircleLabAccess: labAccess,
    creativeCircleFeedbackAccess: feedbackAccess,
    updatedAt: new Date(),
  }).where(eq(users.id, target.id));

  return NextResponse.json({ user: { ...target, labAccess, feedbackAccess, isAdmin: false } });
}
