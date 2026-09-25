"use client";

import { useEffect, useRef, useState } from "react";

type Comment = {
  id: string; videoId: string; authorId: string; authorName: string; authorEmail: string;
  timestampMs: number | null; body: string; resolved: boolean; createdAt: string | Date; updatedAt: string | Date;
};
type Video = { id: string; sourceType: string; sourceUrl: string | null; provider: string | null; durationMs: number | null; embedUrl: string | null };

type YouTubePlayer = {
  pauseVideo: () => void;
  playVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  destroy?: () => void;
};

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLIFrameElement,
        options?: { events?: { onReady?: () => void } },
      ) => YouTubePlayer;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

function timeLabel(ms: number | null) {
  if (ms === null) return "GENERAL";
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function youtubeEmbedUrl(url: string | null) {
  if (!url) return null;
  return `${url}${url.includes("?") ? "&" : "?"}enablejsapi=1&playsinline=1`;
}

export function FeedbackReview({ video, initialComments, currentUser, role }: {
  video: Video; initialComments: Comment[]; currentUser: { id: string; name: string; email: string }; role: "owner" | "reviewer";
}) {
  const player = useRef<HTMLVideoElement | null>(null);
  const iframePlayer = useRef<HTMLIFrameElement | null>(null);
  const youtubePlayer = useRef<YouTubePlayer | null>(null);
  const commentInput = useRef<HTMLTextAreaElement | null>(null);

  const [comments, setComments] = useState(initialComments.map((c) => ({ ...c, createdAt: new Date(c.createdAt).toISOString(), updatedAt: new Date(c.updatedAt).toISOString() })));
  const [body, setBody] = useState("");
  const [currentMs, setCurrentMs] = useState(0);
  const [capturedMs, setCapturedMs] = useState<number | null>(null);
  const [timelineReady, setTimelineReady] = useState(video.sourceType === "upload");
  const [composerOpen, setComposerOpen] = useState(false);
  const [generalNote, setGeneralNote] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const canAutoTimestamp = video.sourceType === "upload" || video.provider === "tiktok" || video.provider === "youtube";
  const shownTimestamp = generalNote ? null : capturedMs;

  useEffect(() => {
    if (video.provider !== "tiktok") return;

    function receiveTikTokMessage(event: MessageEvent) {
      if (event.origin !== "https://www.tiktok.com" || event.source !== iframePlayer.current?.contentWindow) return;
      if (!isRecord(event.data) || event.data["x-tiktok-player"] !== true || event.data.type !== "onCurrentTime") return;
      if (!isRecord(event.data.value) || typeof event.data.value.currentTime !== "number") return;

      setCurrentMs(Math.round(event.data.value.currentTime * 1000));
      setTimelineReady(true);
    }

    window.addEventListener("message", receiveTikTokMessage);
    return () => window.removeEventListener("message", receiveTikTokMessage);
  }, [video.provider]);

  useEffect(() => {
    if (video.provider !== "youtube" || !iframePlayer.current) return;

    let disposed = false;
    let timer: number | null = null;
    const priorReady = window.onYouTubeIframeAPIReady;

    function attachPlayer() {
      if (disposed || !iframePlayer.current || !window.YT?.Player || youtubePlayer.current) return;
      youtubePlayer.current = new window.YT.Player(iframePlayer.current, {
        events: {
          onReady: () => {
            if (disposed) return;
            setTimelineReady(true);
          },
        },
      });
      timer = window.setInterval(() => {
        const seconds = youtubePlayer.current?.getCurrentTime();
        if (typeof seconds === "number" && Number.isFinite(seconds)) {
          setCurrentMs(Math.round(seconds * 1000));
          setTimelineReady(true);
        }
      }, 250);
    }

    if (window.YT?.Player) {
      attachPlayer();
    } else {
      const existing = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]');
      if (!existing) {
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        script.async = true;
        document.head.appendChild(script);
      }
      window.onYouTubeIframeAPIReady = () => {
        priorReady?.();
        attachPlayer();
      };
    }

    return () => {
      disposed = true;
      if (timer !== null) window.clearInterval(timer);
      youtubePlayer.current?.destroy?.();
      youtubePlayer.current = null;
      if (window.onYouTubeIframeAPIReady !== priorReady) window.onYouTubeIframeAPIReady = priorReady;
    };
  }, [video.provider]);

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

    if (video.sourceType === "upload" && player.current) {
      player.current.pause();
      ms = Math.round(player.current.currentTime * 1000);
      setCurrentMs(ms);
      setTimelineReady(true);
    } else if (video.provider === "tiktok") {
      iframePlayer.current?.contentWindow?.postMessage(
        { type: "pause", "x-tiktok-player": true },
        "https://www.tiktok.com",
      );
      if (timelineReady) ms = currentMs;
    } else if (video.provider === "youtube" && youtubePlayer.current) {
      youtubePlayer.current.pauseVideo();
      const seconds = youtubePlayer.current.getCurrentTime();
      if (Number.isFinite(seconds)) {
        ms = Math.round(seconds * 1000);
        setCurrentMs(ms);
        setTimelineReady(true);
      }
    }

    setCapturedMs(ms);
    setGeneralNote(!canAutoTimestamp || ms === null);
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
    if (ms === null) return;

    if (video.sourceType === "upload" && player.current) {
      player.current.currentTime = ms / 1000;
      player.current.play().catch(() => undefined);
      return;
    }

    if (video.provider === "tiktok") {
      const target = iframePlayer.current?.contentWindow;
      target?.postMessage({ type: "seekTo", value: ms / 1000, "x-tiktok-player": true }, "https://www.tiktok.com");
      target?.postMessage({ type: "play", "x-tiktok-player": true }, "https://www.tiktok.com");
      return;
    }

    if (video.provider === "youtube" && youtubePlayer.current) {
      youtubePlayer.current.seekTo(ms / 1000, true);
      youtubePlayer.current.playVideo();
    }
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
  const iframeSrc = video.provider === "youtube" ? youtubeEmbedUrl(video.embedUrl) : video.embedUrl;

  return <div className="feedback-review-grid">
    <section className="feedback-player-panel">
      <div className="feedback-player">
        {video.sourceType === "upload" ? (
          <video
            ref={player}
            controls
            src={`/api/feedback/videos/${video.id}/media`}
            onTimeUpdate={(event) => {
              setCurrentMs(Math.round(event.currentTarget.currentTime * 1000));
              setTimelineReady(true);
            }}
          />
        ) : iframeSrc ? (
          <iframe
            ref={iframePlayer}
            src={iframeSrc}
            title="Linked short"
            allow="autoplay; encrypted-media; picture-in-picture"
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

            {!canAutoTimestamp && <p className="muted comment-timing-note">This player does not expose its playback time, so this will be saved as a general note.</p>}

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
          {canAutoTimestamp && timelineReady ? `+ COMMENT @ ${timeLabel(currentMs)}` : "+ COMMENT"}
        </button>
      </div>
    </section>

    <aside className="feedback-comments">
      <div className="panel-head"><strong>OPEN NOTES</strong><span className="micro muted">{open.length}</span></div>
      <div className="feedback-comment-list">
        {open.length === 0 ? <p className="muted" style={{ padding: 16 }}>Nothing open. Either everyone loves it or they have not started yet.</p> : open.map((comment) => <article className="feedback-comment" key={comment.id}>
          <div className="feedback-comment-top">
            <button className={comment.timestampMs === null ? "timestamp-pill general" : "timestamp-pill"} onClick={() => seek(comment.timestampMs)} disabled={comment.timestampMs === null || (!canAutoTimestamp && video.sourceType !== "upload")}>{timeLabel(comment.timestampMs)}</button>
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
