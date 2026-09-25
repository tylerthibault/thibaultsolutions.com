import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { isCreativeCircleAdmin, requireSectionUser } from "@/src/lib/auth";
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
  const admin = isCreativeCircleAdmin(current.email);

  const owned = admin
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

  return <><CcNav userEmail={current.email}/><main className="cc-main">
    <section className="feedback-hero">
      <div>
        <span className="micro" style={{ color: "var(--lime)" }}>FEEDBACK ROOM / PRIVATE REVIEW</span>
        <h1>{admin ? <>MAKE IT.<br/><em>BETTER.</em></> : <>YOUR<br/><em>REVIEW QUEUE.</em></>}</h1>
        <p className="muted">
          {admin
            ? "Add a video, assign the people you want feedback from, and collect timestamped notes."
            : "Watch the videos assigned to you and leave comments tied to exact moments. Commenter accounts cannot add or assign videos."}
        </p>
        <div className="actions">
          {admin && <Link className="btn primary" href="/creative-circle/review/new">ADD VIDEO ↘</Link>}
          {admin && <Link className="btn" href="/creative-circle/admin">MANAGE ACCESS</Link>}
          <SignOutButton/>
        </div>
      </div>
      <aside className="cc-panel">
        <span className="micro muted">{admin ? "THE LOOP" : "COMMENTER ACCESS"}</span>
        <div className="feedback-loop">
          {admin ? <>
            <b>01</b><span>ADD OR LINK VIDEO</span>
            <b>02</b><span>ASSIGN COMMENTERS</span>
            <b>03</b><span>COLLECT TIMESTAMPED NOTES</span>
            <b>04</b><span>REVISE + RESOLVE</span>
          </> : <>
            <b>01</b><span>OPEN AN ASSIGNED VIDEO</span>
            <b>02</b><span>PAUSE AT THE MOMENT</span>
            <b>03</b><span>LEAVE YOUR COMMENT</span>
            <b>04</b><span>MOVE TO THE NEXT NOTE</span>
          </>}
        </div>
      </aside>
    </section>

    {admin && <>
      <div className="section-head feedback-section-head"><div><span>01 / YOUR VIDEOS</span><h2>OUT FOR <b>REVIEW.</b></h2></div></div>
      {owned.length === 0
        ? <div className="empty"><p>No feedback videos yet.</p><Link className="btn primary" href="/creative-circle/review/new">ADD YOUR FIRST VIDEO</Link></div>
        : <div className="feedback-grid">{owned.map((video) => <Link className="feedback-card" href={`/creative-circle/review/video/${video.id}`} key={video.id}>
            <div className="feedback-card-art"><SourceBadge type={video.sourceType} provider={video.provider}/><strong>{video.title}</strong></div>
            <div className="feedback-card-meta"><span>{video.status.toUpperCase()}</span><span>{new Date(video.updatedAt).toLocaleDateString()}</span></div>
          </Link>)}</div>}
    </>}

    <section style={{ marginTop: admin ? 60 : 0 }}>
      <div className="section-head feedback-section-head"><div><span>{admin ? "02" : "01"} / WAITING FOR YOUR EYES</span><h2>REVIEW <b>QUEUE.</b></h2></div></div>
      {assigned.length === 0
        ? <div className="empty"><p>No videos are waiting for your feedback right now.</p></div>
        : <div className="feedback-grid">{assigned.map(({ video, ownerName, seenAt }) => <Link className="feedback-card" href={`/creative-circle/review/video/${video.id}`} key={video.id}>
            <div className="feedback-card-art"><SourceBadge type={video.sourceType} provider={video.provider}/><strong>{video.title}</strong><small className="muted">FROM {ownerName.toUpperCase()}</small></div>
            <div className="feedback-card-meta"><span>{seenAt ? "VIEWED" : "NEW"}</span><span>{new Date(video.updatedAt).toLocaleDateString()}</span></div>
          </Link>)}</div>}
    </section>
  </main></>;
}
