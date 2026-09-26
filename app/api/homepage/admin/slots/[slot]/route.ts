import { createWriteStream } from "node:fs";
import { stat, unlink } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiSessionUser } from "@/src/lib/api-auth";
import { isCreativeCircleAdmin } from "@/src/lib/auth";
import { db } from "@/src/lib/db";
import { parseFeedbackLink, resolveFeedbackThumbnail } from "@/src/lib/feedback-links";
import { getHomepageUgcSlot } from "@/src/lib/homepage-slots";
import { homepageUgcSlots, mediaAssets } from "@/src/lib/schema";
import { ensureStorage, fileSize, removeStored, storagePath } from "@/src/lib/storage";
import { makeBrowserPlaybackCopy, makeThumbnail, probeVideo } from "@/src/lib/video";

export const runtime = "nodejs";

const allowed = new Map([
  ["video/mp4", ".mp4"],
  ["video/quicktime", ".mov"],
  ["video/x-m4v", ".m4v"],
  ["video/webm", ".webm"],
]);

async function requireAdmin(request: Request) {
  const current = await apiSessionUser(request);
  return current && isCreativeCircleAdmin(current.email) ? current : null;
}

async function currentSlot(slot: string) {
  const [row] = await db.select({
    assetId: homepageUgcSlots.assetId,
    sourceUrl: homepageUgcSlots.sourceUrl,
    storageKey: mediaAssets.storageKey,
    thumbnailKey: mediaAssets.thumbnailKey,
  }).from(homepageUgcSlots)
    .leftJoin(mediaAssets, eq(homepageUgcSlots.assetId, mediaAssets.id))
    .where(eq(homepageUgcSlots.slot, slot))
    .limit(1);
  return row ?? null;
}

async function removeAsset(asset: Awaited<ReturnType<typeof currentSlot>>) {
  if (!asset?.assetId) return;
  await Promise.all([
    removeStored("uploads", asset.storageKey),
    removeStored("thumbnails", asset.thumbnailKey),
  ]);
  await db.delete(mediaAssets).where(eq(mediaAssets.id, asset.assetId));
}

export async function POST(request: Request, ctx: { params: Promise<{ slot: string }> }) {
  const current = await requireAdmin(request);
  if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slot } = await ctx.params;
  if (!getHomepageUgcSlot(slot)) return NextResponse.json({ error: "Unknown homepage slot." }, { status: 404 });

  const uploadToken = request.headers.get("x-upload-token") ?? "";
  const chunkIndex = Number(request.headers.get("x-chunk-index"));
  const chunkCount = Number(request.headers.get("x-chunk-count"));
  const declaredSize = Number(request.headers.get("x-file-size"));
  const originalName = decodeURIComponent(request.headers.get("x-file-name") ?? "homepage-video.mp4").slice(0, 240);
  const mimeType = request.headers.get("x-file-type") ?? "video/mp4";

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uploadToken)) {
    return NextResponse.json({ error: "Invalid upload token." }, { status: 400 });
  }
  if (!Number.isInteger(chunkIndex) || !Number.isInteger(chunkCount) || chunkIndex < 0 || chunkCount < 1 || chunkIndex >= chunkCount) {
    return NextResponse.json({ error: "Invalid chunk metadata." }, { status: 400 });
  }

  const max = Number(process.env.MAX_UPLOAD_SIZE ?? 2147483648);
  if (!Number.isFinite(declaredSize) || declaredSize <= 0 || declaredSize > max) {
    return NextResponse.json({ error: "File is larger than the configured upload limit." }, { status: 413 });
  }
  if (!allowed.has(mimeType)) {
    return NextResponse.json({ error: "Use MP4, MOV, M4V, or WebM." }, { status: 415 });
  }
  if (!request.body) return NextResponse.json({ error: "Missing upload chunk." }, { status: 400 });

  await ensureStorage();
  const tempPath = storagePath("temp", `homepage.${slot}.${uploadToken}.upload`);

  try {
    if (chunkIndex === 0) await unlink(tempPath).catch(() => undefined);

    const before = chunkIndex === 0 ? 0 : (await stat(tempPath).catch(() => null))?.size ?? 0;
    const source = Readable.fromWeb(request.body as never);
    await pipeline(source, createWriteStream(tempPath, { flags: chunkIndex === 0 ? "w" : "a" }));

    const after = (await stat(tempPath)).size;
    if (after <= before || after > declaredSize || after > max) {
      throw new Error("Chunk write produced an invalid file size.");
    }

    console.info("Homepage UGC chunk stored", {
      slot,
      originalName,
      uploadToken,
      chunkIndex,
      chunkCount,
      bytesStored: after,
      declaredSize,
    });

    return NextResponse.json({
      ok: true,
      uploadToken,
      chunkIndex,
      chunkCount,
      bytesStored: after,
      complete: chunkIndex === chunkCount - 1 && after === declaredSize,
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chunk upload failed";
    console.error("Homepage UGC chunk upload failed", {
      slot,
      originalName,
      uploadToken,
      chunkIndex,
      chunkCount,
      error: message,
    });
    return NextResponse.json({ error: "The server could not store this upload chunk." }, { status: 422 });
  }
}

export async function PATCH(request: Request, ctx: { params: Promise<{ slot: string }> }) {
  const current = await requireAdmin(request);
  if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slot } = await ctx.params;
  const definition = getHomepageUgcSlot(slot);
  if (!definition) return NextResponse.json({ error: "Unknown homepage slot." }, { status: 404 });

  const body = await request.json().catch(() => null) as {
    uploadToken?: unknown;
    originalName?: unknown;
    mimeType?: unknown;
    fileSize?: unknown;
  } | null;

  const uploadToken = typeof body?.uploadToken === "string" ? body.uploadToken : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uploadToken)) {
    return NextResponse.json({ error: "Invalid upload token." }, { status: 400 });
  }

  const originalName = typeof body?.originalName === "string"
    ? body.originalName.slice(0, 240)
    : "homepage-video.mp4";
  const mime = typeof body?.mimeType === "string" && allowed.has(body.mimeType)
    ? body.mimeType
    : "video/mp4";
  const expectedSize = Number(body?.fileSize ?? 0);

  await ensureStorage();

  const tempPath = storagePath("temp", `homepage.${slot}.${uploadToken}.upload`);
  const tempInfo = await stat(tempPath).catch(() => null);
  if (!tempInfo?.isFile() || tempInfo.size <= 0) {
    return NextResponse.json({ error: "The staged upload is missing or expired. Upload the file again." }, { status: 410 });
  }
  if (!Number.isFinite(expectedSize) || expectedSize <= 0 || tempInfo.size !== expectedSize) {
    return NextResponse.json({
      error: `Upload is incomplete on the server (${tempInfo.size} of ${expectedSize || "unknown"} bytes). Please try again.`,
    }, { status: 409 });
  }

  const finalKey = `${randomUUID()}.mp4`;
  const finalPath = storagePath("uploads", finalKey);
  const thumbKey = `${randomUUID()}.jpg`;
  const thumbPath = storagePath("thumbnails", thumbKey);

  try {
    const sourceMeta = await probeVideo(tempPath);
    console.info("Homepage UGC processing started", {
      slot,
      originalName,
      bytes: tempInfo.size,
      codec: sourceMeta.codec,
      width: sourceMeta.width,
      height: sourceMeta.height,
      durationMs: sourceMeta.durationMs,
    });

    await makeBrowserPlaybackCopy(tempPath, finalPath, sourceMeta.codec);
    const meta = await probeVideo(finalPath);
    await makeThumbnail(finalPath, thumbPath);
    const sizeBytes = await fileSize("uploads", finalKey);

    const previous = await currentSlot(slot);
    const [asset] = await db.insert(mediaAssets).values({
      ownerId: current.id,
      originalName,
      storageKey: finalKey,
      thumbnailKey: thumbKey,
      mimeType: "video/mp4",
      sizeBytes,
      ...meta,
    }).returning();

    const updatedAt = new Date();
    await db.insert(homepageUgcSlots).values({
      slot,
      assetId: asset.id,
      sourceUrl: null,
      provider: null,
      thumbnailUrl: null,
      updatedBy: current.id,
      updatedAt,
    }).onConflictDoUpdate({
      target: homepageUgcSlots.slot,
      set: {
        assetId: asset.id,
        sourceUrl: null,
        provider: null,
        thumbnailUrl: null,
        updatedBy: current.id,
        updatedAt,
      },
    });

    if (previous?.assetId && previous.assetId !== asset.id) await removeAsset(previous);

    console.info("Homepage UGC processing completed", {
      slot,
      originalName,
      codec: meta.codec,
      width: meta.width,
      height: meta.height,
      durationMs: meta.durationMs,
    });

    return NextResponse.json({
      slot: {
        ...definition,
        hasMedia: true,
        sourceType: "upload",
        sourceUrl: null,
        provider: null,
        embedUrl: null,
        width: meta.width,
        height: meta.height,
        durationMs: meta.durationMs,
        mediaUrl: `/api/homepage/slots/${slot}/media`,
        thumbnailUrl: `/api/homepage/slots/${slot}/thumbnail`,
        updatedAt: updatedAt.toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Processing failed";
    await Promise.all([
      unlink(finalPath).catch(() => undefined),
      unlink(thumbPath).catch(() => undefined),
    ]);

    console.error("Homepage UGC processing failed", { slot, originalName, error: message });
    const timedOut = message.includes("timed out");
    return NextResponse.json({
      error: timedOut
        ? "Video processing took too long. Try a shorter MP4 or check the server logs."
        : "Video processing failed.",
    }, { status: timedOut ? 504 : 422 });
  } finally {
    await unlink(tempPath).catch(() => undefined);
  }
}

export async function PUT(request: Request, ctx: { params: Promise<{ slot: string }> }) {
  const current = await requireAdmin(request);
  if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slot } = await ctx.params;
  const definition = getHomepageUgcSlot(slot);
  if (!definition) return NextResponse.json({ error: "Unknown homepage slot." }, { status: 404 });

  const body = await request.json().catch(() => null) as { url?: unknown } | null;
  const raw = typeof body?.url === "string" ? body.url.trim() : "";
  const parsed = parseFeedbackLink(raw);
  if (!parsed) {
    return NextResponse.json({
      error: "Use a valid TikTok, Instagram Reel/post, YouTube video, or YouTube Shorts link.",
    }, { status: 400 });
  }

  const thumbnailUrl = await resolveFeedbackThumbnail(parsed);
  const previous = await currentSlot(slot);
  const updatedAt = new Date();

  await db.insert(homepageUgcSlots).values({
    slot,
    assetId: null,
    sourceUrl: parsed.canonicalUrl,
    provider: parsed.provider,
    thumbnailUrl,
    updatedBy: current.id,
    updatedAt,
  }).onConflictDoUpdate({
    target: homepageUgcSlots.slot,
    set: {
      assetId: null,
      sourceUrl: parsed.canonicalUrl,
      provider: parsed.provider,
      thumbnailUrl,
      updatedBy: current.id,
      updatedAt,
    },
  });

  await removeAsset(previous);

  return NextResponse.json({
    slot: {
      ...definition,
      hasMedia: true,
      sourceType: "link",
      sourceUrl: parsed.canonicalUrl,
      provider: parsed.provider,
      embedUrl: parsed.embedUrl,
      width: null,
      height: null,
      durationMs: null,
      mediaUrl: null,
      thumbnailUrl,
      updatedAt: updatedAt.toISOString(),
    },
  });
}

export async function DELETE(request: Request, ctx: { params: Promise<{ slot: string }> }) {
  const current = await requireAdmin(request);
  if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slot } = await ctx.params;
  if (!getHomepageUgcSlot(slot)) return NextResponse.json({ error: "Unknown homepage slot." }, { status: 404 });

  const previous = await currentSlot(slot);
  await db.delete(homepageUgcSlots).where(eq(homepageUgcSlots.slot, slot));
  await removeAsset(previous);
  return NextResponse.json({ ok: true });
}
