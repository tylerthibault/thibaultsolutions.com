import { eq } from "drizzle-orm";
import { db } from "./db";
import { getFeedbackVideoAccess } from "./feedback-access";
import { feedbackVideos } from "./schema";

export type FeedbackRequestRole = "owner" | "reviewer" | "guest";

export async function getFeedbackRequestAccess(videoId: string, userId?: string | null) {
  if (userId) {
    const memberAccess = await getFeedbackVideoAccess(videoId, userId);
    if (memberAccess) return memberAccess;
  }

  const [video] = await db.select().from(feedbackVideos)
    .where(eq(feedbackVideos.id, videoId))
    .limit(1);

  if (!video || !video.isPublic || video.status !== "open") return null;
  return { video, role: "guest" as const };
}
