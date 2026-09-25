import { createReadStream } from "node:fs";
import { randomUUID } from "node:crypto";
import { rename, stat, unlink } from "node:fs/promises";
import { Readable } from "node:stream";
import { eq } from "drizzle-orm";
import { apiSectionUser } from "@/src/lib/api-auth";
import { db } from "@/src/lib/db";
import { getFeedbackVideoAccess } from "@/src/lib/feedback-access";
import { mediaAssets } from "@/src/lib/schema";
import { ensureStorage, storagePath } from "@/src/lib/storage";
import { makeBrowserPlaybackCopy } from "@/src/lib/video";

export const runtime = "nodejs";

const globalForFeedbackPlayback = globalThis as unknown as {
  feedbackPlaybackJobs?: Map<string, Promise<void>>;
};

const playbackJobs = globalForFeedbackPlayback.feedbackPlaybackJobs ?? new Map<string, Promise<void>>();
if (!globalForFeedbackPlayback.feedbackPlaybackJobs) {
  globalForFeedbackPlayback.feedbackPlaybackJobs = playbackJobs;
}

async function exists(file: string) {
  return stat(file).catch(() => null);
}

async function ensureBrowserCopy(asset: { id: string; codec: string; storageKey: string }) {
  await ensureStorage();
  const source = storagePath("uploads", asset.storageKey);
  const target = storagePath("renders", `${asset.id}.feedback-browser.mp4`);

  if (await exists(target)) return target;

  let job = playbackJobs.get(asset.id);
  if (!job) {
    job = (async () => {
      const temp = storagePath("temp", `${asset.id}.${randomUUID()}.feedback-browser.mp4`);
      try {
        await makeBrowserPlaybackCopy(source, temp, asset.codec);
        try {
          await rename(temp, target);
        } catch (error) {
          if (!(await exists(target))) throw error;
          await unlink(temp).catch(() => undefined);
        }
      } finally {
        await unlink(temp).catch(() => undefined);
      }
    })().finally(() => {
      playbackJobs.delete(asset.id);
    });
    playbackJobs.set(asset.id, job);
  }

  await job;
  return target;
}

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

  const source = storagePath("uploads", asset.storageKey);
  const sourceInfo = await exists(source);
  if (!sourceInfo) {
    console.error("Feedback Lab media source is missing from storage", {
      videoId: id,
      assetId: asset.id,
      storageKey: asset.storageKey,
      mediaStoragePath: process.env.MEDIA_STORAGE_PATH ?? "/data",
    });
    return new Response("Feedback video file is missing from media storage. Re-upload the video.", { status: 410 });
  }

  let file = source;
  let contentType = asset.mimeType;

  // Legacy uploads were stored exactly as supplied. MOV/HEVC/WebM can validate
  // server-side but fail in Chromium/Brave, so cache a browser-safe MP4 for them.
  const browserSafe = asset.mimeType === "video/mp4" && asset.codec.toLowerCase() === "h264";
  if (!browserSafe) {
    try {
      file = await ensureBrowserCopy({
        id: asset.id,
        codec: asset.codec,
        storageKey: asset.storageKey,
      });
      contentType = "video/mp4";
    } catch (error) {
      console.error("Feedback Lab browser playback conversion failed", {
        videoId: id,
        assetId: asset.id,
        codec: asset.codec,
        mimeType: asset.mimeType,
        error,
      });
      return new Response("Video could not be prepared for browser playback.", { status: 500 });
    }
  }

  const info = await stat(file);
  const rangeHeader = request.headers.get("range");

  if (rangeHeader) {
    const range = byteRange(rangeHeader, info.size);
    if (!range) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${info.size}` },
      });
    }

    const stream = Readable.toWeb(createReadStream(file, {
      start: range.start,
      end: range.end,
    })) as ReadableStream;

    return new Response(stream, {
      status: 206,
      headers: {
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
        "Content-Range": `bytes ${range.start}-${range.end}/${info.size}`,
        "Content-Length": String(range.end - range.start + 1),
        "Cache-Control": "private, no-store",
        "Content-Disposition": "inline",
      },
    });
  }

  return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(info.size),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
    },
  });
}
