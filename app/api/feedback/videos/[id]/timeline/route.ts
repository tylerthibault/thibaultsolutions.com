import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiSessionUser } from "@/src/lib/api-auth";
import { db } from "@/src/lib/db";
import { getFeedbackPlaybackState } from "@/src/lib/feedback-playback";
import { getFeedbackRequestAccess } from "@/src/lib/feedback-public";
import { feedbackTimelineFramePath, getFeedbackTimeline } from "@/src/lib/feedback-timeline";
import { mediaAssets } from "@/src/lib/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const current = await apiSessionUser(request);
  const { id } = await ctx.params;
  const access = await getFeedbackRequestAccess(id, current?.id);
  if (!access?.video.assetId) return new Response("Not found", { status: 404 });

  const [asset] = await db.select().from(mediaAssets)
    .where(eq(mediaAssets.id, access.video.assetId))
    .limit(1);
  if (!asset) return new Response("Not found", { status: 404 });

  const playback = await getFeedbackPlaybackState(asset);
  if (playback.status !== "ready" || !playback.file) {
    return NextResponse.json({ error: "Timeline is waiting for video playback preparation." }, { status: 409 });
  }

  const manifest = await getFeedbackTimeline(asset.id, playback.file, access.video.durationMs ?? asset.durationMs);
  const url = new URL(request.url);
  const frameParam = url.searchParams.get("frame");

  if (frameParam !== null) {
    const frameIndex = Number(frameParam);
    if (!Number.isInteger(frameIndex) || !manifest.frames.some((frame) => frame.index === frameIndex)) {
      return new Response("Not found", { status: 404 });
    }
    const file = feedbackTimelineFramePath(asset.id, frameIndex);
    const info = await stat(file).catch(() => null);
    if (!info) return new Response("Not found", { status: 404 });
    return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(info.size),
        "Cache-Control": "private, max-age=86400",
      },
    });
  }

  return NextResponse.json({
    durationMs: manifest.durationMs,
    waveform: manifest.waveform,
    frames: manifest.frames.map((frame) => ({
      ...frame,
      url: `/api/feedback/videos/${id}/timeline?frame=${frame.index}`,
    })),
  }, { headers: { "Cache-Control": "private, max-age=300" } });
}
