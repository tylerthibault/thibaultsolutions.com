import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { feedbackAssignments, feedbackVideos } from "./schema";

export async function getFeedbackVideoAccess(videoId: string, userId: string) {
  const [video] = await db.select().from(feedbackVideos).where(eq(feedbackVideos.id, videoId)).limit(1);
  if (!video) return null;
  if (video.ownerId === userId) return { video, role: "owner" as const };
  const [assignment] = await db.select().from(feedbackAssignments)
    .where(and(eq(feedbackAssignments.videoId, videoId), eq(feedbackAssignments.reviewerUserId, userId)))
    .limit(1);
  if (!assignment) return null;
  return { video, role: "reviewer" as const, assignment };
}
