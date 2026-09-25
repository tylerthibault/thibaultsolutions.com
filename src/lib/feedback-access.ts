import { and, eq } from "drizzle-orm";
import { isCreativeCircleAdmin } from "./auth";
import { db } from "./db";
import { feedbackAssignments, feedbackVideos, user as users } from "./schema";

export async function getFeedbackVideoAccess(videoId: string, userId: string) {
  const [video] = await db.select().from(feedbackVideos).where(eq(feedbackVideos.id, videoId)).limit(1);
  if (!video) return null;

  const [viewer] = await db.select({
    email: users.email,
    feedbackAccess: users.creativeCircleFeedbackAccess,
  }).from(users).where(eq(users.id, userId)).limit(1);

  if (video.ownerId === userId && viewer && isCreativeCircleAdmin(viewer.email)) {
    return { video, role: "owner" as const };
  }

  const [assignment] = await db.select().from(feedbackAssignments)
    .where(and(eq(feedbackAssignments.videoId, videoId), eq(feedbackAssignments.reviewerUserId, userId)))
    .limit(1);

  if (assignment) {
    return { video, role: "reviewer" as const, assignment, accessMode: "assigned" as const };
  }

  if (video.isPublic && viewer?.feedbackAccess) {
    return { video, role: "reviewer" as const, assignment: null, accessMode: "public" as const };
  }

  return null;
}
