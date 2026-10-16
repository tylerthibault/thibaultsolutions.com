import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { eq } from "drizzle-orm";
import { apiSessionUser } from "@/src/lib/api-auth";
import { db } from "@/src/lib/db";
import { getFeedbackRequestAccess } from "@/src/lib/feedback-public";
import { getTikTokThumbnail } from "@/src/lib/feedback-tiktok-thumbnail";
import { mediaAssets } from "@/src/lib/schema";
import { storagePath } from "@/src/lib/storage";

export const runtime = "nodejs";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const current = await apiSessionUser(request);
  const { id } = await ctx.params;
  const access = await getFeedbackRequestAccess(id, current?.id);
  if (!access) return new Response("Not found", { status: 404 });

  // Linked TikTok covers are cached locally instead of returning expiring CDN URLs.
  // Use the same video access guard as uploaded thumbnails.
  if (access.video.sourceType === "link" && access.video.provider === "tiktok" && access.video.sourceUrl) {
    const image = await getTikTokThumbnail(id, access.video.sourceUrl);
    if (!image) return new Response("Thumbnail unavailable", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
    return new Response(new Uint8Array(image.bytes), {
      headers: {
        "Content-Type": image.mimeType,
        "Content-Length": String(image.bytes.byteLength),
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  if (!access.video.assetId || access.video.sourceType !== "upload") {
    return new Response("Not found", { status: 404 });
  }
  const [asset] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, access.video.assetId)).limit(1);
  if (!asset?.thumbnailKey) return new Response("Not found", { status: 404 });

  const file = storagePath("thumbnails", asset.thumbnailKey);
  const info = await stat(file).catch(() => null);
  if (!info) return new Response("Thumbnail unavailable", { status: 404 });
  return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(info.size),
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
