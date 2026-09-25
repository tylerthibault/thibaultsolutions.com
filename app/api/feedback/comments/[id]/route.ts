import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiSectionUser } from "@/src/lib/api-auth";
import { isCreativeCircleAdmin } from "@/src/lib/auth";
import { db } from "@/src/lib/db";
import { feedbackComments, feedbackVideos } from "@/src/lib/schema";

const patchSchema = z.object({ resolved: z.boolean() });

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const current = await apiSectionUser(request, "feedback");
  if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isCreativeCircleAdmin(current.email)) {
    return NextResponse.json({ error: "Only the Creative Circle admin can resolve comments." }, { status: 403 });
  }

  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  const [comment] = await db.select().from(feedbackComments).where(eq(feedbackComments.id, id)).limit(1);
  if (!comment) return NextResponse.json({ error: "Comment not found." }, { status: 404 });
  const [video] = await db.select().from(feedbackVideos).where(eq(feedbackVideos.id, comment.videoId)).limit(1);
  if (!video || video.ownerId !== current.id) return NextResponse.json({ error: "Only the video owner can resolve comments." }, { status: 403 });
  const [updated] = await db.update(feedbackComments).set({ resolved: parsed.data.resolved, updatedAt: new Date() }).where(eq(feedbackComments.id, id)).returning();
  return NextResponse.json({ comment: updated });
}
