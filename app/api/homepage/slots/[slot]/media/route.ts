import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { eq } from "drizzle-orm";
import { db } from "@/src/lib/db";
import { getHomepageUgcSlot } from "@/src/lib/homepage-slots";
import { homepageUgcSlots, mediaAssets } from "@/src/lib/schema";
import { storagePath } from "@/src/lib/storage";

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

export async function GET(request: Request, ctx: { params: Promise<{ slot: string }> }) {
  const { slot } = await ctx.params;
  if (!getHomepageUgcSlot(slot)) return new Response("Not found", { status: 404 });

  const [row] = await db.select({
    storageKey: mediaAssets.storageKey,
  }).from(homepageUgcSlots)
    .innerJoin(mediaAssets, eq(homepageUgcSlots.assetId, mediaAssets.id))
    .where(eq(homepageUgcSlots.slot, slot))
    .limit(1);

  if (!row) return new Response("Not found", { status: 404 });

  const file = storagePath("uploads", row.storageKey);
  const info = await stat(file).catch(() => null);
  if (!info) return new Response("Media file missing", { status: 410 });

  const rangeHeader = request.headers.get("range");
  if (rangeHeader) {
    const range = byteRange(rangeHeader, info.size);
    if (!range) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${info.size}` } });
    }

    const stream = Readable.toWeb(createReadStream(file, { start: range.start, end: range.end })) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(range.end - range.start + 1),
        "Content-Range": `bytes ${range.start}-${range.end}/${info.size}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-store",
        "Content-Disposition": "inline",
      },
    });
  }

  return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(info.size),
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store",
      "Content-Disposition": "inline",
    },
  });
}
