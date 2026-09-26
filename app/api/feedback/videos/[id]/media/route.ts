import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { eq } from "drizzle-orm";
import { apiSectionUser } from "@/src/lib/api-auth";
import { db } from "@/src/lib/db";
import { getFeedbackVideoAccess } from "@/src/lib/feedback-access";
import { getFeedbackPlaybackState } from "@/src/lib/feedback-playback";
import { mediaAssets } from "@/src/lib/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function byteRange(header: string, size: number) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (!match[1] && !match[2])) return null;

  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return null;
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }

  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(requestedEnd)) return null;

  const end = Math.min(requestedEnd, size - 1);
  if (start < 0 || start > end || start >= size) return null;
  return { start, end };
}

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const current = await apiSectionUser(request, "feedback");
  if (!current) return new Response("Unauthorized", { status: 401 });

  const { id } = await ctx.params;
  const access = await getFeedbackVideoAccess(id, current.id);
  if (!access?.video.assetId) return new Response("Not found", { status: 404 });

  const [asset] = await db.select().from(mediaAssets)
    .where(eq(mediaAssets.id, access.video.assetId))
    .limit(1);
  if (!asset) return new Response("Not found", { status: 404 });

  const playback = await getFeedbackPlaybackState(asset);

  if (playback.status === "missing") {
    console.error("Feedback Lab media source is missing from storage", {
      videoId: id,
      assetId: asset.id,
      storageKey: asset.storageKey,
      mediaStoragePath: process.env.MEDIA_STORAGE_PATH ?? "/data",
    });
    return new Response("Feedback video file is missing from media storage.", { status: 410 });
  }

  if (playback.status !== "ready" || !playback.file) {
    return new Response("Video playback is not ready yet.", {
      status: 409,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const info = await stat(playback.file);
  const rangeHeader = request.headers.get("range");

  if (rangeHeader) {
    const range = byteRange(rangeHeader, info.size);
    if (!range) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${info.size}` },
      });
    }

    const stream = Readable.toWeb(createReadStream(playback.file, {
      start: range.start,
      end: range.end,
    })) as ReadableStream;

    return new Response(stream, {
      status: 206,
      headers: {
        "Content-Type": "video/mp4",
        "Accept-Ranges": "bytes",
        "Content-Range": `bytes ${range.start}-${range.end}/${info.size}`,
        "Content-Length": String(range.end - range.start + 1),
        "Cache-Control": "private, no-store",
        "Content-Disposition": "inline",
      },
    });
  }

  return new Response(Readable.toWeb(createReadStream(playback.file)) as ReadableStream, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(info.size),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
    },
  });
}
