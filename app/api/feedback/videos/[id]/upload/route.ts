import { createWriteStream } from "node:fs";
import { rename, unlink } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiSectionUser } from "@/src/lib/api-auth";
import { isCreativeCircleAdmin } from "@/src/lib/auth";
import { db } from "@/src/lib/db";
import { feedbackVideos, mediaAssets } from "@/src/lib/schema";
import { ensureStorage, fileSize, storagePath } from "@/src/lib/storage";
import { makeThumbnail, probeVideo } from "@/src/lib/video";

export const runtime = "nodejs";
const allowed = new Map([["video/mp4", ".mp4"], ["video/quicktime", ".mov"], ["video/x-m4v", ".m4v"], ["video/webm", ".webm"]]);

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const current = await apiSectionUser(request, "feedback");
  if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isCreativeCircleAdmin(current.email)) {
    return NextResponse.json({ error: "Only the Creative Circle admin can upload feedback videos." }, { status: 403 });
  }

  const { id } = await ctx.params;
  const [video] = await db.select().from(feedbackVideos).where(and(eq(feedbackVideos.id, id), eq(feedbackVideos.ownerId, current.id))).limit(1);
  if (!video) return NextResponse.json({ error: "Feedback video not found." }, { status: 404 });
  if (video.sourceType !== "upload") return NextResponse.json({ error: "This feedback item uses an external link." }, { status: 409 });

  const mime = (request.headers.get("content-type") ?? "").split(";")[0].trim();
  const ext = allowed.get(mime);
  if (!ext) return NextResponse.json({ error: "Unsupported video type. Use MP4, MOV, M4V, or WebM." }, { status: 415 });
  const originalName = decodeURIComponent(request.headers.get("x-file-name") ?? `upload${ext}`).slice(0, 240);
  if (!new Set([".mp4", ".mov", ".m4v", ".webm"]).has(path.extname(originalName).toLowerCase())) return NextResponse.json({ error: "Unsupported file extension." }, { status: 415 });

  const max = Number(process.env.MAX_UPLOAD_SIZE ?? 2147483648);
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length && length > max) return NextResponse.json({ error: "File is larger than the configured upload limit." }, { status: 413 });
  if (!request.body) return NextResponse.json({ error: "Missing upload body." }, { status: 400 });

  await ensureStorage();
  const key = `${randomUUID()}${ext}`;
  const tempKey = `${randomUUID()}.upload`;
  const tempPath = storagePath("temp", tempKey);
  let seen = 0;
  const source = Readable.fromWeb(request.body as never);
  source.on("data", (chunk: Buffer) => { seen += chunk.length; if (seen > max) source.destroy(new Error("Upload too large")); });

  try {
    await pipeline(source, createWriteStream(tempPath, { flags: "wx" }));
    const meta = await probeVideo(tempPath);
    const finalPath = storagePath("uploads", key);
    await rename(tempPath, finalPath);
    const thumbKey = `${randomUUID()}.jpg`;
    await makeThumbnail(finalPath, storagePath("thumbnails", thumbKey));
    const sizeBytes = await fileSize("uploads", key);
    const [asset] = await db.insert(mediaAssets).values({
      ownerId: current.id, originalName, storageKey: key, thumbnailKey: thumbKey, mimeType: mime, sizeBytes, ...meta,
    }).returning();
    await db.update(feedbackVideos).set({ assetId: asset.id, durationMs: meta.durationMs, updatedAt: new Date() }).where(eq(feedbackVideos.id, id));
    return NextResponse.json({ asset }, { status: 201 });
  } catch (error) {
    await unlink(tempPath).catch(() => undefined);
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message.includes("too large") ? "Upload exceeded configured limit." : "Video could not be validated." }, { status: message.includes("too large") ? 413 : 422 });
  }
}
