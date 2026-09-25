import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { isCreativeCircleAdmin, requireSectionUser } from "@/src/lib/auth";
import { db } from "@/src/lib/db";
import { feedbackAssignments, feedbackVideos, feedbackViews, mediaAssets, user as users } from "@/src/lib/schema";
import { CcNav } from "@/src/components/CcNav";
import { SignOutButton } from "@/src/components/SignOutButton";
import { parseFeedbackLink, resolveFeedbackOrientation, resolveFeedbackThumbnail, type FeedbackOrientation } from "@/src/lib/feedback-links";
import { DeleteFeedbackVideoButton } from "@/src/components/DeleteFeedbackVideoButton";

async function thumbnailFor(video: typeof feedbackVideos.$inferSelect) {
  if (video.sourceType === "upload" && video.assetId) {
    return `/api/feedback/videos/${video.id}/thumbnail`;
  }
  if (video.thumbnailUrl) return video.thumbnailUrl;
  if (!video.sourceUrl) return null;

  const linked = parseFeedbackLink(video.sourceUrl);
  if (!linked) return null;
  const thumbnail = await resolveFeedbackThumbnail(linked);
  if (thumbnail) {
    await db.update(feedbackVideos)
      .set({ thumbnailUrl: thumbnail })
      .where(eq(feedbackVideos.id, video.id));
  }
  return thumbnail;
}

function VideoThumb({
  src,
  title,
  orientation,
}: {
  src: string | null;
  title: string;
  orientation: FeedbackOrientation;
}) {
  const className = `feedback-card-thumb ${orientation}`;
  if (!src) return <div className={`${className} fallback`}><span>NO PREVIEW</span></div>;
  return <div className={className}>
    <img src={src} alt="" loading="lazy"/>
    <span className="feedback-thumb-play">▶</span>
    <span className="sr-only">{title}</span>
  </div>;
}

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

  const publicVideos = admin ? [] : await db.select({
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
  const reviewQueue = [
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
  ].sort((a, b) => new Date(b.video.updatedAt).getTime() - new Date(a.video.updatedAt).getTime());

  const ownedThumbs = new Map(await Promise.all(owned.map(async (video) => [video.id, await thumbnailFor(video)] as const)));
  const queueThumbs = new Map(await Promise.all(reviewQueue.map(async ({ video }) => [video.id, await thumbnailFor(video)] as const)));

  const allVideos = [
    ...owned,
    ...reviewQueue.map(({ video }) => video),
  ];
  const uniqueVideos = [...new Map(allVideos.map((video) => [video.id, video])).values()];
  const assetIds = [...new Set(uniqueVideos.map((video) => video.assetId).filter((id): id is string => Boolean(id)))];
  const assets = assetIds.length
    ? await db.select({
        id: mediaAssets.id,
        width: mediaAssets.width,
        height: mediaAssets.height,
      }).from(mediaAssets).where(inArray(mediaAssets.id, assetIds))
    : [];
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));

  async function orientationFor(video: typeof feedbackVideos.$inferSelect): Promise<FeedbackOrientation> {
    if (video.sourceType === "upload" && video.assetId) {
      const asset = assetsById.get(video.assetId);
      if (asset) {
        const ratio = asset.width / asset.height;
        if (ratio < 0.9) return "portrait";
        if (ratio > 1.1) return "landscape";
        return "square";
      }
    }

    if (video.sourceUrl) {
      const linked = parseFeedbackLink(video.sourceUrl);
      if (linked) return resolveFeedbackOrientation(linked);
    }

    return video.provider === "tiktok" || video.provider === "instagram" ? "portrait" : "landscape";
  }

  const orientations = new Map(await Promise.all(
    uniqueVideos.map(async (video) => [video.id, await orientationFor(video)] as const),
  ));

  return <><CcNav userEmail={current.email}/><main className="cc-main">
    <section className="feedback-hero">
      <div>
        <span className="micro" style={{ color: "var(--lime)" }}>FEEDBACK LAB / PRIVATE REVIEW</span>
        <h1>{admin ? <>MAKE IT.<br/><em>BETTER.</em></> : <>YOUR<br/><em>REVIEW QUEUE.</em></>}</h1>
        <p className="muted">
          {admin
            ? "Add a video, assign the people you want feedback from, and collect timestamped notes."
            : "Watch assigned videos and anything the admin marks public to commenters. Leave comments tied to exact moments; commenter accounts cannot add or assign videos."}
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
            <b>01</b><span>OPEN AN AVAILABLE VIDEO</span>
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
        : <div className="feedback-grid">{owned.map((video) => <div className="feedback-card-admin-wrap" key={video.id}>
            <Link className="feedback-card" href={`/creative-circle/review/video/${video.id}`}>
              <VideoThumb src={ownedThumbs.get(video.id) ?? null} title={video.title} orientation={orientations.get(video.id) ?? "landscape"}/>
              <div className="feedback-card-art compact"><SourceBadge type={video.sourceType} provider={video.provider}/><strong>{video.title}</strong></div>
              <div className="feedback-card-meta"><span>{video.status.toUpperCase()}</span><span>{new Date(video.updatedAt).toLocaleDateString()}</span></div>
            </Link>
            <DeleteFeedbackVideoButton videoId={video.id} compact/>
          </div>)}</div>}
    </>}

    <section style={{ marginTop: admin ? 60 : 0 }}>
      <div className="section-head feedback-section-head"><div><span>{admin ? "02" : "01"} / WAITING FOR YOUR EYES</span><h2>REVIEW <b>QUEUE.</b></h2></div></div>
      {reviewQueue.length === 0
        ? <div className="empty"><p>No videos are waiting for your feedback right now.</p></div>
        : <div className="feedback-grid">{reviewQueue.map(({ video, ownerName, seenAt, publicListing }) => <Link className="feedback-card" href={`/creative-circle/review/video/${video.id}`} key={video.id}>
            <VideoThumb src={queueThumbs.get(video.id) ?? null} title={video.title} orientation={orientations.get(video.id) ?? "landscape"}/>
            <div className="feedback-card-art compact"><SourceBadge type={video.sourceType} provider={video.provider}/><strong>{video.title}</strong><small className="muted">FROM {ownerName.toUpperCase()}</small></div>
            <div className="feedback-card-meta">
              <span className={seenAt ? "feedback-seen viewed" : "feedback-seen new"}>{seenAt ? "✓ VIEWED" : "● NEW / UNSEEN"}</span>
              <span>{publicListing ? "PUBLIC" : "ASSIGNED"} · {new Date(video.updatedAt).toLocaleDateString()}</span>
            </div>
          </Link>)}</div>}
    </section>
  </main></>;
}
