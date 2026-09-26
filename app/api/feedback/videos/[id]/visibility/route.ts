import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiSectionUser } from "@/src/lib/api-auth";
import { isCreativeCircleAdmin } from "@/src/lib/auth";
import { db } from "@/src/lib/db";
import { feedbackVideos } from "@/src/lib/schema";

const visibilitySchema = z.object({ isPublic: z.boolean() });

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const current = await apiSectionUser(request, "feedback");
  if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isCreativeCircleAdmin(current.email)) {
    return NextResponse.json({ error: "Only the Creative Circle admin can change video visibility." }, { status: 403 });
  }

  const parsed = visibilitySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid visibility setting." }, { status: 400 });

  const { id } = await ctx.params;
  const [updated] = await db.update(feedbackVideos)
    .set({ isPublic: parsed.data.isPublic, updatedAt: new Date() })
    .where(and(eq(feedbackVideos.id, id), eq(feedbackVideos.ownerId, current.id)))
    .returning({
      id: feedbackVideos.id,
      isPublic: feedbackVideos.isPublic,
      updatedAt: feedbackVideos.updatedAt,
    });

  if (!updated) return NextResponse.json({ error: "Feedback video not found." }, { status: 404 });
  return NextResponse.json({ video: updated });
}
