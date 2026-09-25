import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiSectionUser } from "@/src/lib/api-auth";
import { isCreativeCircleAdmin } from "@/src/lib/auth";
import { db } from "@/src/lib/db";
import { feedbackVideos, mediaAssets, projects } from "@/src/lib/schema";
import { removeStored } from "@/src/lib/storage";

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const current = await apiSectionUser(request, "feedback");
  if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isCreativeCircleAdmin(current.email)) {
    return NextResponse.json({ error: "Only the Creative Circle admin can delete videos." }, { status: 403 });
  }

  const { id } = await ctx.params;
  const [video] = await db.select()
    .from(feedbackVideos)
    .where(and(eq(feedbackVideos.id, id), eq(feedbackVideos.ownerId, current.id)))
    .limit(1);

  if (!video) return NextResponse.json({ error: "Feedback video not found." }, { status: 404 });

  const assetId = video.assetId;

  await db.delete(feedbackVideos).where(and(
    eq(feedbackVideos.id, id),
    eq(feedbackVideos.ownerId, current.id),
  ));

  // Clean up any interrupted chunked upload for this video.
  await removeStored("temp", `${id}.upload`);

  if (assetId) {
    const [otherFeedbackReference] = await db.select({ id: feedbackVideos.id })
      .from(feedbackVideos)
      .where(eq(feedbackVideos.assetId, assetId))
      .limit(1);

    const [projectReference] = await db.select({ id: projects.id })
      .from(projects)
      .where(eq(projects.assetId, assetId))
      .limit(1);

    if (!otherFeedbackReference && !projectReference) {
      const [asset] = await db.select()
        .from(mediaAssets)
        .where(eq(mediaAssets.id, assetId))
        .limit(1);

      if (asset) {
        await Promise.all([
          removeStored("uploads", asset.storageKey),
          removeStored("thumbnails", asset.thumbnailKey),
        ]);
        await db.delete(mediaAssets).where(eq(mediaAssets.id, assetId));
      }
    }
  }

  return NextResponse.json({ ok: true, id });
}
