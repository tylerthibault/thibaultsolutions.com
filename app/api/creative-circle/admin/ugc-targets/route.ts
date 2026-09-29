import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiCreativeCircleAdmin } from "@/src/lib/api-auth";
import { db } from "@/src/lib/db";
import { detectUgcDiscoverySourceType, listUgcDiscoveryTargets } from "@/src/lib/ugc-discovery";
import { ugcDiscoveryTargets } from "@/src/lib/schema";

const createSchema = z.object({
  name: z.string().trim().min(1).max(160),
  category: z.string().trim().max(120).default("General"),
  sourceUrl: z.string().trim().url(),
  keywords: z.string().trim().max(1000).default(""),
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

export async function GET(request: Request) {
  if (!(await apiCreativeCircleAdmin(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ targets: await listUgcDiscoveryTargets() });
}

export async function POST(request: Request) {
  if (!(await apiCreativeCircleAdmin(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid discovery target", details: parsed.error.flatten() }, { status: 400 });

  const validationError = validateSourceUrl(parsed.data.sourceUrl);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  const [duplicate] = await db.select({ id: ugcDiscoveryTargets.id })
    .from(ugcDiscoveryTargets)
    .where(eq(ugcDiscoveryTargets.sourceUrl, parsed.data.sourceUrl))
    .limit(1);
  if (duplicate) return NextResponse.json({ error: "That discovery source is already being watched" }, { status: 409 });

  const now = new Date();
  const [target] = await db.insert(ugcDiscoveryTargets).values({
    ...parsed.data,
    sourceType: detectUgcDiscoverySourceType(parsed.data.sourceUrl),
    updatedAt: now,
  }).returning();

  return NextResponse.json({ target }, { status: 201 });
}
