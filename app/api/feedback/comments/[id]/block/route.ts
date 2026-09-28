import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiSectionUser } from "@/src/lib/api-auth";
import { isCreativeCircleAdmin } from "@/src/lib/auth";
import { db } from "@/src/lib/db";
import { blockedFeedbackIps, feedbackComments, feedbackVideos } from "@/src/lib/schema";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const current = await apiSectionUser(request, "feedback");
  if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isCreativeCircleAdmin(current.email)) {
    return NextResponse.json({ error: "Only the Creative Circle admin can block feedback sources." }, { status: 403 });
  }

  const { id } = await ctx.params;
  const [comment] = await db.select().from(feedbackComments)
    .where(eq(feedbackComments.id, id)).limit(1);
  if (!comment) return NextResponse.json({ error: "Comment not found." }, { status: 404 });

  const [video] = await db.select().from(feedbackVideos)
    .where(eq(feedbackVideos.id, comment.videoId)).limit(1);
  if (!video || video.ownerId !== current.id) {
    return NextResponse.json({ error: "Only the video owner can block feedback sources." }, { status: 403 });
  }
  if (!comment.ipAddress) {
    return NextResponse.json({ error: "No network address was recorded for this comment." }, { status: 400 });
  }

  await db.insert(blockedFeedbackIps).values({
    ipAddress: comment.ipAddress,
    reason: `Blocked from feedback comment ${comment.id}`,
  }).onConflictDoNothing({ target: blockedFeedbackIps.ipAddress });

  return NextResponse.json({ ok: true });
}
