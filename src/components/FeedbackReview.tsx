"use client";

import { useRef, useState } from "react";

type Comment = {
  id: string; videoId: string; authorId: string; authorName: string; authorEmail: string;
  timestampMs: number | null; body: string; resolved: boolean; createdAt: string | Date; updatedAt: string | Date;
};
type Video = { id: string; sourceType: string; sourceUrl: string | null; provider: string | null; durationMs: number | null; embedUrl: string | null };

function timeLabel(ms: number | null) {
  if (ms === null) return "GENERAL";
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function FeedbackReview({ video, initialComments, currentUser, role }: {
  video: Video; initialComments: Comment[]; currentUser: { id: string; name: string; email: string }; role: "owner" | "reviewer";
}) {
  const player = useRef<HTMLVideoElement | null>(null);
  const [comments, setComments] = useState(initialComments.map((c) => ({ ...c, createdAt: new Date(c.createdAt).toISOString(), updatedAt: new Date(c.updatedAt).toISOString() })));
  const [body, setBody] = useState("");
  const [timestamped, setTimestamped] = useState(video.sourceType === "upload");
  const [currentMs, setCurrentMs] = useState(0);
  const [manualSeconds, setManualSeconds] = useState("");
  const [capturedMs, setCapturedMs] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function captureForComment() {
    if (video.sourceType !== "upload" || !player.current) return;
    player.current.pause();
    const ms = Math.round(player.current.currentTime * 1000);
    setCurrentMs(ms);
    setCapturedMs(ms);
  }

  function focusComment() {
    if (timestamped && video.sourceType === "upload") captureForComment();
  }

  async function postComment() {
    if (!body.trim()) return;
    setBusy(true);
    setError("");
    let timestampMs: number | null = null;
    if (timestamped) {
      if (video.sourceType === "upload") timestampMs = capturedMs ?? currentMs;
      else {
        const seconds = Number(manualSeconds);
        if (!Number.isFinite(seconds) || seconds < 0) { setBusy(false); setError("Enter the timestamp in seconds, or switch to a general comment."); return; }
        timestampMs = Math.round(seconds * 1000);
      }
    }
    const response = await fetch(`/api/feedback/videos/${video.id}/comments`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body, timestampMs }),
    });
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) { setError(result.error ?? "Could not post comment."); return; }
    setComments((current) => [...current, { ...result.comment, createdAt: new Date(result.comment.createdAt).toISOString(), updatedAt: new Date(result.comment.updatedAt).toISOString() }]);
    setBody("");
    setCapturedMs(null);
    setManualSeconds("");
  }

  function seek(ms: number | null) {
    if (ms === null || !player.current) return;
    player.current.currentTime = ms / 1000;
    player.current.play().catch(() => undefined);
  }

  async function resolve(commentId: string, resolved: boolean) {
    const response = await fetch(`/api/feedback/comments/${commentId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resolved }),
    });
    if (!response.ok) return;
    setComments((current) => current.map((comment) => comment.id === commentId ? { ...comment, resolved } : comment));
  }

  const open = comments.filter((comment) => !comment.resolved);
  const resolved = comments.filter((comment) => comment.resolved);

  return <div className="feedback-review-grid">
    <section className="feedback-player-panel">
      <div className="feedback-player">
        {video.sourceType === "upload" ? <video ref={player} controls src={`/api/feedback/videos/${video.id}/media`} onTimeUpdate={(event) => setCurrentMs(Math.round(event.currentTarget.currentTime * 1000))}/> :
          video.embedUrl ? <iframe src={video.embedUrl} title="Linked short" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen/> :
          <div className="empty">This linked video cannot be embedded.</div>}
      </div>
      {video.sourceType === "link" && video.sourceUrl && <a className="btn" href={video.sourceUrl} target="_blank" rel="noreferrer">OPEN ORIGINAL ↗</a>}
      <div className="feedback-composer cc-panel">
        <div className="feedback-composer-top">
          <div><span className="micro muted">LEAVE FEEDBACK</span><strong>{timestamped ? (video.sourceType === "upload" ? `AT ${timeLabel(capturedMs ?? currentMs)}` : "AT A TIMESTAMP") : "GENERAL NOTE"}</strong></div>
          <label className="comment-mode"><input type="checkbox" checked={timestamped} onChange={(e) => { setTimestamped(e.target.checked); if (!e.target.checked) setCapturedMs(null); }}/><span>TIMESTAMP</span></label>
        </div>
        {timestamped && video.sourceType === "link" && <div className="field"><label>Timestamp in seconds</label><input className="input" type="number" min="0" step="1" placeholder="e.g. 7" value={manualSeconds} onChange={(e) => setManualSeconds(e.target.value)}/></div>}
        <textarea className="feedback-textarea" value={body} onFocus={focusComment} onChange={(e) => setBody(e.target.value)} placeholder="What should change here?" maxLength={2000}/>
        {error && <div className="error">{error}</div>}
        <div className="feedback-composer-actions">
          {timestamped && video.sourceType === "upload" && <button className="btn" type="button" onClick={captureForComment}>CAPTURE {timeLabel(currentMs)}</button>}
          <button className="btn primary" type="button" disabled={busy || !body.trim()} onClick={postComment}>{busy ? "POSTING…" : "POST COMMENT ↘"}</button>
        </div>
      </div>
    </section>

    <aside className="feedback-comments">
      <div className="panel-head"><strong>OPEN NOTES</strong><span className="micro muted">{open.length}</span></div>
      <div className="feedback-comment-list">
        {open.length === 0 ? <p className="muted" style={{ padding: 16 }}>Nothing open. Either everyone loves it or they have not started yet.</p> : open.map((comment) => <article className="feedback-comment" key={comment.id}>
          <div className="feedback-comment-top">
            <button className={comment.timestampMs === null ? "timestamp-pill general" : "timestamp-pill"} onClick={() => seek(comment.timestampMs)} disabled={video.sourceType !== "upload" || comment.timestampMs === null}>{timeLabel(comment.timestampMs)}</button>
            <span>{comment.authorName}</span><time>{new Date(comment.createdAt).toLocaleString()}</time>
          </div>
          <p>{comment.body}</p>
          {role === "owner" && <button className="tiny-btn resolve-btn" onClick={() => resolve(comment.id, true)}>✓ MARK RESOLVED</button>}
        </article>)}
      </div>
      {resolved.length > 0 && <details className="resolved-notes"><summary>{resolved.length} RESOLVED NOTES</summary>{resolved.map((comment) => <article className="feedback-comment resolved" key={comment.id}>
        <div className="feedback-comment-top"><span className="timestamp-pill general">{timeLabel(comment.timestampMs)}</span><span>{comment.authorName}</span></div>
        <p>{comment.body}</p>{role === "owner" && <button className="tiny-btn" onClick={() => resolve(comment.id, false)}>REOPEN</button>}
      </article>)}</details>}
      <div className="feedback-reviewer-id micro muted">SIGNED IN AS {currentUser.name.toUpperCase()}</div>
    </aside>
  </div>;
}
