import { and, asc, eq, gte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiSessionUser } from "@/src/lib/api-auth";
import { db } from "@/src/lib/db";
import { getFeedbackRequestAccess } from "@/src/lib/feedback-public";
import { blockedFeedbackIps, feedbackAssignments, feedbackComments, user as users } from "@/src/lib/schema";

const commentSchema = z.object({
  body: z.string().trim().min(1).max(2000),
  displayName: z.string().trim().max(80).optional(),
  reviewerKey: z.string().trim().max(100).optional(),
  timestampMs: z.number().int().min(0).max(86400000).nullable().optional(),
  timestampEndMs: z.number().int().min(0).max(86400000).nullable().optional(),
});

function requestIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (request.headers.get("cf-connecting-ip") || forwarded || request.headers.get("x-real-ip") || "").slice(0, 128) || null;
}

async function commentsFor(videoId: string) {
  return db.select({
    id: feedbackComments.id,
    videoId: feedbackComments.videoId,
    authorId: feedbackComments.authorId,
    savedDisplayName: feedbackComments.displayName,
    accountName: users.name,
    timestampMs: feedbackComments.timestampMs,
    timestampEndMs: feedbackComments.timestampEndMs,
    body: feedbackComments.body,
    resolved: feedbackComments.resolved,
    createdAt: feedbackComments.createdAt,
    updatedAt: feedbackComments.updatedAt,
  }).from(feedbackComments)
    .leftJoin(users, eq(feedbackComments.authorId, users.id))
    .where(and(eq(feedbackComments.videoId, videoId), eq(feedbackComments.status, "visible")))
    .orderBy(asc(feedbackComments.createdAt));
}

function publicComment(row: Awaited<ReturnType<typeof commentsFor>>[number]) {
  const { savedDisplayName, accountName, ...comment } = row;
  return {
    ...comment,
    authorName: savedDisplayName?.trim() || accountName?.trim() || "Anonymous",
  };
}

async function blockedOrRateLimited(ip: string | null) {
  if (!ip) return null;

  const [blocked] = await db.select({ id: blockedFeedbackIps.id }).from(blockedFeedbackIps)
    .where(eq(blockedFeedbackIps.ipAddress, ip)).limit(1);
  if (blocked) return { status: 403, error: "Feedback is unavailable from this network." };

  const now = Date.now();
  const minute = await db.select({ id: feedbackComments.id }).from(feedbackComments)
    .where(and(eq(feedbackComments.ipAddress, ip), gte(feedbackComments.createdAt, new Date(now - 60_000))))
    .limit(5);
  if (minute.length >= 5) return { status: 429, error: "You are leaving feedback a little too quickly. Try again in a minute." };

  const hour = await db.select({ id: feedbackComments.id }).from(feedbackComments)
    .where(and(eq(feedbackComments.ipAddress, ip), gte(feedbackComments.createdAt, new Date(now - 3_600_000))))
    .limit(30);
  if (hour.length >= 30) return { status: 429, error: "Feedback limit reached for this hour. Try again later." };

  return null;
}

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const current = await apiSessionUser(request);
  const { id } = await ctx.params;
  const access = await getFeedbackRequestAccess(id, current?.id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (current && access.role === "reviewer") {
    await db.update(feedbackAssignments).set({ seenAt: new Date() })
      .where(and(eq(feedbackAssignments.videoId, id), eq(feedbackAssignments.reviewerUserId, current.id)));
  }

  return NextResponse.json({ comments: (await commentsFor(id)).map(publicComment) });
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const current = await apiSessionUser(request);
  const { id } = await ctx.params;
  const access = await getFeedbackRequestAccess(id, current?.id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = commentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Write a comment before posting." }, { status: 400 });

  const timestampMs = parsed.data.timestampMs ?? null;
  const timestampEndMs = parsed.data.timestampEndMs ?? null;
  if (timestampEndMs !== null && (timestampMs === null || timestampEndMs < timestampMs)) {
    return NextResponse.json({ error: "The selected feedback range is invalid." }, { status: 400 });
  }

  const lastTimestamp = timestampEndMs ?? timestampMs;
  if (lastTimestamp !== null && access.video.durationMs && lastTimestamp > access.video.durationMs + 1000) {
    return NextResponse.json({ error: "Timestamp is outside the video." }, { status: 400 });
  }

  const ipAddress = requestIp(request);
  const throttle = await blockedOrRateLimited(ipAddress);
  if (throttle) return NextResponse.json({ error: throttle.error }, { status: throttle.status });

  const displayName = parsed.data.displayName?.trim() || current?.name?.trim() || "Anonymous";
  const [created] = await db.insert(feedbackComments).values({
    videoId: id,
    authorId: current?.id ?? null,
    displayName,
    reviewerKey: parsed.data.reviewerKey?.trim() || null,
    body: parsed.data.body,
    timestampMs,
    timestampEndMs,
    ipAddress,
    userAgent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
  }).returning();

  return NextResponse.json({
    comment: {
      id: created.id,
      videoId: created.videoId,
      authorId: created.authorId,
      authorName: displayName,
      timestampMs: created.timestampMs,
      timestampEndMs: created.timestampEndMs,
      body: created.body,
      resolved: created.resolved,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    },
  }, { status: 201 });
}
