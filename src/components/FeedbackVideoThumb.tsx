"use client";

import { useState } from "react";
import type { FeedbackOrientation } from "@/src/lib/feedback-links";

export function FeedbackVideoThumb({
  src,
  title,
  orientation,
}: {
  src: string | null;
  title: string;
  orientation: FeedbackOrientation;
}) {
  const [failed, setFailed] = useState(false);
  const fallback = !src || failed;

  return <div className={"feedback-card-thumb " + orientation + (fallback ? " fallback" : "")}>
    {fallback
      ? <span>PREVIEW UNAVAILABLE</span>
      : <img src={src} alt="" loading="lazy" onError={() => setFailed(true)}/>}
    <span className="feedback-thumb-play" aria-hidden="true">▶</span>
    <span className="sr-only">{title}</span>
  </div>;
}
