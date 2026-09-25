import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { requireSectionUser } from "@/src/lib/auth";
import { db } from "@/src/lib/db";
import { getFeedbackVideoAccess } from "@/src/lib/feedback-access";
import { parseFeedbackLink } from "@/src/lib/feedback-links";
import { feedbackAssignments, feedbackComments, user as users } from "@/src/lib/schema";
import { CcNav } from "@/src/components/CcNav";
import { FeedbackReview } from "@/src/components/FeedbackReview";
import { FeedbackVisibilityToggle } from "@/src/components/FeedbackVisibilityToggle";

export default async function FeedbackVideoPage({ params }: { params: Promise<{ id: string }> }) {
  const current = await requireSectionUser("feedback");
  const { id } = await params;
  const access = await getFeedbackVideoAccess(id, current.id);
  if (!access) notFound();

  const [owner] = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, access.video.ownerId)).limit(1);
  const comments = await db.select({
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
    .where(eq(feedbackComments.videoId, id))
    .orderBy(asc(feedbackComments.createdAt));

  if (access.role === "reviewer" && access.assignment) {
    await db.update(feedbackAssignments).set({ seenAt: new Date() }).where(eq(feedbackAssignments.id, access.assignment.id));
  }

  const linked = access.video.sourceUrl ? parseFeedbackLink(access.video.sourceUrl) : null;
  return <><CcNav userEmail={current.email}/><main className="cc-main feedback-review-shell">
    <div className="feedback-review-head">
      <div><span className="micro muted">{access.role === "owner" ? "YOUR VIDEO" : `FROM ${owner?.name ?? "YOUR CIRCLE"}`}</span><h1>{access.video.title}</h1></div>
      <div className="feedback-review-head-actions">
        {access.role === "owner" && <FeedbackVisibilityToggle videoId={access.video.id} initialPublic={access.video.isPublic}/>} 
        <span className="micro" style={{ color: "var(--lime)" }}>{comments.filter((c) => !c.resolved).length} OPEN NOTES</span>
      </div>
    </div>
    <FeedbackReview
      video={{ id: access.video.id, sourceType: access.video.sourceType, sourceUrl: access.video.sourceUrl, provider: access.video.provider, durationMs: access.video.durationMs, embedUrl: linked?.embedUrl ?? null }}
      initialComments={comments}
      currentUser={{ id: current.id, name: current.name, email: current.email }}
      role={access.role}
    />
  </main></>;
}
