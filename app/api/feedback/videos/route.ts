import { and, desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiSectionUser } from "@/src/lib/api-auth";
import { isCreativeCircleAdmin } from "@/src/lib/auth";
import { db } from "@/src/lib/db";
import { feedbackAssignments, feedbackVideos, feedbackViews, user as users } from "@/src/lib/schema";
import { parseFeedbackLink, resolveFeedbackThumbnail } from "@/src/lib/feedback-links";

const createSchema = z.object({
  title: z.string().trim().min(1).max(140),
  sourceType: z.enum(["upload", "link"]),
  sourceUrl: z.string().trim().max(2000).optional(),
  reviewerIds: z.array(z.string().min(1).max(200)).max(25).default([]),
});

export async function GET(request: Request) {
  const current = await apiSectionUser(request, "feedback");
  if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owned = isCreativeCircleAdmin(current.email)
    ? await db.select().from(feedbackVideos)
        .where(eq(feedbackVideos.ownerId, current.id))
        .orderBy(desc(feedbackVideos.updatedAt))
    : [];

  const assigned = await db.select({
    video: feedbackVideos,
    ownerName: users.name,
    ownerEmail: users.email,
    seenAt: feedbackAssignments.seenAt,
  }).from(feedbackAssignments)
    .innerJoin(feedbackVideos, eq(feedbackAssignments.videoId, feedbackVideos.id))
    .innerJoin(users, eq(feedbackVideos.ownerId, users.id))
    .where(eq(feedbackAssignments.reviewerUserId, current.id))
    .orderBy(desc(feedbackAssignments.createdAt));

  const publicVideos = isCreativeCircleAdmin(current.email) ? [] : await db.select({
    video: feedbackVideos,
    ownerName: users.name,
    ownerEmail: users.email,
  }).from(feedbackVideos)
    .innerJoin(users, eq(feedbackVideos.ownerId, users.id))
    .where(eq(feedbackVideos.isPublic, true))
    .orderBy(desc(feedbackVideos.updatedAt));

  const views = await db.select({
    videoId: feedbackViews.videoId,
    seenAt: feedbackViews.seenAt,
  }).from(feedbackViews).where(eq(feedbackViews.viewerUserId, current.id));
  const seenByVideo = new Map(views.map((view) => [view.videoId, view.seenAt]));

  const assignedIds = new Set(assigned.map((item) => item.video.id));
  const queue = [
    ...assigned.map((item) => ({
      ...item,
      seenAt: seenByVideo.get(item.video.id) ?? item.seenAt,
      publicListing: false,
    })),
    ...publicVideos
      .filter((item) => !assignedIds.has(item.video.id))
      .map((item) => ({
        ...item,
        seenAt: seenByVideo.get(item.video.id) ?? null,
        publicListing: true,
      })),
  ];

  return NextResponse.json({ owned, assigned: queue });
}

export async function POST(request: Request) {
  const current = await apiSectionUser(request, "feedback");
  if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isCreativeCircleAdmin(current.email)) {
    return NextResponse.json({ error: "Only the Creative Circle admin can add feedback videos." }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the video title and source." }, { status: 400 });

  let sourceUrl: string | null = null;
  let provider: string | null = null;
  let thumbnailUrl: string | null = null;
  if (parsed.data.sourceType === "link") {
    const linked = parseFeedbackLink(parsed.data.sourceUrl ?? "");
    if (!linked) return NextResponse.json({ error: "Use a valid YouTube, TikTok, or Instagram video link." }, { status: 400 });
    sourceUrl = linked.canonicalUrl;
    provider = linked.provider;
    thumbnailUrl = await resolveFeedbackThumbnail(linked);
  }

  const [video] = await db.insert(feedbackVideos).values({
    ownerId: current.id,
    title: parsed.data.title,
    sourceType: parsed.data.sourceType,
    sourceUrl,
    provider,
    thumbnailUrl,
  }).returning();

  const requested = [...new Set(parsed.data.reviewerIds)].filter((id) => id !== current.id);
  if (requested.length) {
    const valid = await db.select({ id: users.id }).from(users)
      .where(and(
        inArray(users.id, requested),
        eq(users.creativeCircleFeedbackAccess, true),
      ));

    if (valid.length) {
      await db.insert(feedbackAssignments)
        .values(valid.map((member) => ({ videoId: video.id, reviewerUserId: member.id })))
        .onConflictDoNothing();
    }
  }

  return NextResponse.json({ video }, { status: 201 });
}
