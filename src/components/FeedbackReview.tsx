"use client";

import { useEffect, useRef, useState } from "react";

type Comment = {
  id: string; videoId: string; authorId: string; authorName: string; authorEmail: string;
  timestampMs: number | null; body: string; resolved: boolean; createdAt: string | Date; updatedAt: string | Date;
};
type Video = {
  id: string;
  sourceType: string;
  sourceUrl: string | null;
  provider: string | null;
  durationMs: number | null;
  embedUrl: string | null;
};
type PlaybackStatus = "checking" | "preparing" | "ready" | "missing" | "error";

function timeLabel(ms: number | null) {
  if (ms === null) return "GENERAL";
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function platformEmbedUrl(video: Video) {
  if (!video.embedUrl) return null;

  try {
    const url = new URL(video.embedUrl);

    if (video.provider === "youtube") {
      url.search = "";
      url.searchParams.set("playsinline", "1");
      url.searchParams.set("rel", "0");
    }

    if (video.provider === "tiktok") {
      // Keep TikTok's native controls. We only use postMessage below to hold the
      // current video before its end screen appears.
      url.search = "";
      url.searchParams.set("controls", "1");
      url.searchParams.set("progress_bar", "1");
      url.searchParams.set("play_button", "1");
      url.searchParams.set("volume_control", "1");
      url.searchParams.set("fullscreen_button", "1");
      url.searchParams.set("timestamp", "1");
      url.searchParams.set("loop", "0");
      url.searchParams.set("rel", "0");
    }

    return url.toString();
  } catch {
    return video.embedUrl;
  }
}

export function FeedbackReview({ video, initialComments, currentUser, role }: {
  video: Video;
  initialComments: Comment[];
  currentUser: { id: string; name: string; email: string };
  role: "owner" | "reviewer";
}) {
  const player = useRef<HTMLVideoElement | null>(null);
  const socialFrame = useRef<HTMLIFrameElement | null>(null);
  const commentInput = useRef<HTMLTextAreaElement | null>(null);
  const retryTimer = useRef<number | null>(null);
  const tiktokDuration = useRef<number | null>(null);
  const tiktokHeldAtEnd = useRef(false);

  const [comments, setComments] = useState(initialComments.map((c) => ({
    ...c,
    createdAt: new Date(c.createdAt).toISOString(),
    updatedAt: new Date(c.updatedAt).toISOString(),
  })));
  const [body, setBody] = useState("");
  const [currentMs, setCurrentMs] = useState(0);
  const [capturedMs, setCapturedMs] = useState<number | null>(null);
  const [timelineReady, setTimelineReady] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [generalNote, setGeneralNote] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [playbackStatus, setPlaybackStatus] = useState<PlaybackStatus>(
    video.sourceType === "upload" ? "checking" : "ready",
  );
  const [playbackDetail, setPlaybackDetail] = useState("");
  const [playbackAttempt, setPlaybackAttempt] = useState(0);

  const canAutoTimestamp = video.sourceType === "upload" && playbackStatus === "ready" && timelineReady;
  const shownTimestamp = generalNote ? null : capturedMs;
  const iframeSrc = platformEmbedUrl(video);

  useEffect(() => {
    if (video.sourceType !== "upload") return;

    let cancelled = false;

    async function check(start: boolean) {
      try {
        const response = await fetch(`/api/feedback/videos/${video.id}/prepare`, {
          method: start ? "POST" : "GET",
          cache: "no-store",
        });
        const result = await response.json().catch(() => ({}));

        if (cancelled) return;
        if (!response.ok) {
          setPlaybackStatus("error");
          setPlaybackDetail(result.error ?? "Could not check video playback.");
          return;
        }

        const status = result.status as string;
        if (status === "ready") {
          setPlaybackStatus("ready");
          setPlaybackDetail("");
          return;
        }

        if (status === "missing") {
          setPlaybackStatus("missing");
          setPlaybackDetail("The uploaded file is missing from server storage. Check the persistent /data volume, then re-upload this video if the file was lost.");
          return;
        }

        if (status === "error") {
          setPlaybackStatus("error");
          setPlaybackDetail("The server could not prepare this video for browser playback. Check the application logs for the FFmpeg error.");
          return;
        }

        setPlaybackStatus("preparing");
        setPlaybackDetail("Preparing a browser-compatible copy. You can leave this page open.");

        if (retryTimer.current !== null) window.clearTimeout(retryTimer.current);
        retryTimer.current = window.setTimeout(() => {
          void check(status === "needs_preparation");
        }, 1500);
      } catch {
        if (!cancelled) {
          setPlaybackStatus("error");
          setPlaybackDetail("Could not reach the video preparation endpoint.");
        }
      }
    }

    void check(true);

    return () => {
      cancelled = true;
      if (retryTimer.current !== null) {
        window.clearTimeout(retryTimer.current);
        retryTimer.current = null;
      }
    };
  }, [video.id, video.sourceType, playbackAttempt]);

  useEffect(() => {
    if (video.provider !== "tiktok") return;

    const iframe = socialFrame.current;
    const contentWindow = iframe?.contentWindow;
    if (!iframe || !contentWindow) return;

    const targetOrigin = "https://www.tiktok.com";

    function send(type: "pause" | "play" | "seekTo", value?: number) {
      contentWindow.postMessage(
        value === undefined
          ? { type, "x-tiktok-player": true }
          : { type, value, "x-tiktok-player": true },
        targetOrigin,
      );
    }

    function holdBeforeRecommendations(duration: number) {
      const holdAt = Math.max(0, duration - 0.35);
      send("pause");
      send("seekTo", holdAt);
      tiktokHeldAtEnd.current = true;
    }

    function onMessage(event: MessageEvent) {
      if (event.origin !== targetOrigin || event.source !== contentWindow) return;
      const data = event.data;
      if (!data || typeof data !== "object" || data["x-tiktok-player"] !== true) return;

      if (data.type === "onCurrentTime" && data.value && typeof data.value === "object") {
        const currentTime = Number(data.value.currentTime);
        const duration = Number(data.value.duration);

        if (Number.isFinite(duration) && duration > 0) {
          tiktokDuration.current = duration;

          if (Number.isFinite(currentTime) && currentTime < duration - 1) {
            tiktokHeldAtEnd.current = false;
          }

          if (
            Number.isFinite(currentTime) &&
            !tiktokHeldAtEnd.current &&
            currentTime >= duration - 0.45
          ) {
            holdBeforeRecommendations(duration);
          }
        }
        return;
      }

      if (data.type === "onStateChange" && data.value === 0) {
        const duration = tiktokDuration.current;
        if (duration) holdBeforeRecommendations(duration);
        return;
      }

      // If the viewer presses play while we're parked on the last frame, replay
      // the same TikTok instead of allowing the recommendation screen to take over.
      if (data.type === "onStateChange" && data.value === 1 && tiktokHeldAtEnd.current) {
        tiktokHeldAtEnd.current = false;
        send("seekTo", 0);
        send("play");
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [video.provider, iframeSrc]);

  useEffect(() => {
    if (!composerOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setComposerOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [composerOpen]);

  function pauseAndCapture() {
    let ms: number | null = null;

    if (video.sourceType === "upload" && player.current && playbackStatus === "ready") {
      player.current.pause();
      ms = Math.round(player.current.currentTime * 1000);
      setCurrentMs(ms);
    }

    setCapturedMs(ms);
    setGeneralNote(ms === null);
    setError("");
    setComposerOpen(true);
    window.requestAnimationFrame(() => commentInput.current?.focus());
  }

  async function postComment() {
    if (!body.trim()) return;
    setBusy(true);
    setError("");

    const timestampMs = generalNote ? null : capturedMs;
    const response = await fetch(`/api/feedback/videos/${video.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, timestampMs }),
    });
    const result = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      setError(result.error ?? "Could not post comment.");
      return;
    }

    setComments((current) => [...current, {
      ...result.comment,
      createdAt: new Date(result.comment.createdAt).toISOString(),
      updatedAt: new Date(result.comment.updatedAt).toISOString(),
    }]);
    setBody("");
    setCapturedMs(null);
    setGeneralNote(false);
    setComposerOpen(false);
  }

  function seek(ms: number | null) {
    if (ms === null || video.sourceType !== "upload" || !player.current || playbackStatus !== "ready") return;
    player.current.currentTime = ms / 1000;
    player.current.play().catch(() => undefined);
  }

  async function resolve(commentId: string, resolvedValue: boolean) {
    const response = await fetch(`/api/feedback/comments/${commentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolved: resolvedValue }),
    });
    if (!response.ok) return;
    setComments((current) => current.map((comment) =>
      comment.id === commentId ? { ...comment, resolved: resolvedValue } : comment
    ));
  }

  async function deleteComment(commentId: string) {
    if (!window.confirm("Delete this comment permanently?")) return;
    const response = await fetch(`/api/feedback/comments/${commentId}`, { method: "DELETE" });
    if (!response.ok) return;
    setComments((current) => current.filter((comment) => comment.id !== commentId));
  }

  const open = comments.filter((comment) => !comment.resolved);
  const resolved = comments.filter((comment) => comment.resolved);

  return <div className="feedback-review-grid">
    <section className="feedback-player-panel">
      <div className="feedback-player">
        {video.sourceType === "upload" ? (
          playbackStatus === "ready" ? (
            <video
              key={playbackAttempt}
              ref={player}
              className="feedback-native-video"
              controls
              playsInline
              preload="metadata"
              src={`/api/feedback/videos/${video.id}/media?player=3`}
              onLoadedMetadata={() => setTimelineReady(true)}
              onTimeUpdate={(event) => setCurrentMs(Math.round(event.currentTarget.currentTime * 1000))}
              onError={() => {
                setTimelineReady(false);
                setPlaybackStatus("error");
                setPlaybackDetail("The media endpoint returned a file the browser could not play. Check the Network response and server logs.");
              }}
            />
          ) : (
            <div className={`feedback-playback-status ${playbackStatus}`}>
              <span className="micro" style={{ color: "var(--lime)" }}>
                {playbackStatus === "missing" ? "VIDEO FILE MISSING" : playbackStatus === "error" ? "PLAYBACK ERROR" : "PREPARING VIDEO"}
              </span>
              <strong>
                {playbackStatus === "checking" ? "Checking video…" : playbackStatus === "preparing" ? "Making this video browser-ready…" : "This video is not ready to play."}
              </strong>
              {playbackDetail && <p>{playbackDetail}</p>}
              {(playbackStatus === "error" || playbackStatus === "missing") && <button
                className="btn"
                type="button"
                onClick={() => {
                  setTimelineReady(false);
                  setPlaybackStatus("checking");
                  setPlaybackDetail("");
                  setPlaybackAttempt((value) => value + 1);
                }}
              >
                RETRY
              </button>}
            </div>
          )
        ) : iframeSrc ? (
          <iframe
            ref={socialFrame}
            className="feedback-social-frame"
            src={iframeSrc}
            title="Linked short"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        ) : (
          <div className="empty">This linked video cannot be embedded.</div>
        )}

        {composerOpen && <div className="feedback-comment-overlay">
          <div className="feedback-comment-popover" role="dialog" aria-modal="true" aria-labelledby="feedback-comment-title">
            <div className="feedback-comment-popover-head">
              <div>
                <span className="micro muted">LEAVE FEEDBACK</span>
                <strong id="feedback-comment-title">{generalNote ? "GENERAL NOTE" : `COMMENT AT ${timeLabel(shownTimestamp)}`}</strong>
              </div>
              <button className="comment-close-btn" type="button" aria-label="Close comment" onClick={() => setComposerOpen(false)}>×</button>
            </div>

            {canAutoTimestamp && capturedMs !== null && <div className="comment-mode-tabs" role="group" aria-label="Comment type">
              <button className={!generalNote ? "active" : ""} type="button" onClick={() => setGeneralNote(false)}>@ {timeLabel(capturedMs)}</button>
              <button className={generalNote ? "active" : ""} type="button" onClick={() => setGeneralNote(true)}>GENERAL</button>
            </div>}

            {!canAutoTimestamp && <p className="muted comment-timing-note">
              Linked platform players use their own controls. Feedback on linked videos is saved as a general note.
            </p>}

            <textarea
              ref={commentInput}
              className="feedback-textarea"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="What should change here?"
              maxLength={2000}
            />
            {error && <div className="error">{error}</div>}
            <div className="feedback-composer-actions">
              <button className="btn" type="button" onClick={() => setComposerOpen(false)}>CANCEL</button>
              <button className="btn primary" type="button" disabled={busy || !body.trim()} onClick={postComment}>
                {busy ? "POSTING…" : "POST COMMENT ↘"}
              </button>
            </div>
          </div>
        </div>}
      </div>

      <div className="feedback-player-actions">
        {video.sourceType === "link" && video.sourceUrl && <a className="btn" href={video.sourceUrl} target="_blank" rel="noreferrer">OPEN ORIGINAL ↗</a>}
        <button className="btn primary feedback-comment-trigger" type="button" onClick={pauseAndCapture}>
          {canAutoTimestamp ? `+ COMMENT @ ${timeLabel(currentMs)}` : "+ COMMENT"}
        </button>
      </div>
    </section>

    <aside className="feedback-comments">
      <div className="panel-head"><strong>OPEN NOTES</strong><span className="micro muted">{open.length}</span></div>
      <div className="feedback-comment-list">
        {open.length === 0 ? <p className="muted" style={{ padding: 16 }}>Nothing open. Either everyone loves it or they have not started yet.</p> : open.map((comment) => <article className="feedback-comment" key={comment.id}>
          <div className="feedback-comment-top">
            <button
              className={comment.timestampMs === null ? "timestamp-pill general" : "timestamp-pill"}
              onClick={() => seek(comment.timestampMs)}
              disabled={comment.timestampMs === null || video.sourceType !== "upload" || playbackStatus !== "ready"}
            >
              {timeLabel(comment.timestampMs)}
            </button>
            <span>{comment.authorName}</span>
            <time>{new Date(comment.createdAt).toLocaleString()}</time>
          </div>
          <p>{comment.body}</p>
          {role === "owner" && <div className="feedback-comment-admin-actions">
            <button className="tiny-btn resolve-btn" onClick={() => resolve(comment.id, true)}>✓ MARK RESOLVED</button>
            <button className="tiny-btn delete-comment-btn" onClick={() => deleteComment(comment.id)}>DELETE</button>
          </div>}
        </article>)}
      </div>

      {resolved.length > 0 && <details className="resolved-notes">
        <summary>{resolved.length} RESOLVED NOTES</summary>
        {resolved.map((comment) => <article className="feedback-comment resolved" key={comment.id}>
          <div className="feedback-comment-top">
            <span className="timestamp-pill general">{timeLabel(comment.timestampMs)}</span>
            <span>{comment.authorName}</span>
          </div>
          <p>{comment.body}</p>
          {role === "owner" && <div className="feedback-comment-admin-actions">
            <button className="tiny-btn" onClick={() => resolve(comment.id, false)}>REOPEN</button>
            <button className="tiny-btn delete-comment-btn" onClick={() => deleteComment(comment.id)}>DELETE</button>
          </div>}
        </article>)}
      </details>}

      <div className="feedback-reviewer-id micro muted">SIGNED IN AS {currentUser.name.toUpperCase()}</div>
    </aside>
  </div>;
}
