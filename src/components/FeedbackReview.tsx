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

type YouTubePlayerStateEvent = { data: number };
type YouTubePlayer = {
  pauseVideo: () => void;
  playVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  destroy?: () => void;
};

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLIFrameElement,
        options?: {
          events?: {
            onReady?: () => void;
            onStateChange?: (event: YouTubePlayerStateEvent) => void;
          };
        },
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
  const params = "enablejsapi=1&playsinline=1&controls=0&fs=0&rel=0&disablekb=1";
  return `${url}${url.includes("?") ? "&" : "?"}${params}`;
}

export function FeedbackReview({ video, initialComments, currentUser, role }: {
  video: Video;
  initialComments: Comment[];
  currentUser: { id: string; name: string; email: string };
  role: "owner" | "reviewer";
}) {
  const player = useRef<HTMLVideoElement | null>(null);
  const iframePlayer = useRef<HTMLIFrameElement | null>(null);
  const youtubePlayer = useRef<YouTubePlayer | null>(null);
  const stage = useRef<HTMLDivElement | null>(null);
  const commentInput = useRef<HTMLTextAreaElement | null>(null);
  const tiktokDurationSeconds = useRef<number | null>(null);
  const tiktokEndHeld = useRef(false);

  const [comments, setComments] = useState(initialComments.map((c) => ({
    ...c,
    createdAt: new Date(c.createdAt).toISOString(),
    updatedAt: new Date(c.updatedAt).toISOString(),
  })));
  const [body, setBody] = useState("");
  const [currentMs, setCurrentMs] = useState(0);
  const [durationMs, setDurationMs] = useState(video.durationMs ?? 0);
  const [capturedMs, setCapturedMs] = useState<number | null>(null);
  const [timelineReady, setTimelineReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [generalNote, setGeneralNote] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const canControlPlayer = video.sourceType === "upload" || video.provider === "tiktok" || video.provider === "youtube";
  const canAutoTimestamp = canControlPlayer;
  const shownTimestamp = generalNote ? null : capturedMs;

  useEffect(() => {
    if (video.provider !== "tiktok") return;

    function holdTikTokOnLastFrame(duration: number) {
      const target = iframePlayer.current?.contentWindow;
      const holdAt = Math.max(0, duration - 0.12);
      target?.postMessage({ type: "pause", "x-tiktok-player": true }, "https://www.tiktok.com");
      target?.postMessage({ type: "seekTo", value: holdAt, "x-tiktok-player": true }, "https://www.tiktok.com");
      setCurrentMs(Math.round(holdAt * 1000));
      setIsPlaying(false);
      tiktokEndHeld.current = true;
    }

    function receiveTikTokMessage(event: MessageEvent) {
      if (event.origin !== "https://www.tiktok.com" || event.source !== iframePlayer.current?.contentWindow) return;
      if (!isRecord(event.data) || event.data["x-tiktok-player"] !== true) return;

      if (event.data.type === "onPlayerReady") {
        setTimelineReady(true);
        return;
      }

      if (event.data.type === "onCurrentTime" && isRecord(event.data.value) && typeof event.data.value.currentTime === "number") {
        const currentTime = event.data.value.currentTime;
        const duration = typeof event.data.value.duration === "number" ? event.data.value.duration : null;

        if (duration !== null && Number.isFinite(duration) && duration > 0) {
          tiktokDurationSeconds.current = duration;
          setDurationMs(Math.round(duration * 1000));
          if (currentTime < duration - 0.75) tiktokEndHeld.current = false;
          if (!tiktokEndHeld.current && currentTime >= duration - 0.18) {
            holdTikTokOnLastFrame(duration);
            return;
          }
        }

        setCurrentMs(Math.round(currentTime * 1000));
        setTimelineReady(true);
        return;
      }

      if (event.data.type === "onStateChange") {
        if (event.data.value === 1) {
          setIsPlaying(true);
          return;
        }
        if (event.data.value === 2) {
          setIsPlaying(false);
          return;
        }
        if (event.data.value === 0) {
          const duration = tiktokDurationSeconds.current;
          if (duration !== null) holdTikTokOnLastFrame(duration);
          else setIsPlaying(false);
        }
      }
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
            const duration = youtubePlayer.current?.getDuration();
            if (typeof duration === "number" && Number.isFinite(duration) && duration > 0) {
              setDurationMs(Math.round(duration * 1000));
            }
            setTimelineReady(true);
          },
          onStateChange: (event) => {
            if (disposed) return;
            if (event.data === 1) setIsPlaying(true);
            if (event.data === 2) setIsPlaying(false);
            if (event.data === 0) {
              const duration = youtubePlayer.current?.getDuration() ?? 0;
              if (duration > 0) {
                const holdAt = Math.max(0, duration - 0.12);
                youtubePlayer.current?.seekTo(holdAt, true);
                youtubePlayer.current?.pauseVideo();
                setCurrentMs(Math.round(holdAt * 1000));
              }
              setIsPlaying(false);
            }
          },
        },
      });

      timer = window.setInterval(() => {
        const seconds = youtubePlayer.current?.getCurrentTime();
        const duration = youtubePlayer.current?.getDuration();
        if (typeof seconds === "number" && Number.isFinite(seconds)) {
          setCurrentMs(Math.round(seconds * 1000));
          setTimelineReady(true);
        }
        if (typeof duration === "number" && Number.isFinite(duration) && duration > 0) {
          setDurationMs(Math.round(duration * 1000));
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

  function play() {
    if (video.sourceType === "upload" && player.current) {
      player.current.play().catch(() => undefined);
      return;
    }

    if (video.provider === "tiktok") {
      iframePlayer.current?.contentWindow?.postMessage(
        { type: "play", "x-tiktok-player": true },
        "https://www.tiktok.com",
      );
      return;
    }

    if (video.provider === "youtube") {
      youtubePlayer.current?.playVideo();
    }
  }

  function pause() {
    if (video.sourceType === "upload" && player.current) {
      player.current.pause();
      return;
    }

    if (video.provider === "tiktok") {
      iframePlayer.current?.contentWindow?.postMessage(
        { type: "pause", "x-tiktok-player": true },
        "https://www.tiktok.com",
      );
      return;
    }

    if (video.provider === "youtube") {
      youtubePlayer.current?.pauseVideo();
    }
  }

  function togglePlayback() {
    if (!canControlPlayer) return;
    if (isPlaying) pause();
    else play();
  }

  function seekTo(ms: number, autoplay = false) {
    const seconds = Math.max(0, ms / 1000);

    if (video.sourceType === "upload" && player.current) {
      player.current.currentTime = seconds;
      setCurrentMs(ms);
      if (autoplay) player.current.play().catch(() => undefined);
      return;
    }

    if (video.provider === "tiktok") {
      const target = iframePlayer.current?.contentWindow;
      target?.postMessage({ type: "seekTo", value: seconds, "x-tiktok-player": true }, "https://www.tiktok.com");
      setCurrentMs(ms);
      if (autoplay) {
        target?.postMessage({ type: "play", "x-tiktok-player": true }, "https://www.tiktok.com");
      }
      return;
    }

    if (video.provider === "youtube") {
      youtubePlayer.current?.seekTo(seconds, true);
      setCurrentMs(ms);
      if (autoplay) youtubePlayer.current?.playVideo();
    }
  }

  function pauseAndCapture() {
    let ms: number | null = null;

    if (video.sourceType === "upload" && player.current) {
      player.current.pause();
      ms = Math.round(player.current.currentTime * 1000);
      setCurrentMs(ms);
    } else if (video.provider === "tiktok") {
      pause();
      ms = timelineReady ? currentMs : null;
    } else if (video.provider === "youtube" && youtubePlayer.current) {
      youtubePlayer.current.pauseVideo();
      const seconds = youtubePlayer.current.getCurrentTime();
      if (Number.isFinite(seconds)) {
        ms = Math.round(seconds * 1000);
        setCurrentMs(ms);
      }
    }

    setIsPlaying(false);
    setCapturedMs(ms);
    setGeneralNote(!canAutoTimestamp || ms === null);
    setError("");
    setComposerOpen(true);
    window.requestAnimationFrame(() => commentInput.current?.focus());
  }

  async function toggleFullscreen() {
    if (!stage.current) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
    } else {
      await stage.current.requestFullscreen().catch(() => undefined);
    }
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
    if (ms === null || !canControlPlayer) return;
    seekTo(ms, true);
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

    const response = await fetch(`/api/feedback/comments/${commentId}`, {
      method: "DELETE",
    });
    if (!response.ok) return;

    setComments((current) => current.filter((comment) => comment.id !== commentId));
  }

  const open = comments.filter((comment) => !comment.resolved);
  const resolved = comments.filter((comment) => comment.resolved);
  const iframeSrc = video.provider === "youtube" ? youtubeEmbedUrl(video.embedUrl) : video.embedUrl;
  const rangeMax = Math.max(durationMs, currentMs, 1);

  return <div className="feedback-review-grid">
    <section className="feedback-player-panel">
      <div className="feedback-player">
        <div className="feedback-media-frame" ref={stage}>
          {video.sourceType === "upload" ? (
            <video
              ref={player}
              playsInline
              preload="metadata"
              src={`/api/feedback/videos/${video.id}/media`}
              onLoadedMetadata={(event) => {
                const duration = event.currentTarget.duration;
                if (Number.isFinite(duration) && duration > 0) {
                  setDurationMs(Math.round(duration * 1000));
                }
                setTimelineReady(true);
              }}
              onTimeUpdate={(event) => {
                setCurrentMs(Math.round(event.currentTarget.currentTime * 1000));
              }}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
            />
          ) : iframeSrc ? (
            <iframe
              ref={iframePlayer}
              className={canControlPlayer ? "feedback-controlled-iframe" : ""}
              src={iframeSrc}
              title="Linked short"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="empty">This linked video cannot be embedded.</div>
          )}

          {canControlPlayer && !isPlaying && !composerOpen && <button
            className="feedback-unified-paused"
            type="button"
            onClick={togglePlayback}
            aria-label="Play video"
          >
            <span className="feedback-unified-play">▶</span>
            <small>{timelineReady ? timeLabel(currentMs) : "LOADING"}</small>
          </button>}

          {composerOpen && <div className="feedback-comment-overlay">
            <div className="feedback-comment-popover" role="dialog" aria-modal="true" aria-labelledby="feedback-comment-title">
              <div className="feedback-comment-popover-head">
                <div>
                  <span className="micro muted">LEAVE FEEDBACK</span>
                  <strong id="feedback-comment-title">
                    {generalNote ? "GENERAL NOTE" : `COMMENT AT ${timeLabel(shownTimestamp)}`}
                  </strong>
                </div>
                <button className="comment-close-btn" type="button" aria-label="Close comment" onClick={() => setComposerOpen(false)}>×</button>
              </div>

              {canAutoTimestamp && capturedMs !== null && <div className="comment-mode-tabs" role="group" aria-label="Comment type">
                <button className={!generalNote ? "active" : ""} type="button" onClick={() => setGeneralNote(false)}>@ {timeLabel(capturedMs)}</button>
                <button className={generalNote ? "active" : ""} type="button" onClick={() => setGeneralNote(true)}>GENERAL</button>
              </div>}

              {!canAutoTimestamp && <p className="muted comment-timing-note">
                This platform does not expose playback time, so this will be saved as a general note.
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

          {canControlPlayer && <div className="feedback-custom-controls">
            <button className="feedback-control-button" type="button" onClick={togglePlayback} aria-label={isPlaying ? "Pause" : "Play"}>
              {isPlaying ? "Ⅱ" : "▶"}
            </button>
            <span className="feedback-control-time">{timeLabel(currentMs)} / {durationMs > 0 ? timeLabel(durationMs) : "--:--"}</span>
            <input
              className="feedback-progress-range"
              type="range"
              min={0}
              max={rangeMax}
              step={100}
              value={Math.min(currentMs, rangeMax)}
              onChange={(event) => seekTo(Number(event.target.value), false)}
              aria-label="Video progress"
            />
            <button className="feedback-control-button feedback-fullscreen-button" type="button" onClick={toggleFullscreen} aria-label="Fullscreen">⛶</button>
          </div>}

          {!canControlPlayer && <div className="feedback-platform-note">
            PLATFORM PLAYER · COMMENTS ARE GENERAL NOTES
          </div>}
        </div>
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
            <button
              className={comment.timestampMs === null ? "timestamp-pill general" : "timestamp-pill"}
              onClick={() => seek(comment.timestampMs)}
              disabled={comment.timestampMs === null || !canControlPlayer}
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
