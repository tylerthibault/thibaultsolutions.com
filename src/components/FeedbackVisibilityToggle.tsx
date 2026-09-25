"use client";

import { useState } from "react";

export function FeedbackVisibilityToggle({
  videoId,
  initialPublic,
}: {
  videoId: string;
  initialPublic: boolean;
}) {
  const [isPublic, setIsPublic] = useState(initialPublic);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    setBusy(true);
    setError("");

    const response = await fetch(`/api/feedback/videos/${videoId}/visibility`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublic: !isPublic }),
    });
    const result = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      setError(result.error ?? "Could not change visibility.");
      return;
    }

    setIsPublic(result.video.isPublic);
  }

  return <div className="feedback-visibility-control">
    <button
      className={isPublic ? "feedback-visibility-toggle public" : "feedback-visibility-toggle"}
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={isPublic}
    >
      <span className="feedback-visibility-dot"/>
      <span>{busy ? "SAVING…" : isPublic ? "PUBLIC TO COMMENTERS" : "PRIVATE / ASSIGNED ONLY"}</span>
    </button>
    {error && <small className="error">{error}</small>}
  </div>;
}
