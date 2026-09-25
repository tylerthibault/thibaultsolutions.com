import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { requireSectionUser } from "@/src/lib/auth";
import { db } from "@/src/lib/db";
import { feedbackAssignments, feedbackVideos, user as users } from "@/src/lib/schema";
import { CcNav } from "@/src/components/CcNav";
import { SignOutButton } from "@/src/components/SignOutButton";

function SourceBadge({ type, provider }: { type: string; provider: string | null }) {
  const label = type === "upload" ? "UPLOADED VIDEO" : (provider ?? "LINK").toUpperCase();
  return <span className="micro" style={{ color: type === "upload" ? "var(--lime)" : "var(--cyan)" }}>{label}</span>;
}

export default async function FeedbackHome() {
  const current = await requireSectionUser("feedback");
  const owned = await db.select().from(feedbackVideos)
    .where(eq(feedbackVideos.ownerId, current.id))
    .orderBy(desc(feedbackVideos.updatedAt));
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

  return <><CcNav userEmail={current.email}/><main className="cc-main">
    <section className="feedback-hero">
      <div>
        <span className="micro" style={{ color: "var(--lime)" }}>FEEDBACK ROOM / PRIVATE REVIEW</span>
        <h1>MAKE IT.<br/><em>BETTER.</em></h1>
        <p className="muted">Upload a short or link one from YouTube, TikTok, or Instagram. Your circle can watch it and leave notes tied to exact moments.</p>
        <div className="actions">
          <Link className="btn primary" href="/creative-circle/review/new">ADD VIDEO ↘</Link>
          <Link className="btn" href="/creative-circle/review/reviewers">REVIEWERS</Link>
          <SignOutButton/>
        </div>
      </div>
      <aside className="cc-panel">
        <span className="micro muted">THE LOOP</span>
        <div className="feedback-loop">
          <b>01</b><span>UPLOAD OR LINK</span>
          <b>02</b><span>ASSIGN YOUR CIRCLE</span>
          <b>03</b><span>COLLECT TIMESTAMPED NOTES</span>
          <b>04</b><span>REVISE + RESOLVE</span>
        </div>
      </aside>
    </section>

    <div className="section-head feedback-section-head"><div><span>01 / YOUR VIDEOS</span><h2>OUT FOR <b>REVIEW.</b></h2></div></div>
    {owned.length === 0 ? <div className="empty"><p>No feedback videos yet.</p><Link className="btn primary" href="/creative-circle/review/new">ADD YOUR FIRST VIDEO</Link></div> :
      <div className="feedback-grid">{owned.map((video) => <Link className="feedback-card" href={`/creative-circle/review/video/${video.id}`} key={video.id}>
        <div className="feedback-card-art"><SourceBadge type={video.sourceType} provider={video.provider}/><strong>{video.title}</strong></div>
        <div className="feedback-card-meta"><span>{video.status.toUpperCase()}</span><span>{new Date(video.updatedAt).toLocaleDateString()}</span></div>
      </Link>)}</div>}

    {assigned.length > 0 && <section style={{ marginTop: 60 }}>
      <div className="section-head feedback-section-head"><div><span>02 / WAITING FOR YOUR EYES</span><h2>REVIEW <b>QUEUE.</b></h2></div></div>
      <div className="feedback-grid">{assigned.map(({ video, ownerName, seenAt }) => <Link className="feedback-card" href={`/creative-circle/review/video/${video.id}`} key={video.id}>
        <div className="feedback-card-art"><SourceBadge type={video.sourceType} provider={video.provider}/><strong>{video.title}</strong><small className="muted">FROM {ownerName.toUpperCase()}</small></div>
        <div className="feedback-card-meta"><span>{seenAt ? "VIEWED" : "NEW"}</span><span>{new Date(video.updatedAt).toLocaleDateString()}</span></div>
      </Link>)}</div>
    </section>}
  </main></>;
}
