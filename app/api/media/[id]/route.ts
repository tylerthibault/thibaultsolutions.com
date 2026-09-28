import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { and, eq } from "drizzle-orm";
import { apiSectionUser } from "@/src/lib/api-auth";
import { db } from "@/src/lib/db";
import { mediaAssets } from "@/src/lib/schema";
import { storagePath } from "@/src/lib/storage";

export const runtime = "nodejs";
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await apiSectionUser(request, "lab");
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const [asset] = await db.select().from(mediaAssets).where(and(eq(mediaAssets.id, id), eq(mediaAssets.ownerId, user.id))).limit(1);
  if (!asset) return new Response("Not found", { status: 404 });
  const file = storagePath("uploads", asset.storageKey);
  const info = await stat(file);
  const range = request.headers.get("range");
  if (range) {
    const m = /bytes=(\d+)-(\d*)/.exec(range);
    if (!m) return new Response(null, { status: 416 });
    const start = Number(m[1]);
    const end = m[2] ? Math.min(Number(m[2]), info.size - 1) : info.size - 1;
    if (start > end || start >= info.size) return new Response(null, { status: 416 });
    const stream = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream;
    return new Response(stream, { status: 206, headers: { "Content-Type": asset.mimeType, "Accept-Ranges": "bytes", "Content-Range": `bytes ${start}-${end}/${info.size}`, "Content-Length": String(end - start + 1), "Cache-Control": "private, no-store" } });
  }
  return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, { headers: { "Content-Type": asset.mimeType, "Content-Length": String(info.size), "Accept-Ranges": "bytes", "Cache-Control": "private, no-store" } });
}
