import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { HOMEPAGE_UGC_SLOTS } from "@/src/lib/homepage-slots";
import { parseFeedbackLink } from "@/src/lib/feedback-links";
import { homepageUgcSlots, mediaAssets } from "@/src/lib/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select({
    slot: homepageUgcSlots.slot,
    assetId: homepageUgcSlots.assetId,
    sourceUrl: homepageUgcSlots.sourceUrl,
    provider: homepageUgcSlots.provider,
    externalThumbnailUrl: homepageUgcSlots.thumbnailUrl,
    width: mediaAssets.width,
    height: mediaAssets.height,
    durationMs: mediaAssets.durationMs,
    updatedAt: homepageUgcSlots.updatedAt,
  }).from(homepageUgcSlots)
    .leftJoin(mediaAssets, eq(homepageUgcSlots.assetId, mediaAssets.id));

  const bySlot = new Map(rows.map((row) => [row.slot, row]));

  return NextResponse.json({
    slots: HOMEPAGE_UGC_SLOTS.map((definition) => {
      const row = bySlot.get(definition.id);
      const linked = row?.sourceUrl ? parseFeedbackLink(row.sourceUrl) : null;
      const hasFile = Boolean(row?.assetId);
      const hasLink = Boolean(row?.sourceUrl && linked);
      const hasMedia = hasFile || hasLink;

      return {
        ...definition,
        hasMedia,
        sourceType: hasFile ? "upload" : hasLink ? "link" : null,
        sourceUrl: row?.sourceUrl ?? null,
        provider: row?.provider ?? linked?.provider ?? null,
        embedUrl: linked?.embedUrl ?? null,
        width: row?.width ?? null,
        height: row?.height ?? null,
        durationMs: row?.durationMs ?? null,
        mediaUrl: hasFile ? `/api/homepage/slots/${definition.id}/media` : null,
        thumbnailUrl: hasFile
          ? `/api/homepage/slots/${definition.id}/thumbnail`
          : row?.externalThumbnailUrl ?? null,
        updatedAt: row?.updatedAt?.toISOString() ?? null,
      };
    }),
  }, { headers: { "Cache-Control": "no-store" } });
}
