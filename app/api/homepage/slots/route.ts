import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { HOMEPAGE_UGC_SLOTS } from "@/src/lib/homepage-slots";
import { homepageUgcSlots, mediaAssets } from "@/src/lib/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select({
    slot: homepageUgcSlots.slot,
    assetId: homepageUgcSlots.assetId,
    width: mediaAssets.width,
    height: mediaAssets.height,
    durationMs: mediaAssets.durationMs,
  }).from(homepageUgcSlots)
    .leftJoin(mediaAssets, eq(homepageUgcSlots.assetId, mediaAssets.id));

  const bySlot = new Map(rows.map((row) => [row.slot, row]));

  return NextResponse.json({
    slots: HOMEPAGE_UGC_SLOTS.map((definition) => {
      const row = bySlot.get(definition.id);
      const hasMedia = Boolean(row?.assetId);
      return {
        ...definition,
        hasMedia,
        width: row?.width ?? null,
        height: row?.height ?? null,
        durationMs: row?.durationMs ?? null,
        mediaUrl: hasMedia ? `/api/homepage/slots/${definition.id}/media` : null,
        thumbnailUrl: hasMedia ? `/api/homepage/slots/${definition.id}/thumbnail` : null,
      };
    }),
  }, { headers: { "Cache-Control": "no-store" } });
}
