import { createWriteStream } from "node:fs";
import { rename, unlink } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiSectionUser } from "@/src/lib/api-auth";
import { db } from "@/src/lib/db";
import { variationRenders, variationSegments, variationSessions } from "@/src/lib/schema";
import { ensureStorage, fileSize, removeStored, storagePath } from "@/src/lib/storage";
import { isVariationKind, normalizeVariationSegment } from "@/src/lib/variation-video";

export const runtime = "nodejs";

const allowed = new Map([
  ["video/mp4", ".mp4"],
  ["video/quicktime", ".mov"],
  ["video/x-m4v", ".m4v"],
  ["video/webm", ".webm"],
]);

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await apiSectionUser(request, "lab");
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const [session] = await db.select().from(variationSessions)
    .where(and(eq(variationSessions.id, id), eq(variationSessions.ownerId, user.id)))
    .limit(1);
  if (!session) return NextResponse.json({ error: "Batch not found" }, { status: 404 });

  const kind = request.headers.get("x-segment-kind");
  const position = Number(request.headers.get("x-segment-position") ?? 0);
  if (!isVariationKind(kind) || !Number.isInteger(position) || position < 1 || position > 12) {
    return NextResponse.json({ error: "Invalid segment slot" }, { status: 400 });
  }

  const mime = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const ext = allowed.get(mime);
  if (!ext) return NextResponse.json({ error: "Unsupported video type. Use MP4, MOV, M4V, or WebM." }, { status: 415 });
  if (!request.body) return NextResponse.json({ error: "Missing video body" }, { status: 400 });

  const originalName = decodeURIComponent(request.headers.get("x-file-name") ?? `${kind}-${position}${ext}`).slice(0, 240);
  if (!new Set([".mp4", ".mov", ".m4v", ".webm"]).has(path.extname(originalName).toLowerCase())) {
    return NextResponse.json({ error: "Unsupported file extension" }, { status: 415 });
  }

  const configuredMax = Number(process.env.MAX_UPLOAD_SIZE ?? 2147483648);
  const max = Math.min(configuredMax, 536870912);
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length && length > max) return NextResponse.json({ error: "Segment is larger than the configured upload limit" }, { status: 413 });

  await ensureStorage();
  const tempKey = `${randomUUID()}${ext}`;
  const outputKey = `${randomUUID()}.mp4`;
  const tempPath = storagePath("temp", tempKey);
  const outputPath = storagePath("uploads", outputKey);
  let seen = 0;
  const source = Readable.fromWeb(request.body as never);
  source.on("data", (chunk: Buffer) => {
    seen += chunk.length;
    if (seen > max) source.destroy(new Error("Upload too large"));
  });

  try {
    await pipeline(source, createWriteStream(tempPath, { flags: "wx" }));
    const meta = await normalizeVariationSegment(tempPath, outputPath);
    const sizeBytes = await fileSize("uploads", outputKey);

    const [existing] = await db.select().from(variationSegments).where(and(
      eq(variationSegments.sessionId, id),
      eq(variationSegments.ownerId, user.id),
      eq(variationSegments.kind, kind),
      eq(variationSegments.position, position),
    )).limit(1);

    const staleRenders = await db.select({ storageKey: variationRenders.storageKey })
      .from(variationRenders)
      .where(and(eq(variationRenders.sessionId, id), eq(variationRenders.ownerId, user.id)));
    await Promise.all(staleRenders.map((render) => removeStored("renders", render.storageKey)));
    await db.delete(variationRenders).where(and(eq(variationRenders.sessionId, id), eq(variationRenders.ownerId, user.id)));

    let segment;
    if (existing) {
      [segment] = await db.update(variationSegments).set({
        storageKey: outputKey,
        originalName,
        mimeType: "video/mp4",
        sizeBytes,
        durationMs: meta.durationMs,
        updatedAt: new Date(),
      }).where(eq(variationSegments.id, existing.id)).returning();
      await removeStored("uploads", existing.storageKey);
    } else {
      [segment] = await db.insert(variationSegments).values({
        sessionId: id,
        ownerId: user.id,
        kind,
        position,
        storageKey: outputKey,
        originalName,
        mimeType: "video/mp4",
        sizeBytes,
        durationMs: meta.durationMs,
      }).returning();
    }

    await db.update(variationSessions).set({ updatedAt: new Date() }).where(eq(variationSessions.id, id));
    return NextResponse.json({ segment }, { status: existing ? 200 : 201 });
  } catch (error) {
    await unlink(outputPath).catch(() => undefined);
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({
      error: message.includes("too large") ? "Segment exceeded the upload limit" : "The segment could not be prepared",
    }, { status: message.includes("too large") ? 413 : 422 });
  } finally {
    await unlink(tempPath).catch(() => undefined);
  }
}
