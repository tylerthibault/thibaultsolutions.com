"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteFeedbackVideoButton({
  videoId,
  returnTo,
  compact = false,
}: {
  videoId: string;
  returnTo?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    if (!window.confirm("Delete this video permanently? All comments, assignments, and view history for it will also be deleted.")) return;

    setBusy(true);
    setError("");

    const response = await fetch(`/api/feedback/videos/${videoId}`, {
      method: "DELETE",
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setBusy(false);
      setError(result.error ?? "Could not delete video.");
      return;
    }

    if (returnTo) {
      router.push(returnTo);
    }
    router.refresh();
  }

  return <div className={compact ? "feedback-delete-video compact" : "feedback-delete-video"}>
    <button
      className={compact ? "feedback-delete-video-btn compact" : "feedback-delete-video-btn"}
      type="button"
      disabled={busy}
      onClick={remove}
    >
      {busy ? "DELETING…" : compact ? "DELETE" : "DELETE VIDEO"}
    </button>
    {error && <small className="error">{error}</small>}
  </div>;
}
