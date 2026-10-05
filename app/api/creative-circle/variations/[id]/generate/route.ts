import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiSectionUser } from "@/src/lib/api-auth";
import { db } from "@/src/lib/db";
import { variationRenders, variationSegments, variationSessions } from "@/src/lib/schema";
import { ensureStorage, fileSize, removeStored, storagePath } from "@/src/lib/storage";
import { assembleVariationVideo, buildVariationCombinations, isVariationKind, variationFileName } from "@/src/lib/variation-video";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await apiSectionUser(request, "lab");
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const [session] = await db.select().from(variationSessions)
    .where(and(eq(variationSessions.id, id), eq(variationSessions.ownerId, user.id)))
    .limit(1);
  if (!session) return NextResponse.json({ error: "Batch not found" }, { status: 404 });

  const rows = await db.select().from(variationSegments)
    .where(and(eq(variationSegments.sessionId, id), eq(variationSegments.ownerId, user.id)));

  const segments = rows.flatMap((row) => isVariationKind(row.kind) ? [{
    kind: row.kind,
    position: row.position,
    storageKey: row.storageKey,
    durationMs: row.durationMs,
  }] : []);

  const combinations = buildVariationCombinations(segments);
  if (!combinations.length) {
    return NextResponse.json({ error: "Record at least one hook, one body, and one CTA first." }, { status: 400 });
  }
  if (combinations.length > 64) {
    return NextResponse.json({ error: "This batch creates more than 64 combinations. Reduce the number of segments first." }, { status: 400 });
  }

  await ensureStorage();
  const staleRenders = await db.select({ storageKey: variationRenders.storageKey })
    .from(variationRenders)
    .where(and(eq(variationRenders.sessionId, id), eq(variationRenders.ownerId, user.id)));
  await Promise.all(staleRenders.map((render) => removeStored("renders", render.storageKey)));
  await db.delete(variationRenders).where(and(eq(variationRenders.sessionId, id), eq(variationRenders.ownerId, user.id)));

  const renders = [];
  try {
    for (const combination of combinations) {
      const renderId = randomUUID();
      const storageKey = `${renderId}.mp4`;
      const fileName = variationFileName(
        session.name,
        combination.hook.position,
        combination.body.position,
        combination.cta.position,
        renderId,
      );
      const concatListKey = `${randomUUID()}.txt`;

      await assembleVariationVideo({
        inputs: [
          storagePath("uploads", combination.hook.storageKey),
          storagePath("uploads", combination.body.storageKey),
          storagePath("uploads", combination.cta.storageKey),
        ],
        output: storagePath("renders", storageKey),
        concatListPath: storagePath("temp", concatListKey),
        batchName: session.name,
        uniqueId: renderId,
      });

      const sizeBytes = await fileSize("renders", storageKey);
      const [render] = await db.insert(variationRenders).values({
        id: renderId,
        sessionId: id,
        ownerId: user.id,
        hookPosition: combination.hook.position,
        bodyPosition: combination.body.position,
        ctaPosition: combination.cta.position,
        storageKey,
        fileName,
        sizeBytes,
        durationMs: combination.durationMs,
      }).returning();

      renders.push({
        ...render,
        downloadUrl: `/api/creative-circle/variations/${id}/renders/${render.id}`,
      });
    }

    await db.update(variationSessions).set({ updatedAt: new Date() }).where(eq(variationSessions.id, id));
    return NextResponse.json({ count: renders.length, renders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation failed";
    console.error("Variation Studio generation failed", { sessionId: id, ownerId: user.id, message });
    return NextResponse.json({ error: "The combinations could not be generated. Try the batch again." }, { status: 500 });
  }
}
