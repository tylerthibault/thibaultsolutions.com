import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiSectionUser } from "@/src/lib/api-auth";
import { db } from "@/src/lib/db";
import { variationRenders } from "@/src/lib/schema";
import { storagePath } from "@/src/lib/storage";

export const runtime = "nodejs";

export async function GET(request: Request, ctx: { params: Promise<{ id: string; renderId: string }> }) {
  const user = await apiSectionUser(request, "lab");
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, renderId } = await ctx.params;
  const [render] = await db.select().from(variationRenders).where(and(
    eq(variationRenders.id, renderId),
    eq(variationRenders.sessionId, id),
    eq(variationRenders.ownerId, user.id),
  )).limit(1);
  if (!render) return NextResponse.json({ error: "Variation not found" }, { status: 404 });

  const stream = createReadStream(storagePath("renders", render.storageKey));
  const fileName = render.fileName.replace(/[\r\n"]/g, "-");

  return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(render.sizeBytes),
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
