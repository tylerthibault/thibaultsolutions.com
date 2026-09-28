import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { eq } from "drizzle-orm";
import { apiSessionUser } from "@/src/lib/api-auth";
import { db } from "@/src/lib/db";
import { getFeedbackRequestAccess } from "@/src/lib/feedback-public";
import { mediaAssets } from "@/src/lib/schema";
import { storagePath } from "@/src/lib/storage";

export const runtime = "nodejs";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const current = await apiSessionUser(request);
  const { id } = await ctx.params;
  const access = await getFeedbackRequestAccess(id, current?.id);
  if (!access?.video.assetId) return new Response("Not found", { status: 404 });

  const [asset] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, access.video.assetId)).limit(1);
  if (!asset?.thumbnailKey) return new Response("Not found", { status: 404 });

  const file = storagePath("thumbnails", asset.thumbnailKey);
  const info = await stat(file);
  return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(info.size),
      "Cache-Control": "private, max-age=300",
    },
  });
}
