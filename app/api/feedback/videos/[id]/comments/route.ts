import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiSectionUser } from "@/src/lib/api-auth";
import { db } from "@/src/lib/db";
import { getFeedbackVideoAccess } from "@/src/lib/feedback-access";
import { feedbackAssignments, feedbackComments, user as users } from "@/src/lib/schema";

const commentSchema = z.object({
  body: z.string().trim().min(1).max(2000),
  timestampMs: z.number().int().min(0).max(86400000).nullable().optional(),
});

async function commentsFor(videoId: string) {
  return db.select({
    id: feedbackComments.id,
    videoId: feedbackComments.videoId,
    authorId: feedbackComments.authorId,
    authorName: users.name,
    authorEmail: users.email,
    timestampMs: feedbackComments.timestampMs,
    body: feedbackComments.body,
    resolved: feedbackComments.resolved,
    createdAt: feedbackComments.createdAt,
    updatedAt: feedbackComments.updatedAt,
  }).from(feedbackComments)
    .innerJoin(users, eq(feedbackComments.authorId, users.id))
    .where(eq(feedbackComments.videoId, videoId))
    .orderBy(asc(feedbackComments.createdAt));
}

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const current = await apiSectionUser(request, "feedback");
  if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const access = await getFeedbackVideoAccess(id, current.id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (access.role === "reviewer") {
    await db.update(feedbackAssignments).set({ seenAt: new Date() })
      .where(and(eq(feedbackAssignments.videoId, id), eq(feedbackAssignments.reviewerUserId, current.id)));
  }
  return NextResponse.json({ comments: await commentsFor(id) });
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const current = await apiSectionUser(request, "feedback");
  if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const access = await getFeedbackVideoAccess(id, current.id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const parsed = commentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Write a comment before posting." }, { status: 400 });
  const timestampMs = parsed.data.timestampMs ?? null;
  if (timestampMs !== null && access.video.durationMs && timestampMs > access.video.durationMs + 1000) {
    return NextResponse.json({ error: "Timestamp is outside the video." }, { status: 400 });
  }
  const [created] = await db.insert(feedbackComments).values({
    videoId: id, authorId: current.id, body: parsed.data.body, timestampMs,
  }).returning();
  return NextResponse.json({ comment: { ...created, authorName: current.name, authorEmail: current.email } }, { status: 201 });
}
