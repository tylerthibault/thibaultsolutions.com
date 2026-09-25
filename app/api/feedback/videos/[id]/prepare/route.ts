import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiSectionUser } from "@/src/lib/api-auth";
import { db } from "@/src/lib/db";
import { getFeedbackVideoAccess } from "@/src/lib/feedback-access";
import {
  getFeedbackPlaybackState,
  startFeedbackPlaybackPreparation,
} from "@/src/lib/feedback-playback";
import { mediaAssets } from "@/src/lib/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function assetFor(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const current = await apiSectionUser(request, "feedback");
  if (!current) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const { id } = await ctx.params;
  const access = await getFeedbackVideoAccess(id, current.id);
  if (!access?.video.assetId) {
    return { error: NextResponse.json({ error: "Feedback video not found." }, { status: 404 }) };
  }

  const [asset] = await db.select().from(mediaAssets)
    .where(eq(mediaAssets.id, access.video.assetId))
    .limit(1);

  if (!asset) {
    return { error: NextResponse.json({ error: "Media asset not found." }, { status: 404 }) };
  }

  return { asset };
}

function responseFor(state: Awaited<ReturnType<typeof getFeedbackPlaybackState>>) {
  return NextResponse.json(
    { status: state.status, detail: state.detail ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const result = await assetFor(request, ctx);
  if ("error" in result) return result.error;
  return responseFor(await getFeedbackPlaybackState(result.asset));
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const result = await assetFor(request, ctx);
  if ("error" in result) return result.error;
  return responseFor(await startFeedbackPlaybackPreparation(result.asset));
}
