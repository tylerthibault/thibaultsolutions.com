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

export async function GET(_request: Request, ctx: { params: Promise<{ slot: string }> }) {
  const { slot } = await ctx.params;
  if (!getHomepageUgcSlot(slot)) return new Response("Not found", { status: 404 });

  const [row] = await db.select({
    thumbnailKey: mediaAssets.thumbnailKey,
  }).from(homepageUgcSlots)
    .innerJoin(mediaAssets, eq(homepageUgcSlots.assetId, mediaAssets.id))
    .where(eq(homepageUgcSlots.slot, slot))
    .limit(1);

  if (!row?.thumbnailKey) return new Response("Not found", { status: 404 });

  const file = storagePath("thumbnails", row.thumbnailKey);
  const info = await stat(file).catch(() => null);
  if (!info) return new Response("Not found", { status: 404 });

  return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(info.size),
      "Cache-Control": "no-store",
    },
  });
}
