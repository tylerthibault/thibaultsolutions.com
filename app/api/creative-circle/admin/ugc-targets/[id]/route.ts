import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiCreativeCircleAdmin } from "@/src/lib/api-auth";
import { db } from "@/src/lib/db";
import { detectUgcDiscoverySourceType } from "@/src/lib/ugc-discovery";
import { ugcDiscoveryTargets } from "@/src/lib/schema";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  category: z.string().trim().max(120).optional(),
  sourceUrl: z.string().trim().url().optional(),
  keywords: z.string().trim().max(1000).optional(),
  enabled: z.boolean().optional(),
});

function validateSourceUrl(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== "https:") return "Discovery sources must use HTTPS";
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host === "127.0.0.1" || host === "::1") {
    return "Local discovery URLs are not allowed";
  }
  return null;
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await apiCreativeCircleAdmin(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid target update", details: parsed.error.flatten() }, { status: 400 });

  if (parsed.data.sourceUrl) {
    const validationError = validateSourceUrl(parsed.data.sourceUrl);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const now = new Date();
  const [target] = await db.update(ugcDiscoveryTargets).set({
    ...parsed.data,
    ...(parsed.data.sourceUrl ? { sourceType: detectUgcDiscoverySourceType(parsed.data.sourceUrl) } : {}),
    updatedAt: now,
  }).where(eq(ugcDiscoveryTargets.id, id)).returning();

  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ target });
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await apiCreativeCircleAdmin(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const [deleted] = await db.delete(ugcDiscoveryTargets)
    .where(eq(ugcDiscoveryTargets.id, id))
    .returning({ id: ugcDiscoveryTargets.id });
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
