import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { getSession } from "@/src/lib/auth";
import { db } from "@/src/lib/db";
import { getFeedbackRequestAccess } from "@/src/lib/feedback-public";
import { parseFeedbackLink } from "@/src/lib/feedback-links";
import { feedbackAssignments, feedbackComments, feedbackViews, user as users } from "@/src/lib/schema";
import { CcNav } from "@/src/components/CcNav";
import { FeedbackReview } from "@/src/components/FeedbackReview";
import { FeedbackVisibilityToggle } from "@/src/components/FeedbackVisibilityToggle";
import { DeleteFeedbackVideoButton } from "@/src/components/DeleteFeedbackVideoButton";

function durationLabel(durationMs: number | null, provider: string | null) {
  if (!durationMs) return provider ? provider.toUpperCase() : "VIDEO";
  const total = Math.max(0, Math.floor(durationMs / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export default async function FeedbackVideoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const current = session?.user ?? null;
  const { id } = await params;
  const access = await getFeedbackRequestAccess(id, current?.id);
  if (!access) notFound();

  const [owner] = await db.select({ name: users.name }).from(users)
    .where(eq(users.id, access.video.ownerId)).limit(1);

  const [rawComments, assignments] = await Promise.all([
    db.select({
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
      .where(and(eq(feedbackComments.videoId, id), eq(feedbackComments.status, "visible")))
      .orderBy(asc(feedbackComments.createdAt)),
    db.select({ id: feedbackAssignments.id })
      .from(feedbackAssignments)
      .where(eq(feedbackAssignments.videoId, id)),
  ]);

  const comments = rawComments.map(({ savedDisplayName, accountName, ...comment }) => ({
    ...comment,
    authorName: savedDisplayName?.trim() || accountName?.trim() || "Anonymous",
  }));

  if (current && access.role === "reviewer") {
    const seenAt = new Date();
    await db.insert(feedbackViews)
      .values({ videoId: id, viewerUserId: current.id, seenAt })
      .onConflictDoUpdate({
        target: [feedbackViews.videoId, feedbackViews.viewerUserId],
        set: { seenAt },
      });

    if (access.assignment) {
      await db.update(feedbackAssignments).set({ seenAt }).where(eq(feedbackAssignments.id, access.assignment.id));
    }
  }

  const linked = access.video.sourceUrl ? parseFeedbackLink(access.video.sourceUrl) : null;
  const addedLabel = access.video.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const reviewerLabel = access.role === "guest"
    ? "PUBLIC REVIEW"
    : access.role === "owner"
      ? "YOUR VIDEO"
      : `FROM ${owner?.name ?? "YOUR CIRCLE"}`;

  return <><CcNav userEmail={current?.email}/><main className="cc-main feedback-review-shell">
    <div className="feedback-review-head">
      <div>
        <span className="micro muted">{reviewerLabel}</span>
        <h1>{access.video.title}</h1>
        <div className="feedback-video-meta">
          <span>◷ {durationLabel(access.video.durationMs, access.video.provider)}</span>
          {access.role !== "guest" && <><i>•</i><span>♙ {assignments.length} {assignments.length === 1 ? "reviewer" : "reviewers"}</span></>}
          <i>•</i>
          <span>▣ {comments.length} {comments.length === 1 ? "comment" : "comments"}</span>
          <i>•</i>
          <span>＋ Added {addedLabel}</span>
        </div>
      </div>
      <div className="feedback-review-head-actions">
        {access.role === "owner" && <FeedbackVisibilityToggle videoId={access.video.id} initialPublic={access.video.isPublic}/>}
        {access.role === "owner" && <DeleteFeedbackVideoButton videoId={access.video.id} returnTo="/creative-circle/review"/>}
        <span className="micro" style={{ color: "var(--lime)" }}>{comments.filter((comment) => !comment.resolved).length} OPEN NOTES</span>
      </div>
    </div>
    <FeedbackReview
      video={{
        id: access.video.id,
        sourceType: access.video.sourceType,
        sourceUrl: access.video.sourceUrl,
        provider: access.video.provider,
        durationMs: access.video.durationMs,
        embedUrl: linked?.embedUrl ?? null,
        thumbnailUrl: access.video.thumbnailUrl,
      }}
      initialComments={comments}
      currentUser={current ? { id: current.id, name: current.name, email: current.email } : null}
      role={access.role}
    />
  </main></>;
}
