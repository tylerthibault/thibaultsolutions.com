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
  const definition = getHomepageUgcSlot(slot);
  if (!definition) return NextResponse.json({ error: "Unknown homepage slot." }, { status: 404 });

  const mime = (request.headers.get("content-type") ?? "").split(";")[0].trim();
  const ext = allowed.get(mime);
  if (!ext) return NextResponse.json({ error: "Use MP4, MOV, M4V, or WebM." }, { status: 415 });

  const originalName = decodeURIComponent(request.headers.get("x-file-name") ?? `upload${ext}`).slice(0, 240);
  if (!new Set([".mp4", ".mov", ".m4v", ".webm"]).has(path.extname(originalName).toLowerCase())) {
    return NextResponse.json({ error: "Unsupported file extension." }, { status: 415 });
  }

  const max = Number(process.env.MAX_UPLOAD_SIZE ?? 2147483648);
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > max) {
    return NextResponse.json({ error: "File is larger than the configured upload limit." }, { status: 413 });
  }
  if (!request.body) return NextResponse.json({ error: "Missing upload body." }, { status: 400 });

  await ensureStorage();
  const tempKey = `${slot}.${randomUUID()}.upload`;
  const tempPath = storagePath("temp", tempKey);
  const finalKey = `${randomUUID()}.mp4`;
  const finalPath = storagePath("uploads", finalKey);
  const thumbKey = `${randomUUID()}.jpg`;
  const thumbPath = storagePath("thumbnails", thumbKey);
  let received = 0;

  const source = Readable.fromWeb(request.body as never);
  source.on("data", (chunk: Buffer) => {
    received += chunk.length;
    if (received > max) source.destroy(new Error("Upload too large"));
  });

  try {
    await pipeline(source, createWriteStream(tempPath, { flags: "w" }));
    const tempInfo = await stat(tempPath);
    if (tempInfo.size <= 0) throw new Error("Empty upload");

    const sourceMeta = await probeVideo(tempPath);
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
    const message = error instanceof Error ? error.message : "Upload failed";
    await Promise.all([
      unlink(finalPath).catch(() => undefined),
      unlink(thumbPath).catch(() => undefined),
    ]);
    return NextResponse.json({
      error: message.includes("too large")
        ? "Upload exceeded configured limit."
        : "Video upload or processing failed.",
    }, { status: message.includes("too large") ? 413 : 422 });
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
